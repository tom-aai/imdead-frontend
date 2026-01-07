'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, User, Link as LinkIcon, Copy, Check, VideoCamera, CircleNotch, Trash, PencilSimple, X, ArrowClockwise } from '@phosphor-icons/react';
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
  onShareCreated?: (sessionId: string, shareToken: string) => void;
  onSessionUpdated?: () => void;
  onResumeSession?: (sessionId: string) => void;
}

type GenerationStatus = 'idle' | 'generating' | 'polling' | 'completed' | 'failed';

interface GenerationState {
  status: GenerationStatus;
  jobId: string | null;
  error: string | null;
}

export const SessionCard = ({ session, onShareCreated, onSessionUpdated, onResumeSession }: SessionCardProps) => {
  const router = useRouter();
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
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

  // Social post text state - generated from main_topic
  const generateSocialPostText = (mainTopic: string | null) => {
    if (!mainTopic) return '';
    return `I trained my avatar on ${mainTopic}. Click on the link to talk to my expert avatar!`;
  };
  const [socialPostText, setSocialPostText] = useState(generateSocialPostText(session.main_topic));

  // Generation state for hot take
  const [generation, setGeneration] = useState<GenerationState>({
    status: 'idle',
    jobId: null,
    error: null,
  });

  // Update local state when session prop changes
  useEffect(() => {
    setHotTakeText(session.hot_take_1 || '');
    setSocialPostText(generateSocialPostText(session.main_topic));
    setLocalShareToken(session.share_token);
    setEditedTitle(session.main_topic || '');
  }, [session.hot_take_1, session.main_topic, session.share_token]);

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
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.share_url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);

      // Notify parent
      if (onShareCreated) {
        onShareCreated(session.session_id, data.share_token);
      }
    } catch (error) {
      console.error('Error creating share:', error);
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopyLink = async () => {
    if (!localShareToken) return;
    
    const shareUrl = `${window.location.origin}/chat/${localShareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  // Poll for job status
  const pollJobStatus = useCallback(async (
    jobId: string,
    setGenerationState: React.Dispatch<React.SetStateAction<GenerationState>>
  ) => {
    const supabase = getSupabaseClient();
    const { data: { session: authSession } } = await supabase.auth.getSession();

    if (!authSession) {
      setGenerationState({
        status: 'failed',
        jobId: null,
        error: 'Not authenticated',
      });
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/hot-take/status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${authSession.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get job status');
        }

        const data = await response.json();

        if (data.status === 'completed') {
          setGenerationState({
            status: 'completed',
            jobId: null,
            error: null,
          });
          // Notify parent to refresh sessions
          if (onSessionUpdated) {
            onSessionUpdated();
          }
          return;
        } else if (data.status === 'failed') {
          setGenerationState({
            status: 'failed',
            jobId: null,
            error: data.error || 'Video generation failed',
          });
          return;
        } else {
          // Still processing, poll again after 3 seconds
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        setGenerationState({
          status: 'failed',
          jobId: null,
          error: 'Failed to check job status',
        });
      }
    };

    poll();
  }, [onSessionUpdated]);

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

      // Job enqueued, start polling
      setGeneration({
        status: 'polling',
        jobId: data.job_id,
        error: null,
      });

      pollJobStatus(data.job_id, setGeneration);
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
          <User size={64} className="text-muted-foreground" />
        )}
        
        {/* Edit Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
          onClick={() => router.push(`/edit-avatar/${session.session_id}`)}
          title="Edit avatar"
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
        </div>

        {/* Resume Session Button */}
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onResumeSession?.(session.session_id)}
        >
          <ArrowClockwise size={16} className="mr-2" />
          Resume Session
        </Button>

        {/* Interactive Avatar - Share Button */}
        {localShareToken ? (
          // Share exists - show share button
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleCopyLink}
          >
            {justCopied ? (
              <>
                <Check size={16} className="mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} className="mr-2" />
                SHARE AVATAR
              </>
            )}
          </Button>
        ) : (
          // No share yet - show create button
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleCreateShare}
            disabled={isCreatingShare}
          >
            {isCreatingShare ? (
              'Creating...'
            ) : (
              <>
                <LinkIcon size={16} className="mr-2" />
                Create Avatar Link
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
