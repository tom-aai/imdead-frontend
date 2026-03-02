import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export interface Session {
  session_id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  main_topic: string | null;
  hot_take_1: string | null;
  hot_take_video_1_url: string | null;
  avatar_image_url: string | null;
  share_token: string | null;
  unread_message_count: number;
  total_chat_duration_seconds: number;
  is_hot_take_pending: boolean;
}

export interface BillingInfo {
  used_seconds: number;
  used_minutes: number;
  free_tier_seconds: number | null;
  free_tier_minutes: number | null;
  remaining_seconds: number | null;
  remaining_minutes: number | null;
  usage_percentage: number;
  is_exceeded: boolean;
  is_warning: boolean;
  billing_status: string;
  is_admin: boolean;
  is_paid: boolean;
}

export default function useSessions(shouldFetch: boolean = true) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessingSessions, setHasProcessingSessions] = useState(false);
  const [processingSessionIds, setProcessingSessionIds] = useState<string[]>([]);
  const [skippedSessionIds, setSkippedSessionIds] = useState<string[]>([]);
  const [hasPendingAvatarUpdates, setHasPendingAvatarUpdates] = useState(false);
  const [hasPendingHotTakeVideos, setHasPendingHotTakeVideos] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const hasFetchedOnce = useRef(false);
  const hasFetchedBilling = useRef(false);

  const fetchSessions = useCallback(async () => {
    // Capture whether this is the initial load before we potentially change it
    const isInitialLoad = !hasFetchedOnce.current;

    try {
      // Only show loading spinner on initial load, not during background refreshes
      if (isInitialLoad) {
        setLoading(true);
      }

      // Get the user's session token
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.log('No session found - user may not be authenticated');
        setError('Not authenticated');
        if (isInitialLoad) {
          setLoading(false);
        }
        return;
      }

      console.log('Fetching sessions from API...');

      // Fetch sessions from API
      const response = await fetch('/api/sessions', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        'Sessions fetched:',
        data.sessions?.length || 0,
        'sessions, hasProcessingSessions:',
        data.hasProcessingSessions,
        'hasPendingAvatarUpdates:',
        data.hasPendingAvatarUpdates
      );
      setSessions(data.sessions || []);
      setHasProcessingSessions(data.hasProcessingSessions || false);
      setProcessingSessionIds(data.processingSessionIds || []);
      setSkippedSessionIds(data.skippedSessionIds || []);
      setHasPendingAvatarUpdates(data.hasPendingAvatarUpdates || false);
      setHasPendingHotTakeVideos(data.hasPendingHotTakeVideos || false);

      // Fetch billing info in the background (don't block UI)
      // Only fetch billing info once on initial load (it's slow-changing data)
      if (!hasFetchedBilling.current) {
        hasFetchedBilling.current = true; // Set immediately to prevent multiple fetches
        fetch('/api/billing/usage', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
          .then(async (billingResponse) => {
            if (billingResponse.ok) {
              const billingData = await billingResponse.json();
              setBillingInfo(billingData);
            }
          })
          .catch((billingErr) => {
            console.warn('Could not fetch billing info:', billingErr);
          });
      }

      setError(null);
      hasFetchedOnce.current = true;
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      // Only update loading state if this was the initial load
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (shouldFetch) {
      fetchSessions();
    }
  }, [shouldFetch, fetchSessions]);

  return {
    sessions,
    loading,
    error,
    hasProcessingSessions,
    processingSessionIds,
    skippedSessionIds,
    hasPendingAvatarUpdates,
    hasPendingHotTakeVideos,
    billingInfo,
    refetch: fetchSessions,
  };
}
