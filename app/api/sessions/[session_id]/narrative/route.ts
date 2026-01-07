import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    session_id: string;
  }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { session_id } = await params;

    console.log('[Get Session Narrative API] Request received for session:', session_id);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Get Session Narrative API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key for server-side queries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[Get Session Narrative API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Get Session Narrative API] User authenticated:', user.id);

    // Fetch session with conversation_narrative
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_call_analysis')
      .select('session_id, user_id, conversation_narrative')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[Get Session Narrative API] Session not found:', sessionError?.message);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify user owns this session
    if (sessionData.user_id !== user.id) {
      console.error('[Get Session Narrative API] User does not own this session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Get Session Narrative API] Successfully retrieved narrative for session:', session_id);

    return NextResponse.json({
      session_id: sessionData.session_id,
      conversation_narrative: sessionData.conversation_narrative || '',
    });

  } catch (error) {
    console.error('[Get Session Narrative API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

