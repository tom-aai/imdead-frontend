import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0; // Don't cache the results

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    console.log('[Sessions API] Request received, auth header present:', !!authHeader);

    if (!authHeader) {
      console.log('[Sessions API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key for server-side queries
    // Service key bypasses RLS and is safe here since this is a server-only API route
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication (this gives us the auth user ID)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('[Sessions API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Sessions API] Auth user authenticated:', user.id);
    console.log('[Sessions API] Auth user email:', user.email);

    // Use the auth user.id as the user_id for querying
    // The same UUID is used across auth, interview_calls, and user_profile tables
    const userId = user.id;
    console.log('[Sessions API] Using user_id:', userId);

    // Query interview_call_analysis for this user's sessions
    // interview_call_analysis is the source of truth for both hedra_avatar_id and cartoon_id
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_call_analysis')
      .select(
        `
        session_id, 
        user_id, 
        created_at,
        updated_at,
        main_topic, 
        hot_take_1,
        hot_take_video_1,
        cartoon_id,
        use_hedra_photo_avatar
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const sessionIds = sessions?.map((s) => s.session_id) || [];
    const { data: shareTokens } = await supabase
      .from('avatar_share_tokens')
      .select('session_id, share_token')
      .in('session_id', sessionIds)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    // Create a map for quick lookup
    const shareTokenMap = new Map<string, string>();
    shareTokens?.forEach((token) => {
      shareTokenMap.set(token.session_id, token.share_token);
    });

    // Fetch picture_id (original photo) from interview_calls for avatar URL when use_hedra_photo_avatar is true
    const { data: interviewCalls } = await supabase
      .from('interview_calls')
      .select('session_id, picture_id')
      .in('session_id', sessionIds);
    const pictureIdBySessionId = new Map<string, string>();
    interviewCalls?.forEach((row) => {
      if (row.picture_id) {
        pictureIdBySessionId.set(row.session_id, row.picture_id);
      }
    });

    // Fetch unread message counts for each session
    const { data: messageCounts } = await supabase
      .from('seeker_messages')
      .select('source_session_id')
      .in('source_session_id', sessionIds)
      .eq('status', 'pending');

    // Create a map for unread message counts
    const unreadCountMap = new Map<string, number>();
    messageCounts?.forEach((msg) => {
      const currentCount = unreadCountMap.get(msg.source_session_id) || 0;
      unreadCountMap.set(msg.source_session_id, currentCount + 1);
    });

    // Fetch chat session durations for each source session
    // We sum up stt_audio_duration from the usage JSONB field
    const { data: chatDurations } = await supabase
      .from('chat_sessions')
      .select('source_session_id, usage')
      .in('source_session_id', sessionIds);

    // Create a map for total chat duration per session
    const chatDurationMap = new Map<string, number>();
    chatDurations?.forEach((chat) => {
      const sourceSessionId = chat.source_session_id;
      const sttDuration = chat.usage?.stt_audio_duration || 0;
      const currentTotal = chatDurationMap.get(sourceSessionId) || 0;
      chatDurationMap.set(sourceSessionId, currentTotal + sttDuration);
    });

    if (sessionsError) {
      console.error('[Sessions API] Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    console.log(`[Sessions API] Found ${sessions?.length || 0} sessions for user_id ${userId}`);

    // Check if there are any interview_calls that don't have a corresponding interview_call_analysis
    // This indicates sessions that are still being processed.
    // Exclude resume sessions (call_type = 'resume') since they never create their own
    // interview_call_analysis — their conversation is appended to the original session instead.
    const { data: pendingCalls, error: pendingError } = await supabase
      .from('interview_calls')
      .select('session_id, call_type')
      .eq('user_id', userId)
      .neq('call_type', 'resume');

    if (pendingError) {
      console.error(`[Sessions API] Error fetching pending calls:`, pendingError);
    }
    console.log(`[Sessions API] Found ${pendingCalls?.length || 0} total interview_calls for user`);

    const analysisSessionIds = new Set(sessions?.map((s) => s.session_id) || []);
    const processingSessionIds =
      pendingCalls?.filter((call) => !analysisSessionIds.has(call.session_id)) || [];
    const hasProcessingSessions = processingSessionIds.length > 0;

    console.log(`[Sessions API] Found ${processingSessionIds.length} sessions still processing`);

    // Check for skipped sessions: completed post_call jobs with result.status = 'skipped'.
    // Query using ALL interview_calls for this user (not just pending ones), because
    // the job may complete so fast that the session never appears in processingSessionIds.
    const allUserCallSessionIds = (pendingCalls || []).map((c) => c.session_id);
    let skippedSessionIds: string[] = [];
    if (allUserCallSessionIds.length > 0) {
      const { data: completedJobs } = await supabase
        .from('post_call_jobs')
        .select('session_id, result')
        .in('session_id', allUserCallSessionIds)
        .eq('job_type', 'post_call')
        .eq('status', 'completed');

      skippedSessionIds = (completedJobs || [])
        .filter((job) => (job.result as Record<string, unknown>)?.status === 'skipped')
        .map((job) => job.session_id)
        // Only include sessions that don't already have analysis (not in sessions list)
        .filter((sid) => !analysisSessionIds.has(sid));

      if (skippedSessionIds.length > 0) {
        console.log(
          `[Sessions API] Found ${skippedSessionIds.length} skipped sessions (not enough data): ${skippedSessionIds.join(', ')}`
        );
      }

      // Ensure skipped sessions also appear in processingSessionIds so they render as cards
      for (const sid of skippedSessionIds) {
        if (!processingSessionIds.some((p) => p.session_id === sid)) {
          processingSessionIds.push({
            session_id: sid,
            call_type: 'skipped',
          } as (typeof processingSessionIds)[0]);
        }
      }
    }

    // Check if there are any pending avatar_update jobs for the user's sessions
    // This indicates an avatar image is being regenerated
    const { data: pendingAvatarJobs } = await supabase
      .from('post_call_jobs')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('job_type', 'avatar_update')
      .in('status', ['pending', 'processing']);

    const hasPendingAvatarUpdates = (pendingAvatarJobs?.length || 0) > 0;

    console.log(
      `[Sessions API] Found ${pendingAvatarJobs?.length || 0} pending avatar update jobs`
    );

    // Check if there are any pending hot_take video generation jobs for the user's sessions
    const { data: pendingHotTakeJobs } = await supabase
      .from('post_call_jobs')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('job_type', 'hot_take')
      .in('status', ['pending', 'processing']);

    const hasPendingHotTakeVideos = (pendingHotTakeJobs?.length || 0) > 0;
    const pendingHotTakeSessionIds = new Set((pendingHotTakeJobs || []).map((j) => j.session_id));

    console.log(
      `[Sessions API] Found ${pendingHotTakeJobs?.length || 0} pending hot take video jobs`
    );

    // For each session, generate signed URLs for avatar images and videos
    // cartoon_id is now stored directly on interview_call_analysis (source of truth)
    const sessionsWithImages = await Promise.all(
      (sessions || []).map(async (session) => {
        console.log(`[Sessions API] Processing session ${session.session_id}`);

        let avatar_image_url = null;

        // Use cartoon_id or original picture_id based on use_hedra_photo_avatar
        const usePhotoAvatar = session.use_hedra_photo_avatar === true;
        const pictureId = pictureIdBySessionId.get(session.session_id);
        const storagePath = usePhotoAvatar && pictureId ? pictureId : session.cartoon_id;

        if (storagePath) {
          console.log(
            `[Sessions API] Avatar for session ${session.session_id}: ${usePhotoAvatar ? 'photo' : 'cartoon'} (${storagePath})`
          );
          const { data: urlData, error: urlError } = await supabase.storage
            .from('avatar-images-bucket')
            .createSignedUrl(storagePath, 3600); // 3600 seconds = 1 hour

          if (urlError) {
            console.error(`[Sessions API] Error creating signed URL for avatar:`, urlError);
          } else {
            avatar_image_url = urlData?.signedUrl || null;
            console.log(`[Sessions API] Avatar signed URL created`);
          }
        } else {
          console.log(`[Sessions API] No avatar image path for session ${session.session_id}`);
        }

        // Generate signed URL for hot take video if it exists (valid for 1 hour)
        let hot_take_video_1_url = null;

        if (session.hot_take_video_1) {
          console.log(
            `[Sessions API] Found hot_take_video_1 for session ${session.session_id}: ${session.hot_take_video_1}`
          );
          const { data: video1Data, error: video1Error } = await supabase.storage
            .from('interview-hot-take-videos')
            .createSignedUrl(session.hot_take_video_1, 3600); // 3600 seconds = 1 hour

          if (video1Error) {
            console.error(`[Sessions API] Error creating signed URL for video 1:`, video1Error);
          } else {
            hot_take_video_1_url = video1Data?.signedUrl || null;
            console.log(`[Sessions API] Hot take video 1 signed URL created`);
          }
        }

        return {
          ...session,
          avatar_image_url,
          hot_take_video_1_url,
          share_token: shareTokenMap.get(session.session_id) || null,
          unread_message_count: unreadCountMap.get(session.session_id) || 0,
          total_chat_duration_seconds: chatDurationMap.get(session.session_id) || 0,
          is_hot_take_pending: pendingHotTakeSessionIds.has(session.session_id),
        };
      })
    );

    // Recalculate hasProcessingSessions after potentially adding skipped sessions
    const finalHasProcessingSessions = processingSessionIds.length > 0;

    console.log(
      `[Sessions API] Returning ${sessionsWithImages.length} sessions with images, hasProcessingSessions: ${finalHasProcessingSessions}, skippedSessionIds: ${skippedSessionIds.length}, hasPendingAvatarUpdates: ${hasPendingAvatarUpdates}, hasPendingHotTakeVideos: ${hasPendingHotTakeVideos}`
    );
    return NextResponse.json({
      sessions: sessionsWithImages,
      hasProcessingSessions: finalHasProcessingSessions,
      processingSessionIds: processingSessionIds.map((c) => c.session_id),
      skippedSessionIds,
      hasPendingAvatarUpdates,
      hasPendingHotTakeVideos,
    });
  } catch (error) {
    console.error('[Sessions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
