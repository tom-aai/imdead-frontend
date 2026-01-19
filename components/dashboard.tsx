'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { cn } from '@/lib/utils';
import { SessionCard } from '@/components/session-card';
import useSessions from '@/hooks/useSessions';
import { CircleNotch } from '@phosphor-icons/react';

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
  const { sessions, loading, error, hasProcessingSessions, hasPendingAvatarUpdates, billingInfo, refetch } = useSessions(!disabled);
  
  // Track if we're still waiting for a session to appear after just finishing one
  // This handles the race condition where interview_calls record hasn't been created yet
  const [isWaitingForSession, setIsWaitingForSession] = useState(justFinishedSession);
  
  // When we detect sessions, stop waiting
  useEffect(() => {
    if (sessions.length > 0 || hasProcessingSessions) {
      setIsWaitingForSession(false);
    }
  }, [sessions.length, hasProcessingSessions]);
  
  // Note: No timeout on isWaitingForSession - it will be set to false automatically
  // when sessions appear or hasProcessingSessions becomes true. Avatar generation
  // typically takes 3+ minutes in production.

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
      console.log(`[Dashboard] Displaying ${sessions.length} sessions, hasProcessingSessions: ${hasProcessingSessions}, hasPendingAvatarUpdates: ${hasPendingAvatarUpdates}`);
    }
  }, [sessions, loading, hasProcessingSessions, hasPendingAvatarUpdates]);

  // Auto-poll when there are processing sessions, pending avatar updates, sessions without avatar images,
  // or we're waiting for a session to appear after just finishing one
  useEffect(() => {
    if (disabled || loading) return;

    // Check if any session is missing an avatar image
    const hasMissingAvatars = sessions.some(s => !s.avatar_image_url);
    
    // Poll if there are processing sessions, pending avatar updates, sessions with missing avatars,
    // or we're waiting for a session to appear (handles race condition after finishing a session)
    const shouldPoll = hasProcessingSessions || hasPendingAvatarUpdates || hasMissingAvatars || isWaitingForSession;
    
    if (!shouldPoll) return;

    console.log('[Dashboard] Starting auto-poll for processing sessions, avatar updates, missing avatars, or waiting for session');
    
    const pollInterval = setInterval(() => {
      console.log('[Dashboard] Auto-polling for updates...');
      refetch();
    }, 5000); // Poll every 5 seconds

    return () => {
      console.log('[Dashboard] Stopping auto-poll');
      clearInterval(pollInterval);
    };
  }, [disabled, loading, hasProcessingSessions, hasPendingAvatarUpdates, sessions, isWaitingForSession, refetch]);

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
              {hasProcessingSessions || isWaitingForSession ? (
                <>
                  <CircleNotch size={32} className="animate-spin text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground text-lg">Your avatar is being generated.</p>
                  <p className="text-sm text-muted-foreground">
                    This usually takes about a minute.
                  </p>
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

