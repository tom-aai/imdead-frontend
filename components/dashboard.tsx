'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SessionCard } from '@/components/session-card';
import useSessions from '@/hooks/useSessions';
import { CircleNotch } from '@phosphor-icons/react';

interface DashboardProps {
  disabled: boolean;
  onCreateNew: () => void;
}

export const Dashboard = ({
  disabled,
  onCreateNew,
  ref,
}: React.ComponentProps<'div'> & DashboardProps) => {
  const { sessions, loading, error, refetch } = useSessions(!disabled);

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
      console.log(`[Dashboard] Displaying ${sessions.length} sessions`);
    }
  }, [sessions, loading]);

  return (
    <section
      ref={ref}
      inert={disabled}
      className={cn(
        'bg-background fixed inset-0 flex flex-col overflow-auto',
        disabled ? 'z-10' : 'z-20'
      )}
    >
      {/* Header with Create + button */}
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
          <Button 
            variant="primary" 
            size="lg" 
            onClick={onCreateNew}
            className="font-mono"
          >
            create +
          </Button>
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
              <p className="text-muted-foreground text-lg">No sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Click "create +" to start your first session
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <SessionCard 
                key={session.session_id} 
                session={session} 
                onSessionUpdated={refetch}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

