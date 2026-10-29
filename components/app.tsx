'use client';

import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { ConsentScreen } from '@/components/screens/consent-screen';
import { LandingScreen } from '@/components/screens/landing-screen';
import { PhotoScreen } from '@/components/screens/photo-screen';
import { VoiceScreen } from '@/components/screens/voice-screen';
import { WaitScreen } from '@/components/screens/wait-screen';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import useConnectionDetails from '@/hooks/useConnectionDetails';
import type { AppConfig } from '@/lib/types';

const MotionSessionView = motion.create(SessionView);

type Step = 'landing' | 'consent' | 'voice' | 'photo' | 'wait' | 'session';

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const room = useMemo(() => new Room(), []);
  const [step, setStep] = useState<Step>('landing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const { existingOrRefreshConnectionDetails } = useConnectionDetails(voiceId, sessionId);

  const sessionStarted = step === 'session';

  // When the ghost call ends, return everyone to a clean landing page so the next
  // guest starts fresh (party-proofing).
  useEffect(() => {
    const onDisconnected = () => {
      setStep('landing');
      setSessionId(null);
      setVoiceId(null);
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
  }, [room]);

  // Connect to the LiveKit room once we reach the session step. The token carries
  // the agent-dispatch config (voiceId + sessionId), so the ghost joins on room
  // creation.
  useEffect(() => {
    if (!sessionStarted) return;
    let aborted = false;
    if (room.state === 'disconnected') {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        existingOrRefreshConnectionDetails().then((connectionDetails) =>
          room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
        ),
      ]).catch((error) => {
        if (aborted) return;
        console.error('Connection error:', error);
        toastAlert({
          title: 'There was an error connecting to your ghost',
          description: `${error.name}: ${error.message}`,
        });
      });
    }
    return () => {
      aborted = true;
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, sessionStarted, appConfig.isPreConnectBufferEnabled]);

  return (
    <main>
      {step === 'landing' && (
        <LandingScreen
          onStart={() => {
            setSessionId(crypto.randomUUID());
            setStep('consent');
          }}
        />
      )}

      {step === 'consent' && sessionId && (
        <ConsentScreen sessionId={sessionId} onConsented={() => setStep('voice')} />
      )}

      {step === 'voice' && sessionId && (
        <VoiceScreen
          sessionId={sessionId}
          onCloned={(id) => {
            setVoiceId(id);
            setStep('photo');
          }}
        />
      )}

      {step === 'photo' && sessionId && (
        <PhotoScreen sessionId={sessionId} onCaptured={() => setStep('wait')} />
      )}

      {step === 'wait' && sessionId && (
        <WaitScreen sessionId={sessionId} onReady={() => setStep('session')} />
      )}

      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
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
