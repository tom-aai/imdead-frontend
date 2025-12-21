'use client';

import { DownloadSimple, User } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { Session } from '@/hooks/useSessions';

interface SessionCardProps {
  session: Session;
}

export const SessionCard = ({ session }: SessionCardProps) => {
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

        {/* Interactive Avatar (Placeholder) */}
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled
        >
          Interactive Avatar (Coming Soon)
        </Button>
      </div>
    </div>
  );
};

