'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { VoiceConsentModal } from '@/components/voice-consent-modal';
import { Welcome } from '@/components/welcome';
import useConnectionDetails, { ResumeSessionData } from '@/hooks/useConnectionDetails';
import { getSupabaseClient } from '@/lib/supabase';
import type { AppConfig } from '@/lib/types';

const MotionWelcome = motion.create(Welcome);
const MotionSessionView = motion.create(SessionView);

interface AppProps {
  appConfig: AppConfig;
  resumeSessionId?: string | null;
}

export function App({ appConfig, resumeSessionId }: AppProps) {
  const router = useRouter();
  const room = useMemo(() => new Room(), []);
  // If resuming, start with session hidden (don't show Welcome)
  const [isResuming, setIsResuming] = useState(!!resumeSessionId);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [pictureId, setPictureId] = useState<string | null>(null);
  const [resumeSessionData, setResumeSessionData] = useState<ResumeSessionData | null>(null);
  const [hasHandledResumeParam, setHasHandledResumeParam] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingPictureId, setPendingPictureId] = useState<string | null>(null);
  const [welcomeKey, setWelcomeKey] = useState(0);
  const [hasExistingConsent, setHasExistingConsent] = useState<boolean | null>(null);
  const { existingOrRefreshConnectionDetails } = useConnectionDetails(
    appConfig,
    pictureId,
    resumeSessionData
  );

  // Track whether the current session is a resume (ref so disconnect handler can read it)
  const isResumeSessionRef = useRef(false);
  useEffect(() => {
    isResumeSessionRef.current = resumeSessionData !== null;
  }, [resumeSessionData]);

  // Check if user already has voice consent on mount
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/user/voice-consent', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasExistingConsent(data.hasConsent);
        }
      } catch (error) {
        console.error('Error checking voice consent status:', error);
      }
    };

    checkConsent();
  }, []);

  useEffect(() => {
    const onDisconnected = () => {
      const wasResumeSession = isResumeSessionRef.current;
      setSessionStarted(false);
      setResumeSessionData(null);
      // Navigate to dashboard after call ends
      // Only pass from_session=true for new sessions so dashboard shows processing indicator
      // Resume sessions don't create new avatars, so no processing indicator needed
      router.push(wasResumeSession ? '/dashboard' : '/dashboard?from_session=true');
    };
    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, router]);

  // Enable camera early for avatar creation (before session starts)
  useEffect(() => {
    const enableCameraForAvatar = async () => {
      try {
        // Clear any saved "camera disabled" preference so camera always starts enabled
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedSettings = window.localStorage.getItem('livekit-settings');
          if (savedSettings) {
            try {
              const settings = JSON.parse(savedSettings);
              if (settings.inputs?.video?.enabled === false) {
                settings.inputs.video.enabled = true;
                window.localStorage.setItem('livekit-settings', JSON.stringify(settings));
              }
            } catch {
              // Error parsing saved settings
            }
          }
        }

        // Request camera permission early for avatar creation (512x512 square)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 512 },
            height: { ideal: 512 },
            facingMode: 'user',
          },
          audio: false,
        });

        // Stop the stream immediately since we just needed permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error('Error requesting camera for avatar creation:', error);
      }
    };

    enableCameraForAvatar();
  }, []);

  useEffect(() => {
    let aborted = false;
    if (sessionStarted && room.state === 'disconnected') {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        existingOrRefreshConnectionDetails().then((connectionDetails) =>
          room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
        ),
      ])
        .then(async () => {
          if (aborted) {
            return;
          }

          // Camera is NOT enabled during the call - only used for taking the initial picture
          // This ensures only audio is recorded, not video
          console.log('Call started - microphone enabled, camera disabled');
        })
        .catch((error) => {
          if (aborted) {
            // Once the effect has cleaned up after itself, drop any errors
            //
            // These errors are likely caused by this effect rerunning rapidly,
            // resulting in a previous run `disconnect` running in parallel with
            // a current run `connect`
            return;
          }

          console.error('Connection error:', error);
          toastAlert({
            title: 'There was an error connecting to the agent',
            description: `${error.name}: ${error.message}`,
          });
        });
    }
    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [
    room,
    sessionStarted,
    appConfig.isPreConnectBufferEnabled,
    pictureId,
    existingOrRefreshConnectionDetails,
  ]);

  const { startButtonText } = appConfig;

  const handleResumeSession = async (sessionId: string) => {
    console.log('Resuming session:', sessionId);

    try {
      // Fetch the session's conversation_summary from the API
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${sessionId}/narrative`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session summary');
      }

      const data = await response.json();

      // Set resume session data and start session immediately (skip welcome/picture)
      setResumeSessionData({
        originalSessionId: sessionId,
        conversationSummary: data.conversation_summary || '',
      });
      setSessionStarted(true);
    } catch (error) {
      console.error('Error resuming session:', error);
      setIsResuming(false); // Show Welcome on error so user can start fresh
      toastAlert({
        title: 'Error resuming session',
        description: error instanceof Error ? error.message : 'Failed to resume session',
      });
    }
  };

  // Start session directly (bypassing consent modal)
  const startSessionWithPicture = useCallback((picId: string) => {
    setPictureId(picId);
    setSessionStarted(true);
    setPendingPictureId(null);
  }, []);

  // Handle resume session from URL parameter
  useEffect(() => {
    if (resumeSessionId && !hasHandledResumeParam) {
      setHasHandledResumeParam(true);
      console.log('Resuming session from URL param:', resumeSessionId);
      handleResumeSession(resumeSessionId);
    }
  }, [resumeSessionId, hasHandledResumeParam]);

  return (
    <main>
      {/* Hide Welcome entirely when resuming a session */}
      {!isResuming && (
        <MotionWelcome
          key={welcomeKey}
          startButtonText={startButtonText}
          onStartCall={(pictureId: string) => {
            if (hasExistingConsent) {
              // User already consented previously, skip the modal
              startSessionWithPicture(pictureId);
            } else {
              // First time — show consent modal
              setPendingPictureId(pictureId);
              setShowConsentModal(true);
            }
          }}
          disabled={sessionStarted}
          initial={{ opacity: 1 }}
          animate={{ opacity: sessionStarted ? 0 : 1 }}
          transition={{ duration: 0.5, ease: 'linear', delay: sessionStarted ? 0 : 0.5 }}
        />
      )}

      <VoiceConsentModal
        open={showConsentModal}
        onOpenChange={setShowConsentModal}
        onConsent={() => {
          // User consented, proceed with starting the session
          setHasExistingConsent(true);
          if (pendingPictureId) {
            startSessionWithPicture(pendingPictureId);
          }
        }}
        onCancel={() => {
          // User cancelled, reset Welcome component so camera restarts
          setPendingPictureId(null);
          setWelcomeKey((k) => k + 1);
        }}
      />

      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        {/* --- */}
        <MotionSessionView
          key="session-view"
          appConfig={appConfig}
          disabled={!sessionStarted}
          sessionStarted={sessionStarted}
          initial={{ opacity: 0 }}
          animate={{ opacity: sessionStarted ? 1 : 0 }}
          transition={{
            duration: 0.5,
            ease: 'linear',
            delay: sessionStarted ? 0.5 : 0,
          }}
        />
      </RoomContext.Provider>

      <Toaster />
    </main>
  );
}
