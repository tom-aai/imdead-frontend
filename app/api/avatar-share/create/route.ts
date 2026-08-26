import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

interface CreateShareRequest {
  session_id: string;
}

interface CreateShareResponse {
  share_token: string;
  share_url: string;
}

export async function POST(req: Request) {
  try {
    // Check authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key for server-side queries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('[Avatar Share API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: CreateShareRequest = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Verify user owns this session
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_calls')
      .select('session_id, user_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[Avatar Share API] Session not found:', sessionError?.message);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (sessionData.user_id !== user.id) {
      console.error('[Avatar Share API] User does not own this session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if an active share token already exists for this session
    const { data: existingToken, error: existingError } = await supabase
      .from('avatar_share_tokens')
      .select('share_token')
      .eq('session_id', session_id)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();

    if (existingToken && !existingError) {
      // Return existing token
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
      const shareUrl = `${baseUrl}/chat/${existingToken.share_token}`;

      console.log('[Avatar Share API] Returning existing share token for session:', session_id);

      return NextResponse.json({
        share_token: existingToken.share_token,
        share_url: shareUrl,
      } as CreateShareResponse);
    }

    // Create new share token.
    // is_public: true lets seekers open /chat/<token> without logging in. We
    // accept that we won't have the seeker's email — the chat agent and backend
    // email flows already fail safely when there's no seeker_user_id (anonymous),
    // so no expert-facing email is sent in that case.
    const { data: newToken, error: insertError } = await supabase
      .from('avatar_share_tokens')
      .insert({
        session_id,
        owner_user_id: user.id,
        is_active: true,
        is_public: true,
      })
      .select('share_token')
      .single();

    if (insertError || !newToken) {
      console.error('[Avatar Share API] Failed to create share token:', insertError?.message);
      return NextResponse.json({ error: 'Failed to create share token' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
    const shareUrl = `${baseUrl}/chat/${newToken.share_token}`;

    console.log('[Avatar Share API] Created new share token for session:', session_id);

    return NextResponse.json({
      share_token: newToken.share_token,
      share_url: shareUrl,
    } as CreateShareResponse);
  } catch (error) {
    console.error('[Avatar Share API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
