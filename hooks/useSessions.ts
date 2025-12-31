import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export interface Session {
  session_id: string;
  user_id: string;
  created_at: string;
  main_topic: string | null;
  hot_take_1: string | null;
  hot_take_video_1_url: string | null;
  social_post_draft: string | null;
  avatar_image_url: string | null;
  share_token: string | null;
}

export default function useSessions(shouldFetch: boolean = true) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get the user's session token
      const supabase = getSupabaseClient();
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found - user may not be authenticated');
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      console.log('Fetching sessions from API...');

      // Fetch sessions from API
      const response = await fetch('/api/sessions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const data = await response.json();
      console.log('Sessions fetched:', data.sessions?.length || 0, 'sessions');
      setSessions(data.sessions || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shouldFetch) {
      fetchSessions();
    }
  }, [shouldFetch, fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}

