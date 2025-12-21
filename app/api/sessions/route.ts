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
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

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
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_call_analysis')
      .select('session_id, user_id, created_at, main_topic, hot_take_video_1, hot_take_video_2, social_post_draft')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('[Sessions API] Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions', details: sessionsError.message }, { status: 500 });
    }

    console.log(`[Sessions API] Found ${sessions?.length || 0} sessions for user_id ${userId}`);

    // For each session, get the avatar image URL from user_avatar_images
    const sessionsWithImages = await Promise.all(
      (sessions || []).map(async (session) => {
        console.log(`[Sessions API] Processing session ${session.session_id}`);
        
        // Get the avatar image for this session
        const { data: avatarData, error: avatarError } = await supabase
          .from('user_avatar_images')
          .select('cartoon_id')
          .eq('user_id', userId)
          .eq('session_id', session.session_id)
          .limit(1)
          .single();

        if (avatarError && avatarError.code !== 'PGRST116') {
          // PGRST116 is "no rows returned", which is okay
          console.error(`[Sessions API] Error fetching avatar for session ${session.session_id}:`, avatarError);
        }

        let avatar_image_url = null;
        
        if (avatarData?.cartoon_id) {
          console.log(`[Sessions API] Found cartoon_id for session ${session.session_id}: ${avatarData.cartoon_id}`);
          // Get the public URL for the cartoon image
          const { data: urlData } = supabase.storage
            .from('avatar-images-bucket')
            .getPublicUrl(avatarData.cartoon_id);
          
          avatar_image_url = urlData?.publicUrl || null;
          console.log(`[Sessions API] Avatar URL: ${avatar_image_url}`);
        } else {
          console.log(`[Sessions API] No cartoon_id found for session ${session.session_id}`);
        }

        // Get public URLs for hot take videos if they exist
        let hot_take_video_1_url = null;
        let hot_take_video_2_url = null;

        if (session.hot_take_video_1) {
          const { data: video1Data } = supabase.storage
            .from('hot-take-videos')
            .getPublicUrl(session.hot_take_video_1);
          hot_take_video_1_url = video1Data?.publicUrl || null;
        }

        if (session.hot_take_video_2) {
          const { data: video2Data } = supabase.storage
            .from('hot-take-videos')
            .getPublicUrl(session.hot_take_video_2);
          hot_take_video_2_url = video2Data?.publicUrl || null;
        }

        return {
          ...session,
          avatar_image_url,
          hot_take_video_1_url,
          hot_take_video_2_url,
        };
      })
    );

    console.log(`[Sessions API] Returning ${sessionsWithImages.length} sessions with images`);
    return NextResponse.json({ sessions: sessionsWithImages });
  } catch (error) {
    console.error('[Sessions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

