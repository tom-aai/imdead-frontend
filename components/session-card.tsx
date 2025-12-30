'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, User, Link as LinkIcon, Copy, Check, Play, VideoCamera, CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { Session } from '@/hooks/useSessions';
import { getSupabaseClient } from '@/lib/supabase';

interface SessionCardProps {
  session: Session;
  onShareCreated?: (sessionId: string, shareToken: string) => void;
  onSessionUpdated?: () => void;
}

type GenerationStatus = 'idle' | 'generating' | 'polling' | 'completed' | 'failed';

interface GenerationState {
  status: GenerationStatus;
  jobId: string | null;
  error: string | null;
}

export const SessionCard = ({ session, onShareCreated, onSessionUpdated }: SessionCardProps) => {
  const router = useRouter();
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [localShareToken, setLocalShareToken] = useState<string | null>(session.share_token);

  // Hot take text state
  const [hotTake1Text, setHotTake1Text] = useState(session.hot_take_1 || '');
  const [hotTake2Text, setHotTake2Text] = useState(session.hot_take_2 || '');

  // Generation state for each hot take
  const [generation1, setGeneration1] = useState<GenerationState>({
    status: 'idle',
    jobId: null,
    error: null,
  });
  const [generation2, setGeneration2] = useState<GenerationState>({
    status: 'idle',
    jobId: null,
    error: null,
  });

  // Update local state when session prop changes
  useEffect(() => {
    setHotTake1Text(session.hot_take_1 || '');
    setHotTake2Text(session.hot_take_2 || '');
    setLocalShareToken(session.share_token);
  }, [session.hot_take_1, session.hot_take_2, session.share_token]);

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

  const handleOpenAvatar = () => {
    if (!localShareToken) return;
    router.push(`/chat/${localShareToken}`);
  };

  // Poll for job status
  const pollJobStatus = useCallback(async (
    jobId: string,
    hotTakeNumber: 1 | 2,
    setGeneration: React.Dispatch<React.SetStateAction<GenerationState>>
  ) => {
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
          setGeneration({
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
          setGeneration({
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
        setGeneration({
          status: 'failed',
          jobId: null,
          error: 'Failed to check job status',
        });
      }
    };

    poll();
  }, [onSessionUpdated]);

  // Handle generate hot take video
  const handleGenerateHotTake = async (hotTakeNumber: 1 | 2) => {
    const text = hotTakeNumber === 1 ? hotTake1Text : hotTake2Text;
    const setGeneration = hotTakeNumber === 1 ? setGeneration1 : setGeneration2;

    if (!text.trim()) {
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
          hot_take_number: hotTakeNumber,
          hot_take_text: text.trim(),
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

      pollJobStatus(data.job_id, hotTakeNumber, setGeneration);
    } catch (error) {
      console.error('Error generating hot take:', error);
      setGeneration({
        status: 'failed',
        jobId: null,
        error: error instanceof Error ? error.message : 'Failed to generate video',
      });
    }
  };

  const renderHotTakeSection = (
    hotTakeNumber: 1 | 2,
    text: string,
    setText: (text: string) => void,
    generation: GenerationState,
    videoUrl: string | null
  ) => {
    const isGenerating = generation.status === 'generating' || generation.status === 'polling';
    
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Hot Take {hotTakeNumber}
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isGenerating}
          className="w-full min-h-[80px] p-2 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder={`Enter hot take ${hotTakeNumber} text...`}
        />
        
        {generation.error && (
          <p className="text-xs text-destructive">{generation.error}</p>
        )}
        
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => handleGenerateHotTake(hotTakeNumber)}
            disabled={isGenerating || !text.trim()}
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
          
          {videoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleDownload(
                  videoUrl,
                  `hot_take_${hotTakeNumber}_${session.session_id}.mp4`
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
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Avatar Image */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {session.avatar_image_url ? (
          <img
            src={session.avatar_image_url}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <User size={64} className="text-muted-foreground" />
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-4">
        {/* Main Topic */}
        <div>
          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
            {session.main_topic || 'Untitled Session'}
          </h3>
        </div>

        {/* Date */}
        <div className="text-sm text-muted-foreground">
          {formatDate(session.created_at)}
        </div>

        {/* Hot Take 1 */}
        {renderHotTakeSection(
          1,
          hotTake1Text,
          setHotTake1Text,
          generation1,
          session.hot_take_video_1_url
        )}

        {/* Hot Take 2 */}
        {renderHotTakeSection(
          2,
          hotTake2Text,
          setHotTake2Text,
          generation2,
          session.hot_take_video_2_url
        )}

        {/* Social Post Draft */}
        {session.social_post_draft && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => handleViewText(session.social_post_draft!, 'Social Post Draft')}
          >
            View Social Post
          </Button>
        )}

        {/* Interactive Avatar */}
        {localShareToken ? (
          // Share exists - show copy and open buttons
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
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
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleOpenAvatar}
            >
              <Play size={16} className="mr-2" />
              Open Avatar
            </Button>
          </div>
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
