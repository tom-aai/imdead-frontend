'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, User, Link as LinkIcon, Copy, Check, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { Session } from '@/hooks/useSessions';
import { getSupabaseClient } from '@/lib/supabase';

interface SessionCardProps {
  session: Session;
  onShareCreated?: (sessionId: string, shareToken: string) => void;
}

export const SessionCard = ({ session, onShareCreated }: SessionCardProps) => {
  const router = useRouter();
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [localShareToken, setLocalShareToken] = useState<string | null>(session.share_token);

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
      <div className="p-4 space-y-3">
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

        {/* Hot Take Videos */}
        <div className="space-y-2">
          {session.hot_take_video_1_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() =>
                handleDownload(
                  session.hot_take_video_1_url!,
                  `hot_take_1_${session.session_id}.mp4`
                )
              }
            >
              <DownloadSimple size={16} className="mr-2" />
              Hot Take Video 1
            </Button>
          )}
          {session.hot_take_video_2_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() =>
                handleDownload(
                  session.hot_take_video_2_url!,
                  `hot_take_2_${session.session_id}.mp4`
                )
              }
            >
              <DownloadSimple size={16} className="mr-2" />
              Hot Take Video 2
            </Button>
          )}
        </div>

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
