'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Room, RoomEvent } from 'livekit-client';
import { AnimatePresence, motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import type { ChatConnectionDetails } from '@/app/api/chat-session/[share_token]/connection/route';
import { toastAlert } from '@/components/alert-toast';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { getSupabaseClient } from '@/lib/supabase';

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
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<ChatConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isNoCredits, setIsNoCredits] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if token is public first
  useEffect(() => {
    const checkPublic = async () => {
      try {
        const response = await fetch(`/api/chat-session/${share_token}/public`);
        if (response.ok) {
          const data = await response.json();
          setIsPublic(data.isPublic);
        } else {
          setIsPublic(false);
        }
      } catch (error) {
        console.error('Error checking if token is public:', error);
        setIsPublic(false);
      }
    };

    checkPublic();
  }, [share_token]);

  // Check authentication (only if not public)
  useEffect(() => {
    // Wait for public check to complete
    if (isPublic === null) return;

    // If public, skip auth
    if (isPublic) {
      setIsAuthenticated(true);
      return;
    }

    // For non-public tokens, require authentication
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

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
  }, [router, share_token, isPublic]);

  // Fetch connection details once authenticated and auto-start session
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchConnection = async () => {
      try {
        // For public sessions, don't send auth header
        // For authenticated sessions, include auth header
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (!isPublic) {
          const supabase = getSupabaseClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            setError('Not authenticated');
            return;
          }

          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/chat-session/${share_token}/connection`, {
          method: 'POST',
          headers,
        });

        if (!response.ok) {
          const data = await response.json();

          // Check if expert has no credits (402 Payment Required)
          if (data.code === 'NO_CREDITS' || response.status === 402) {
            setIsNoCredits(true);
            return;
          }

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

  // Start the countdown timer (called when agent sends the signal)
  const startCountdown = useCallback((seconds: number) => {
    // Clear any existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setCountdownSeconds(seconds);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Clean up countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Handle room events
  useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
      setCountdownSeconds(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
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

  // Register text stream handler for session timer countdown
  useEffect(() => {
    room.registerTextStreamHandler('session.timer', async (reader) => {
      const text = await reader.readAll();
      const seconds = parseInt(text, 10);
      if (!isNaN(seconds) && seconds > 0) {
        console.log(`Session timer: starting ${seconds}s countdown`);
        startCountdown(seconds);
      }
    });

    return () => {
      room.unregisterTextStreamHandler('session.timer');
    };
  }, [room, startCountdown]);

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

  // Loading state - show blank screen while checking public status or authentication
  if (isPublic === null || isAuthenticated === null) {
    return <div className="bg-background fixed inset-0" />;
  }

  // Avatar unavailable state - matches post-session style
  if (isUnavailable) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        {!isPublic && <HamburgerMenu />}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg px-4 text-center"
        >
          <h1 className="mb-8 text-3xl font-bold">Avatar is no longer available</h1>

          <button
            onClick={() => router.push('/')}
            className="bg-primary text-primary-foreground rounded-lg px-8 py-4 text-lg font-semibold shadow-lg transition-opacity hover:opacity-90"
          >
            CREATE +
          </button>
        </motion.div>
        <Toaster />
      </div>
    );
  }

  // Expert has no credits - friendly message
  if (isNoCredits) {
    return (
      <div className="bg-background fixed inset-0 flex items-center justify-center">
        {!isPublic && <HamburgerMenu />}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg px-4 text-center"
        >
          <h1 className="mb-4 text-3xl font-bold">Avatar temporarily unavailable</h1>
          <p className="text-muted-foreground mb-8">
            This expert has reached their free usage limit for the month. They&apos;ve been notified
            and may upgrade soon.
          </p>

          <button
            onClick={() => router.push('/')}
            className="bg-primary text-primary-foreground rounded-lg px-8 py-4 text-lg font-semibold shadow-lg transition-opacity hover:opacity-90"
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
        <div className="max-w-md px-4 text-center">
          <h1 className="mb-4 text-2xl font-bold">Unable to Load Chat</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 transition-opacity hover:opacity-90"
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
        {!isPublic && <HamburgerMenu />}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg px-4 text-center"
        >
          <h1 className="mb-8 text-3xl font-bold whitespace-nowrap">
            Ready to create your expert avatar?
          </h1>

          <button
            onClick={() => router.push('/')}
            className="bg-primary text-primary-foreground rounded-lg px-8 py-4 text-lg font-semibold shadow-lg transition-opacity hover:opacity-90"
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
    return <div className="bg-background fixed inset-0" />;
  }

  // Format seconds as M:SS
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

      {/* Countdown timer overlay */}
      <AnimatePresence>
        {countdownSeconds !== null && countdownSeconds >= 0 && (
          <motion.div
            key="countdown-timer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-4 left-1/2 z-[100] -translate-x-1/2"
          >
            <div className="rounded-full bg-black/70 px-5 py-2 backdrop-blur-sm">
              <span className="font-mono text-sm font-semibold text-white tabular-nums">
                Session ends in {formatTime(countdownSeconds)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster />
    </main>
  );
}
