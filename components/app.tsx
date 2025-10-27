'use client';

import { useEffect, useMemo, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { Welcome } from '@/components/welcome';
import useConnectionDetails from '@/hooks/useConnectionDetails';
import type { AppConfig } from '@/lib/types';

const MotionWelcome = motion.create(Welcome);
const MotionSessionView = motion.create(SessionView);

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const room = useMemo(() => new Room(), []);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [pictureId, setPictureId] = useState<string | null>(null);
  const { refreshConnectionDetails, existingOrRefreshConnectionDetails } =
    useConnectionDetails(appConfig, pictureId);

  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      // Don't fetch new connection details here - wait until user starts a new session
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
            } catch (e) {
              // Error parsing saved settings
            }
          }
        }

        // Request camera permission early for avatar creation
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });
        
        // Stop the stream immediately since we just needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Error requesting camera for avatar creation:', error);
      }
    };

    enableCameraForAvatar();
  }, []);

  useEffect(() => {
    let aborted = false;
    if (sessionStarted && room.state === 'disconnected') {
      console.log(`🔌 Starting connection with picture ID: ${pictureId}`);
      
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
            console.log('⚠️ Connection aborted');
            return;
          }

          console.log('✅ Connected to room');
          console.log(`🖼️  Picture ID embedded in token attributes: ${pictureId}`);
          
          // Enable camera (pictureId is already in token attributes, no need to send data packet)
          try {
            await room.localParticipant.setCameraEnabled(true);
            console.log('✅ Camera enabled');
          } catch (error) {
            console.error('❌ Error enabling camera:', error);
          }
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

          console.error('❌ Connection error:', error);
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
  }, [room, sessionStarted, appConfig.isPreConnectBufferEnabled, pictureId]);

  const { startButtonText } = appConfig;

  return (
    <main>
      <MotionWelcome
        key="welcome"
        startButtonText={startButtonText}
        onStartCall={(pictureId: string) => {
          console.log(`🎬 onStartCall invoked with picture ID: ${pictureId}`);
          setPictureId(pictureId);
          setSessionStarted(true);
          console.log(`🎬 Session started, picture ID state will update to: ${pictureId}`);
        }}
        disabled={sessionStarted}
        initial={{ opacity: 1 }}
        animate={{ opacity: sessionStarted ? 0 : 1 }}
        transition={{ duration: 0.5, ease: 'linear', delay: sessionStarted ? 0 : 0.5 }}
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
