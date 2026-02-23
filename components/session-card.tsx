'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, Copy, Check, VideoCamera, CircleNotch, Trash, PencilSimple, X, ArrowClockwise, Envelope } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
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
import type { Session } from '@/hooks/useSessions';
import { getSupabaseClient } from '@/lib/supabase';

interface SessionCardProps {
  session: Session;
  onSessionUpdated?: () => void;
  onResumeSession?: (sessionId: string) => void;
  isFreeTierExceeded?: boolean;
}

type GenerationStatus = 'idle' | 'generating' | 'polling' | 'completed' | 'failed';

interface GenerationState {
  status: GenerationStatus;
  jobId: string | null;
  error: string | null;
}


export const SessionCard = ({ session, onSessionUpdated, onResumeSession, isFreeTierExceeded = false }: SessionCardProps) => {
  const router = useRouter();
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [justCopiedPost, setJustCopiedPost] = useState(false);
  const [localShareToken, setLocalShareToken] = useState<string | null>(session.share_token);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.main_topic || '');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Hot take text state
  const [hotTakeText, setHotTakeText] = useState(session.hot_take_1 || '');

  // Social post text state - generated from main_topic and share URL
  const generateSocialPostText = (mainTopic: string | null, shareToken: string | null) => {
    if (!mainTopic) return '';
    const baseText = `I trained my avatar on ${mainTopic}. Click on the link to talk to my Expert Avatar!`;
    if (shareToken) {
      const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/chat/${shareToken}`;
      return `${baseText} ${shareUrl}`;
    }
    return baseText;
  };
  const [socialPostText, setSocialPostText] = useState(generateSocialPostText(session.main_topic, session.share_token));

  // Generation state for hot take
  // Initialize from session's pending status (handles page refresh while video is generating)
  const [generation, setGeneration] = useState<GenerationState>({
    status: session.is_hot_take_pending ? 'polling' : 'idle',
    jobId: null,
    error: null,
  });

  // Update local state when session prop changes
  useEffect(() => {
    setHotTakeText(session.hot_take_1 || '');
    setLocalShareToken(session.share_token);
    setEditedTitle(session.main_topic || '');
    setSocialPostText(generateSocialPostText(session.main_topic, session.share_token));
  }, [session.hot_take_1, session.main_topic, session.share_token]);

  // Auto-clear generation state when video URL appears (from dashboard polling)
  // or sync with backend pending status on refresh
  useEffect(() => {
    if (session.hot_take_video_1_url && (generation.status === 'polling' || generation.status === 'generating')) {
      // Video is ready — clear the "processing" state
      setGeneration({ status: 'completed', jobId: null, error: null });
    } else if (session.is_hot_take_pending && generation.status === 'idle') {
      // Backend reports a pending job but our local state is idle (e.g. page refresh)
      setGeneration({ status: 'polling', jobId: null, error: null });
    } else if (!session.is_hot_take_pending && generation.status === 'polling' && !generation.jobId) {
      // Backend no longer reports pending, and we have no local jobId tracking —
      // the job must have completed or failed. Refresh to pick up the result.
      setGeneration({ status: 'idle', jobId: null, error: null });
    }
  }, [session.hot_take_video_1_url, session.is_hot_take_pending, generation.status, generation.jobId]);

  // Auto-generate share token on mount if it doesn't exist
  const hasAttemptedAutoCreate = useRef(false);
  useEffect(() => {
    const createShareIfNeeded = async () => {
      if (!hasAttemptedAutoCreate.current && !session.share_token && !isCreatingShare) {
        hasAttemptedAutoCreate.current = true;
        setIsCreatingShare(true);
        try {
          const supabase = getSupabaseClient();
          const { data: { session: authSession } } = await supabase.auth.getSession();

          if (!authSession) {
            console.error('Not authenticated');
            return;
          }

          const response = await fetch('/api/avatar-share/create', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authSession.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: session.session_id }),
          });

          if (!response.ok) {
            throw new Error('Failed to create share link');
          }

          const data = await response.json();
          setLocalShareToken(data.share_token);
        } catch (error) {
          console.error('Error creating share:', error);
        } finally {
          setIsCreatingShare(false);
        }
      }
    };
    createShareIfNeeded();
  }, [session.share_token, session.session_id]);

  // Update social post text when share token changes
  useEffect(() => {
    setSocialPostText(generateSocialPostText(session.main_topic, localShareToken));
  }, [localShareToken, session.main_topic]);

  // Format the date as "Month Day, Year, Hour:Minute AM/PM"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleViewText = (text: string, title: string) => {
    // Open text in a new window for viewing/copying
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 20px;
              }
              .content {
                white-space: pre-wrap;
                background: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="content">${text}</div>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  const handleCreateShare = async () => {
    setIsCreatingShare(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/avatar-share/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: session.session_id }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const data = await response.json();
      setLocalShareToken(data.share_token);
    } catch (error) {
      console.error('Error creating share:', error);
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopyPost = async () => {
    await navigator.clipboard.writeText(socialPostText);
    setJustCopiedPost(true);
    setTimeout(() => setJustCopiedPost(false), 2000);
  };

  // Stable ref for onSessionUpdated to avoid re-subscribing on every render
  const onSessionUpdatedRef = useRef(onSessionUpdated);
  useEffect(() => {
    onSessionUpdatedRef.current = onSessionUpdated;
  }, [onSessionUpdated]);

  // Subscribe to Supabase Realtime for job status updates (replaces polling)
  useEffect(() => {
    if (!generation.jobId || generation.status !== 'polling') return;

    const supabase = getSupabaseClient();
    const jobId = generation.jobId;
    let cancelled = false;

    console.log(`[Realtime] Subscribing to job ${jobId}`);

    const channel = supabase
      .channel(`hot-take-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_call_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (cancelled) return;
          const newStatus = (payload.new as Record<string, unknown>).status as string;
          console.log(`[Realtime] Job ${jobId} status changed: ${newStatus}`);

          if (newStatus === 'completed') {
            setGeneration({ status: 'completed', jobId: null, error: null });
            onSessionUpdatedRef.current?.();
          } else if (newStatus === 'failed') {
            setGeneration({
              status: 'failed',
              jobId: null,
              error: ((payload.new as Record<string, unknown>).error as string) || 'Video generation failed',
            });
          }
        }
      )
      .subscribe(async (status) => {
        if (cancelled) return;

        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to job ${jobId}, doing initial status check`);

          // One-time status check in case job completed before subscription was established
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (!authSession || cancelled) return;

            const response = await fetch(`/api/hot-take/status/${jobId}`, {
              headers: { 'Authorization': `Bearer ${authSession.access_token}` },
            });

            if (!response.ok || cancelled) return;

            const data = await response.json();
            if (data.status === 'completed') {
              setGeneration({ status: 'completed', jobId: null, error: null });
              onSessionUpdatedRef.current?.();
            } else if (data.status === 'failed') {
              setGeneration({
                status: 'failed',
                jobId: null,
                error: data.error || 'Video generation failed',
              });
            }
          } catch (error) {
            console.error('[Realtime] Initial status check failed:', error);
            // Non-fatal — Realtime subscription will still deliver updates
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Subscription issue (${status}), falling back to single poll`);
          // Fallback: do a one-time check after 10 seconds, then every 30 seconds
          const fallbackPoll = async () => {
            if (cancelled) return;
            try {
              const { data: { session: authSession } } = await supabase.auth.getSession();
              if (!authSession || cancelled) return;

              const response = await fetch(`/api/hot-take/status/${jobId}`, {
                headers: { 'Authorization': `Bearer ${authSession.access_token}` },
              });

              if (!response.ok || cancelled) return;

              const data = await response.json();
              if (data.status === 'completed') {
                setGeneration({ status: 'completed', jobId: null, error: null });
                onSessionUpdatedRef.current?.();
              } else if (data.status === 'failed') {
                setGeneration({
                  status: 'failed',
                  jobId: null,
                  error: data.error || 'Video generation failed',
                });
              } else if (!cancelled) {
                // Still processing, check again in 30 seconds (much less than 3s polling)
                setTimeout(fallbackPoll, 30000);
              }
            } catch {
              if (!cancelled) setTimeout(fallbackPoll, 30000);
            }
          };
          setTimeout(fallbackPoll, 10000);
        }
      });

    return () => {
      cancelled = true;
      console.log(`[Realtime] Unsubscribing from job ${jobId}`);
      supabase.removeChannel(channel);
    };
  }, [generation.jobId, generation.status]);

  // Handle generate hot take video
  const handleGenerateHotTake = async () => {
    if (!hotTakeText.trim()) {
      setGeneration({
        status: 'failed',
        jobId: null,
        error: 'Hot take text is required',
      });
      return;
    }

    setGeneration({
      status: 'generating',
      jobId: null,
      error: null,
    });

    try {
      const supabase = getSupabaseClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        setGeneration({
          status: 'failed',
          jobId: null,
          error: 'Not authenticated',
        });
        return;
      }

      const response = await fetch('/api/hot-take/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.session_id,
          hot_take_text: hotTakeText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      // Job enqueued — Realtime subscription will handle status updates automatically
      setGeneration({
        status: 'polling',
        jobId: data.job_id,
        error: null,
      });
    } catch (error) {
      console.error('Error generating hot take:', error);
      setGeneration({
        status: 'failed',
        jobId: null,
        error: error instanceof Error ? error.message : 'Failed to generate video',
      });
    }
  };

  // Check if deletion is allowed (not during active operations)
  const isGeneratingVideo = generation.status === 'generating' || generation.status === 'polling';
  const canDelete = !isCreatingShare && !isGeneratingVideo && !isDeleting;

  // Handle session deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete session');
      }

      // Close dialog and notify parent to refresh
      setDeleteDialogOpen(false);
      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      // Keep dialog open on error so user can try again
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle title save
  const handleSaveTitle = async () => {
    const trimmedTitle = editedTitle.trim();
    
    if (!trimmedTitle) {
      setTitleError('Title cannot be empty');
      return;
    }

    // If no change, just exit edit mode
    if (trimmedTitle === session.main_topic) {
      setIsEditingTitle(false);
      setTitleError(null);
      return;
    }

    setIsSavingTitle(true);
    setTitleError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession) {
        setTitleError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${session.session_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ main_topic: trimmedTitle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update title');
      }

      // Success - exit edit mode and refresh
      setIsEditingTitle(false);
      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (error) {
      console.error('Error updating title:', error);
      setTitleError(error instanceof Error ? error.message : 'Failed to update title');
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Handle cancel title edit
  const handleCancelTitleEdit = () => {
    setEditedTitle(session.main_topic || '');
    setIsEditingTitle(false);
    setTitleError(null);
  };

  const renderHotTakeSection = () => {
    const isGenerating = generation.status === 'generating' || generation.status === 'polling';
    
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Social Media Video
        </label>
        <textarea
          value={hotTakeText}
          onChange={(e) => setHotTakeText(e.target.value)}
          disabled={isGenerating}
          className="w-full min-h-[80px] p-2 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder="Enter social media video text..."
        />
        
        {generation.error && (
          <p className="text-xs text-destructive">{generation.error}</p>
        )}
        
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => handleGenerateHotTake()}
            disabled={isGenerating || !hotTakeText.trim()}
          >
            {isGenerating ? (
              <>
                <CircleNotch size={16} className="mr-2 animate-spin" />
                {generation.status === 'polling' ? 'Processing...' : 'Starting...'}
              </>
            ) : (
              <>
                <VideoCamera size={16} className="mr-2" />
                Generate Video
              </>
            )}
          </Button>
          
          {session.hot_take_video_1_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleDownload(
                  session.hot_take_video_1_url!,
                  `social_video_${session.session_id}.mp4`
                )
              }
            >
              <DownloadSimple size={16} />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="group bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Avatar Image with Delete Button */}
      <div className="relative aspect-square bg-muted flex items-center justify-center">
        {session.avatar_image_url ? (
          <img
            src={session.avatar_image_url}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center space-y-3 px-4">
            <CircleNotch size={40} className="animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-medium text-sm">Generating avatar...</p>
            <p className="text-xs text-muted-foreground">
              This usually takes a few minutes.
            </p>
          </div>
        )}
        
        {/* Edit Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
          onClick={() => router.push(`/edit-avatar/${session.session_id}`)}
          title="Create new avatar image"
        >
          <PencilSimple size={16} />
        </Button>

        {/* Delete Button */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
              disabled={!canDelete}
              title={!canDelete ? 'Cannot delete while operations are in progress' : 'Delete session'}
            >
              <Trash size={16} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The session data and all chat sessions using this avatar will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
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

      {/* Card Content */}
      <div className="p-4 space-y-4">
        {/* Main Topic and Date */}
        <div>
          {isEditingTitle ? (
            // Edit mode
            <div className="space-y-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                disabled={isSavingTitle}
                className="w-full p-2 text-lg font-semibold border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                placeholder="Enter session title..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTitle();
                  } else if (e.key === 'Escape') {
                    handleCancelTitleEdit();
                  }
                }}
              />
              {titleError && (
                <p className="text-xs text-destructive">{titleError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle}
                >
                  {isSavingTitle ? (
                    <>
                      <CircleNotch size={14} className="mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} className="mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelTitleEdit}
                  disabled={isSavingTitle}
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Display mode with hover edit button
            <div className="group/title relative">
              <h3 className="font-semibold text-lg line-clamp-2 pr-8">
                {session.main_topic || 'Untitled Session'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover/title:opacity-100 hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingTitle(true)}
                title="Edit title"
              >
                <PencilSimple size={14} />
              </Button>
            </div>
          )}
          <div className="font-semibold text-lg text-muted-foreground">
            {formatDate(session.updated_at || session.created_at)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Total Minutes Seekers Spoke To Avatar: {Math.round((session.total_chat_duration_seconds || 0) / 60)}
            {isFreeTierExceeded && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded">
                Limit reached
              </span>
            )}
          </div>
        </div>

        {/* Social Media Video */}
        {renderHotTakeSection()}

        {/* Social Post */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Social Media Post
          </label>
          <textarea
            value={socialPostText}
            onChange={(e) => setSocialPostText(e.target.value)}
            className="w-full min-h-[80px] p-2 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Social media post text..."
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleCopyPost}
          >
            {justCopiedPost ? (
              <>
                <Check size={16} className="mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} className="mr-2" />
                Copy Post
              </>
            )}
          </Button>
        </div>

        {/* Resume Session Button with Message Badge */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onResumeSession?.(session.session_id)}
          >
            <ArrowClockwise size={16} className="mr-2" />
            Resume Session
          </Button>
          
          {/* Message Indicator Button */}
          <Button
            variant={session.unread_message_count > 0 ? "default" : "outline"}
            size="sm"
            className="relative"
            onClick={() => onResumeSession?.(session.session_id)}
            title={session.unread_message_count > 0 ? `${session.unread_message_count} unread message${session.unread_message_count !== 1 ? 's' : ''}` : 'No new messages'}
          >
            <Envelope size={16} />
            {session.unread_message_count > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {session.unread_message_count > 99 ? '99+' : session.unread_message_count}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
