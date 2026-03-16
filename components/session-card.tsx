'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowClockwise,
  ArrowsLeftRight,
  Check,
  CircleNotch,
  Copy,
  DownloadSimple,
  Envelope,
  PencilSimple,
  Trash,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
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
import { Button } from '@/components/ui/button';
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

export const SessionCard = ({
  session,
  onSessionUpdated,
  onResumeSession,
  isFreeTierExceeded = false,
}: SessionCardProps) => {
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

  // Avatar type toggle (photorealistic vs cartoon)
  const [isTogglingAvatarType, setIsTogglingAvatarType] = useState(false);
  const [avatarTypeError, setAvatarTypeError] = useState<string | null>(null);

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
  const [socialPostText, setSocialPostText] = useState(
    generateSocialPostText(session.main_topic, session.share_token)
  );

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

  // Track is_hot_take_pending transitions to detect job completion on the server.
  const prevIsHotTakePending = useRef(session.is_hot_take_pending);

  // Sync generation state with server-side session data.
  // is_hot_take_pending is the authoritative server state for whether a job is running.
  useEffect(() => {
    if (session.is_hot_take_pending) {
      prevIsHotTakePending.current = true;
      // Server says a job is pending. If local state doesn't reflect this, update it.
      if (generation.status === 'idle') {
        setGeneration((prev) => ({ ...prev, status: 'polling', error: null }));
      }
    } else if (prevIsHotTakePending.current) {
      // is_hot_take_pending went from true → false: job finished on the server.
      prevIsHotTakePending.current = false;
      if (generation.status === 'polling' || generation.status === 'generating') {
        setGeneration({ status: 'idle', jobId: null, error: null });
      }
    }
  }, [session.is_hot_take_pending, generation.status]);

  // Auto-generate share token on mount if it doesn't exist
  const hasAttemptedAutoCreate = useRef(false);
  useEffect(() => {
    const createShareIfNeeded = async () => {
      if (!hasAttemptedAutoCreate.current && !session.share_token && !isCreatingShare) {
        hasAttemptedAutoCreate.current = true;
        setIsCreatingShare(true);
        try {
          const supabase = getSupabaseClient();
          const {
            data: { session: authSession },
          } = await supabase.auth.getSession();

          if (!authSession) {
            console.error('Not authenticated');
            return;
          }

          const response = await fetch('/api/avatar-share/create', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authSession.access_token}`,
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
  }, [session.share_token, session.session_id, isCreatingShare]);

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
              error:
                ((payload.new as Record<string, unknown>).error as string) ||
                'Video generation failed',
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
            const {
              data: { session: authSession },
            } = await supabase.auth.getSession();
            if (!authSession || cancelled) return;

            const response = await fetch(`/api/hot-take/status/${jobId}`, {
              headers: { Authorization: `Bearer ${authSession.access_token}` },
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
              const {
                data: { session: authSession },
              } = await supabase.auth.getSession();
              if (!authSession || cancelled) return;

              const response = await fetch(`/api/hot-take/status/${jobId}`, {
                headers: { Authorization: `Bearer ${authSession.access_token}` },
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
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

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
          Authorization: `Bearer ${authSession.access_token}`,
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

      // Refetch sessions so is_hot_take_pending becomes true in the session data.
      // This persists the "generating" state across component remounts (e.g. HMR)
      // and starts the dashboard auto-poll so completion is detected even without Realtime.
      onSessionUpdated?.();
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
  const isGeneratingVideo =
    generation.status === 'generating' ||
    generation.status === 'polling' ||
    session.is_hot_take_pending;
  const canDelete = !isCreatingShare && !isGeneratingVideo && !isDeleting;

  // Handle session deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${session.session_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
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
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        setTitleError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/sessions/${session.session_id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
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

  // Toggle photorealistic vs cartoon avatar for session card and chat/hot take
  const handleToggleAvatarType = async () => {
    setAvatarTypeError(null);
    setIsTogglingAvatarType(true);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        setAvatarTypeError('Not authenticated');
        return;
      }

      const newValue = !session.use_hedra_photo_avatar;
      const response = await fetch(`/api/sessions/${session.session_id}/avatar-type`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ use_hedra_photo_avatar: newValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAvatarTypeError(data.error || 'Failed to update avatar type');
        return;
      }

      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (error) {
      console.error('Error toggling avatar type:', error);
      setAvatarTypeError(error instanceof Error ? error.message : 'Failed to update avatar type');
    } finally {
      setIsTogglingAvatarType(false);
    }
  };

  const renderHotTakeSection = () => {
    const isGenerating =
      generation.status === 'generating' ||
      generation.status === 'polling' ||
      session.is_hot_take_pending;

    return (
      <div className="space-y-2">
        <label className="text-muted-foreground text-sm font-medium">Social Media Video</label>
        <textarea
          value={hotTakeText}
          onChange={(e) => setHotTakeText(e.target.value)}
          disabled={isGenerating}
          className="border-border bg-background focus:ring-ring min-h-[80px] w-full resize-y rounded-md border p-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
          placeholder="Enter social media video text..."
        />

        {generation.error && <p className="text-destructive text-xs">{generation.error}</p>}

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
                {generation.status === 'generating' ? 'Starting...' : 'Processing...'}
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
    <div className="group bg-card border-border overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
      {/* Avatar Image with Delete Button */}
      <div className="bg-muted relative flex aspect-square items-center justify-center">
        {session.avatar_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.avatar_image_url} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <div className="space-y-3 px-4 text-center">
            <CircleNotch size={40} className="text-muted-foreground mx-auto animate-spin" />
            <p className="text-muted-foreground text-sm font-medium">Generating avatar...</p>
            <p className="text-muted-foreground text-xs">This usually takes a few minutes.</p>
          </div>
        )}

        {/* Edit Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 left-2 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
          onClick={() => router.push(`/edit-avatar/${session.session_id}`)}
          title="Create new avatar image"
        >
          <PencilSimple size={16} />
        </Button>

        {/* Photorealistic avatar toggle - only when avatar is ready */}
        {session.avatar_image_url && (
          <Button
            variant={session.use_hedra_photo_avatar ? 'default' : 'secondary'}
            size="icon"
            className="absolute top-2 left-12 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
            onClick={handleToggleAvatarType}
            disabled={isTogglingAvatarType}
            title={
              session.use_hedra_photo_avatar
                ? 'Using photorealistic avatar (click to use cartoon)'
                : 'Use photorealistic avatar'
            }
          >
            {isTogglingAvatarType ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <ArrowsLeftRight size={16} weight={session.use_hedra_photo_avatar ? 'bold' : 'regular'} />
            )}
          </Button>
        )}
        {avatarTypeError && (
          <p className="text-destructive absolute right-2 bottom-2 left-2 text-center text-xs">
            {avatarTypeError}
          </p>
        )}

        {/* Delete Button */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
              disabled={!canDelete}
              title={
                !canDelete ? 'Cannot delete while operations are in progress' : 'Delete session'
              }
            >
              <Trash size={16} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The session data and all chat sessions using this
                avatar will be permanently deleted.
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
      <div className="space-y-4 p-4">
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
                className="border-border bg-background focus:ring-ring w-full rounded-md border p-2 text-lg font-semibold focus:ring-2 focus:outline-none disabled:opacity-50"
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
              {titleError && <p className="text-destructive text-xs">{titleError}</p>}
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
              <h3 className="line-clamp-2 pr-8 text-lg font-semibold">
                {session.main_topic || 'Untitled Session'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-6 w-6 opacity-0 transition-opacity group-hover/title:opacity-100 hover:opacity-100"
                onClick={() => setIsEditingTitle(true)}
                title="Edit title"
              >
                <PencilSimple size={14} />
              </Button>
            </div>
          )}
          <div className="text-muted-foreground text-lg font-semibold">
            {formatDate(session.updated_at || session.created_at)}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            Total Minutes Seekers Spoke To Avatar:{' '}
            {Math.round((session.total_chat_duration_seconds || 0) / 60)}
            {isFreeTierExceeded && (
              <span className="bg-destructive/10 text-destructive ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                Limit reached
              </span>
            )}
          </div>
        </div>

        {/* Social Media Video */}
        {renderHotTakeSection()}

        {/* Social Post */}
        <div className="space-y-2">
          <label className="text-muted-foreground text-sm font-medium">Social Media Post</label>
          <textarea
            value={socialPostText}
            onChange={(e) => setSocialPostText(e.target.value)}
            className="border-border bg-background focus:ring-ring min-h-[80px] w-full resize-y rounded-md border p-2 text-sm focus:ring-2 focus:outline-none"
            placeholder="Social media post text..."
          />
          <Button variant="outline" size="sm" className="w-full" onClick={handleCopyPost}>
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
            variant={session.unread_message_count > 0 ? 'default' : 'outline'}
            size="sm"
            className="relative"
            onClick={() => onResumeSession?.(session.session_id)}
            title={
              session.unread_message_count > 0
                ? `${session.unread_message_count} unread message${session.unread_message_count !== 1 ? 's' : ''}`
                : 'No new messages'
            }
          >
            <Envelope size={16} />
            {session.unread_message_count > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-bold">
                {session.unread_message_count > 99 ? '99+' : session.unread_message_count}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
