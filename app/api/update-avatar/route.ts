import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.BACKEND_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

export async function POST(req: Request) {
  try {
    // Validate backend configuration
    if (!BACKEND_URL || !BACKEND_API_KEY) {
      console.error('[Update Avatar] Missing backend configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify user is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('[Update Avatar] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const body = await req.json();
    const { session_id, picture_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    if (!picture_id) {
      return NextResponse.json({ error: 'picture_id is required' }, { status: 400 });
    }

    // Verify user owns this session
    const { data: sessionData, error: sessionError } = await supabase
      .from('interview_calls')
      .select('session_id, user_id')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[Update Avatar] Session not found:', sessionError?.message);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (sessionData.user_id !== user.id) {
      console.error('[Update Avatar] User does not own this session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Forward request to Flask backend with API key
    const response = await fetch(`${BACKEND_URL}/update-session-avatar`, {
      method: 'POST',
      headers: {
        'X-API-Key': BACKEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        session_id,
        picture_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Update Avatar] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log(`[Update Avatar] Success for user ${user.id}, session ${session_id}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Update Avatar] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
