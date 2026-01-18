'use client';

import { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { getSupabaseClient } from '@/lib/supabase';
import type { ChatConnectionDetails } from '@/app/api/chat-session/[share_token]/connection/route';

const MotionSessionView = motion.create(SessionView);

const appConfig = {
  pageTitle: 'Expert Avatar Chat',
  pageDescription: 'Chat with an expert avatar',
  companyName: 'Expert Avatar',
  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,
  logo: '',
  startButtonText: 'Start Chat',
};

interface ChatPageProps {
  params: Promise<{ share_token: string }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { share_token } = use(params);
  const router = useRouter();
  const room = useMemo(() => new Room(), []);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<ChatConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Redirect to login with return URL
          const returnUrl = encodeURIComponent(`/chat/${share_token}`);
          router.push(`/login?redirect=${returnUrl}`);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, share_token]);

  // Fetch connection details once authenticated and auto-start session
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchConnection = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setError('Not authenticated');
          return;
        }

        const response = await fetch(`/api/chat-session/${share_token}/connection`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const data = await response.json();
          // Check if the avatar/session is no longer available
          // This includes: deleted sessions, revoked links, missing source session,
          // invalid tokens (deleted or never existed), or explicit deletion flag
          const unavailableErrors = [
            'Source session not found',
            'This session has been deleted',
            'Share link has been revoked',
            'Invalid share token',
          ];
          if (data.deleted || unavailableErrors.includes(data.error)) {
            setIsUnavailable(true);
            return;
          }
          setError(data.error || 'Failed to load chat session');
          return;
        }

        const details: ChatConnectionDetails = await response.json();
        setConnectionDetails(details);
        // Auto-start the session - skip the preview page
        setSessionStarted(true);
      } catch (err) {
        console.error('Error fetching connection:', err);
        setError('Failed to connect to chat session');
      }
    };

    fetchConnection();
  }, [isAuthenticated, share_token]);

  // Handle room events
  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      toastAlert({
        title: 'Session ended',
        description: 'The chat session has ended.',
      });
    };

    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: 'Media device error',
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

  // Connect to room when user starts
  useEffect(() => {
    let aborted = false;

    if (sessionStarted && connectionDetails && room.state === 'disconnected') {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        room.connect(connectionDetails.serverUrl, connectionDetails.participantToken),
      ])
        .then(() => {
          if (aborted) return;
          console.log('Connected to chat session');
        })
        .catch((error) => {
          if (aborted) return;
          console.error('Connection error:', error);
          toastAlert({
            title: 'Connection error',
            description: `${error.name}: ${error.message}`,
          });
        });
    }

    return () => {
      aborted = true;
      room.disconnect();
    };
  }, [room, sessionStarted, connectionDetails]);

  // Loading state - show blank screen for seamless transition
  if (isAuthenticated === null) {
    return (
      <div className="bg-background fixed inset-0" />
    );
  }

  // Avatar unavailable state - matches post-session style
  if (isUnavailable) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        <HamburgerMenu />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg px-4"
        >
          <h1 className="text-3xl font-bold mb-8">Avatar is no longer available</h1>
          
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            CREATE +
          </button>
        </motion.div>
        <Toaster />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold mb-4">Unable to Load Chat</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Post-session state - show create avatar prompt
  if (!sessionStarted && connectionDetails) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        <HamburgerMenu />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg px-4"
        >
          <h1 className="text-3xl font-bold mb-8 whitespace-nowrap">Ready to create your expert avatar?</h1>
          
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            CREATE +
          </button>
        </motion.div>
        <Toaster />
      </div>
    );
  }

  // Loading connection details - show blank screen for seamless transition
  if (!connectionDetails) {
    return (
      <div className="bg-background fixed inset-0" />
    );
  }

  // Session view
  return (
    <main>
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

