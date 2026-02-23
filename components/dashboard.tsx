'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { cn } from '@/lib/utils';
import { SessionCard } from '@/components/session-card';
import useSessions from '@/hooks/useSessions';
import { CircleNotch, Trash, WarningCircle } from '@phosphor-icons/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getSupabaseClient } from '@/lib/supabase';

interface DashboardProps {
  disabled: boolean;
  onCreateNew: () => void;
  onResumeSession?: (sessionId: string) => void;
  justFinishedSession?: boolean;
}

export const Dashboard = ({
  disabled,
  onCreateNew,
  onResumeSession,
  justFinishedSession = false,
  ref,
}: React.ComponentProps<'div'> & DashboardProps) => {
  const { sessions, loading, error, hasProcessingSessions, processingSessionIds, skippedSessionIds, hasPendingAvatarUpdates, hasPendingHotTakeVideos, billingInfo, refetch } = useSessions(!disabled);
  
  // Delete state for processing sessions
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  
  // Track if we're still waiting for a session to appear after just finishing one
  // This handles the race condition where interview_calls record hasn't been created yet
  const [isWaitingForSession, setIsWaitingForSession] = useState(justFinishedSession);
  
  // Track the initial session count so we know when a NEW session has appeared.
  // For first-time users, this will be 0. For returning users, it will be > 0.
  const initialSessionCount = useRef<number | null>(null);
  
  // Capture the initial session count once the first fetch completes
  useEffect(() => {
    if (!loading && isWaitingForSession && initialSessionCount.current === null) {
      initialSessionCount.current = sessions.length;
      console.log(`[Dashboard] Captured initial session count: ${sessions.length}`);
    }
  }, [loading, sessions.length, isWaitingForSession]);
  
  // Track if waiting has timed out (backend completed too fast for us to detect)
  const [waitingTimedOut, setWaitingTimedOut] = useState(false);
  
  // Clear waiting state when a new session actually appears (count increases)
  // or when the backend reports processing sessions (it has registered the new session)
  useEffect(() => {
    if (!isWaitingForSession || initialSessionCount.current === null) return;
    
    // For first-time users (0 sessions): clear when sessions appear or processing detected
    // For returning users (>0 sessions): clear when session count increases
    // For all users: also clear when hasProcessingSessions is detected (system acknowledged the session)
    const hasNewSession = sessions.length > initialSessionCount.current;
    const firstSessionAppeared = initialSessionCount.current === 0 && sessions.length > 0;
    const processingDetected = hasProcessingSessions;
    const skippedDetected = skippedSessionIds.length > 0;
    
    if (hasNewSession || firstSessionAppeared || processingDetected || skippedDetected) {
      console.log(`[Dashboard] New session detected, clearing waiting state (initial: ${initialSessionCount.current}, current: ${sessions.length}, processing: ${hasProcessingSessions}, skipped: ${skippedSessionIds.length})`);
      setIsWaitingForSession(false);
      setWaitingTimedOut(false);
    }
  }, [sessions.length, hasProcessingSessions, skippedSessionIds.length, isWaitingForSession]);
  
  // Safety timeout: if after 60 seconds we still haven't detected processing or a new session,
  // the backend likely completed before we could detect it. Transition to "timed out" state
  // which shows a "not enough data" message instead of the spinner.
  useEffect(() => {
    if (!isWaitingForSession) {
      setWaitingTimedOut(false);
      return;
    }
    
    const timer = setTimeout(() => {
      if (isWaitingForSession && !hasProcessingSessions && processingSessionIds.length === 0) {
        console.log('[Dashboard] Waiting timed out after 60s - session likely skipped or failed');
        setWaitingTimedOut(true);
      }
    }, 60_000);
    
    return () => clearTimeout(timer);
  }, [isWaitingForSession, hasProcessingSessions, processingSessionIds.length]);

  // Refetch when dashboard becomes visible
  useEffect(() => {
    if (!disabled) {
      console.log('Dashboard is now visible, refetching sessions...');
      refetch();
    }
  }, [disabled, refetch]);

  // Log session count for debugging
  useEffect(() => {
    if (!loading && sessions) {
      console.log(`[Dashboard] Displaying ${sessions.length} sessions, hasProcessingSessions: ${hasProcessingSessions}, hasPendingAvatarUpdates: ${hasPendingAvatarUpdates}, hasPendingHotTakeVideos: ${hasPendingHotTakeVideos}`);
    }
  }, [sessions, loading, hasProcessingSessions, hasPendingAvatarUpdates, hasPendingHotTakeVideos]);

  // Auto-poll when there are processing sessions, pending avatar updates, sessions without avatar images,
  // or we're waiting for a session to appear after just finishing one
  useEffect(() => {
    if (disabled || loading) return;

    // Check if any session is missing an avatar image
    const hasMissingAvatars = sessions.some(s => !s.avatar_image_url);
    
    // Poll if there are processing sessions, pending avatar updates, pending hot take videos,
    // sessions with missing avatars, or we're waiting for a session to appear
    const shouldPoll = hasProcessingSessions || hasPendingAvatarUpdates || hasPendingHotTakeVideos || hasMissingAvatars || isWaitingForSession;
    
    if (!shouldPoll) return;

    console.log('[Dashboard] Starting auto-poll for processing sessions, avatar updates, hot take videos, missing avatars, or waiting for session');
    
    const pollInterval = setInterval(() => {
      console.log('[Dashboard] Auto-polling for updates...');
      refetch();
    }, 5000); // Poll every 5 seconds

    return () => {
      console.log('[Dashboard] Stopping auto-poll');
      clearInterval(pollInterval);
    };
  }, [disabled, loading, hasProcessingSessions, hasPendingAvatarUpdates, hasPendingHotTakeVideos, sessions, isWaitingForSession, refetch]);

  // Handle deletion of a processing session
  const handleDeleteProcessingSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      const supabase = getSupabaseClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete session');
      }

      // Refresh sessions list
      refetch();
    } catch (error) {
      console.error('Error deleting processing session:', error);
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <section
      ref={ref}
      inert={disabled}
      className={cn(
        'bg-background fixed inset-0 flex flex-col overflow-auto',
        disabled ? 'z-10' : 'z-20'
      )}
    >
      {/* Header with Create + button and hamburger menu */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b border-border">
        <div className="container mx-auto px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">My Sessions</h1>
            {!loading && sessions.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="primary" 
              size="lg" 
              onClick={onCreateNew}
              className="font-mono text-1xl px-6 py-4"
            >
              CREATE +
            </Button>
            {!disabled && <HamburgerMenu inline />}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 container mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <CircleNotch size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <p className="text-destructive">Error loading sessions: {error}</p>
              <Button onClick={refetch} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              {hasProcessingSessions || (isWaitingForSession && !waitingTimedOut) ? (
                <>
                  <CircleNotch size={32} className="animate-spin text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground text-lg">Your avatar is being generated.</p>
                  <p className="text-sm text-muted-foreground">
                    This usually takes a few minutes.
                  </p>
                </>
              ) : waitingTimedOut ? (
                <>
                  <WarningCircle size={32} className="text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground text-lg">Not enough data</p>
                  <p className="text-sm text-muted-foreground">
                    The session didn&apos;t have enough conversation to generate an avatar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsWaitingForSession(false);
                      setWaitingTimedOut(false);
                    }}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-lg">No sessions yet</p>
                  <p className="text-sm text-muted-foreground">
                    Click "create +" to start your first session
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Show processing placeholder cards for each processing session */}
            {processingSessionIds.length > 0 && processingSessionIds.map((sessionId) => {
              const isSkipped = skippedSessionIds.includes(sessionId);
              return (
              <div key={sessionId} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm border-dashed relative group">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <div className="text-center space-y-3 px-4">
                    {isSkipped ? (
                      <>
                        <WarningCircle size={40} className="text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground font-medium">Not enough data</p>
                        <p className="text-xs text-muted-foreground">
                          The session didn&apos;t have enough conversation to generate an avatar.
                        </p>
                      </>
                    ) : (
                      <>
                        <CircleNotch size={40} className="animate-spin text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground font-medium">Generating avatar...</p>
                        <p className="text-xs text-muted-foreground">
                          This usually takes a few minutes.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-muted-foreground">
                    {isSkipped ? 'Empty Session' : 'New Session'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isSkipped ? 'You can delete this session' : 'Processing your session'}
                  </p>
                </div>
                
                {/* Delete Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      disabled={deletingSessionId === sessionId}
                      title="Delete session"
                    >
                      <Trash size={16} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The session data will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deletingSessionId === sessionId}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteProcessingSession(sessionId)}
                        disabled={deletingSessionId === sessionId}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingSessionId === sessionId ? (
                          <>
                            <CircleNotch size={16} className="mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Delete'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              );
            })}
            
            {/* Fallback: Show a single generic placeholder when waiting for session but no processingSessionIds yet */}
            {isWaitingForSession && processingSessionIds.length === 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm border-dashed relative group">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <div className="text-center space-y-3 px-4">
                    {waitingTimedOut ? (
                      <>
                        <WarningCircle size={40} className="text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground font-medium">Not enough data</p>
                        <p className="text-xs text-muted-foreground">
                          The session didn&apos;t have enough conversation to generate an avatar.
                        </p>
                      </>
                    ) : (
                      <>
                        <CircleNotch size={40} className="animate-spin text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground font-medium">Generating avatar...</p>
                        <p className="text-xs text-muted-foreground">
                          This usually takes a few minutes.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-muted-foreground">
                    {waitingTimedOut ? 'Empty Session' : 'New Session'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {waitingTimedOut ? 'You can delete this session' : 'Processing your session'}
                  </p>
                </div>
                
                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                  onClick={() => {
                    setIsWaitingForSession(false);
                    setWaitingTimedOut(false);
                  }}
                  title="Delete session"
                >
                  <Trash size={16} />
                </Button>
              </div>
            )}
            {sessions.map((session) => (
              <SessionCard 
                key={session.session_id} 
                session={session} 
                onSessionUpdated={refetch}
                onResumeSession={onResumeSession}
                isFreeTierExceeded={billingInfo?.is_exceeded ?? false}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

