import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    session_id: string;
  }>;
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { session_id } = await params;

    console.log('[Delete Session API] Request received for session:', session_id);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Delete Session API] No authorization header');
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
      console.error('[Delete Session API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Delete Session API] User authenticated:', user.id);

    // Verify user owns this session
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_calls')
      .select('session_id, user_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[Delete Session API] Session not found:', sessionError?.message);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (sessionData.user_id !== user.id) {
      console.error('[Delete Session API] User does not own this session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Delete Session API] Starting deletion cascade for session:', session_id);

    // Delete in order to respect potential FK constraints:
    // 1. Delete chat_sessions where source_session_id = session_id
    const { error: chatError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('source_session_id', session_id);

    if (chatError) {
      console.error('[Delete Session API] Error deleting chat_sessions:', chatError.message);
      // Continue with deletion - chat_sessions might not have FK constraints
    } else {
      console.log('[Delete Session API] Deleted chat_sessions');
    }

    // 2. Mark avatar_share_tokens as inactive (soft delete to preserve for "avatar unavailable" detection)
    // Try with deleted_at first (if column exists), fall back to just is_active
    let { error: shareTokenError } = await supabase
      .from('avatar_share_tokens')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('session_id', session_id);

    // If deleted_at column doesn't exist, retry with just is_active
    if (shareTokenError && shareTokenError.message?.includes('deleted_at')) {
      console.log('[Delete Session API] deleted_at column not found, updating is_active only');
      const result = await supabase
        .from('avatar_share_tokens')
        .update({ is_active: false })
        .eq('session_id', session_id);
      shareTokenError = result.error;
    }

    if (shareTokenError) {
      console.error(
        '[Delete Session API] Error updating avatar_share_tokens:',
        shareTokenError.message
      );
      // Continue - share tokens might not exist for this session
    } else {
      console.log('[Delete Session API] Marked avatar_share_tokens as inactive');
    }

    // 3. Delete interview_call_analysis
    const { error: analysisError } = await supabase
      .from('interview_call_analysis')
      .delete()
      .eq('session_id', session_id);

    if (analysisError) {
      console.error(
        '[Delete Session API] Error deleting interview_call_analysis:',
        analysisError.message
      );
      // Continue - analysis might not exist
    } else {
      console.log('[Delete Session API] Deleted interview_call_analysis');
    }

    // 4. Delete interview_calls (main session record)
    const { error: callsError } = await supabase
      .from('interview_calls')
      .delete()
      .eq('session_id', session_id);

    if (callsError) {
      console.error('[Delete Session API] Error deleting interview_calls:', callsError.message);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    console.log('[Delete Session API] Successfully deleted session:', session_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Delete Session API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { session_id } = await params;

    console.log('[Update Session API] Request received for session:', session_id);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Update Session API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { main_topic } = body;

    // Validate input
    if (main_topic === undefined) {
      return NextResponse.json({ error: 'main_topic is required' }, { status: 400 });
    }

    if (typeof main_topic !== 'string' || main_topic.trim().length === 0) {
      return NextResponse.json({ error: 'main_topic must be a non-empty string' }, { status: 400 });
    }

    const trimmedTopic = main_topic.trim();

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
      console.error('[Update Session API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Update Session API] User authenticated:', user.id);

    // Verify user owns this session (check interview_call_analysis which is the source of truth)
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_call_analysis')
      .select('session_id, user_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[Update Session API] Session not found:', sessionError?.message);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (sessionData.user_id !== user.id) {
      console.error('[Update Session API] User does not own this session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the main_topic in interview_call_analysis
    const { error: updateError } = await supabase
      .from('interview_call_analysis')
      .update({ main_topic: trimmedTopic })
      .eq('session_id', session_id);

    if (updateError) {
      console.error('[Update Session API] Error updating session:', updateError.message);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    console.log('[Update Session API] Successfully updated session:', session_id);

    return NextResponse.json({ success: true, main_topic: trimmedTopic });
  } catch (error) {
    console.error('[Update Session API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
