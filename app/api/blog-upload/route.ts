import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.BACKEND_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

export async function POST(req: Request) {
  try {
    // Validate backend configuration
    if (!BACKEND_URL || !BACKEND_API_KEY) {
      console.error('[Blog Upload] Missing backend configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify user is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('[Blog Upload] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the incoming JSON body
    let body: { text?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const text = body.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // Forward request to Flask backend with the verified user_id and API key.
    // The backend enforces the authoritative D5 length bounds and returns 400s
    // (too short / too long) which we surface back to the client below.
    const response = await fetch(`${BACKEND_URL}/blog-upload-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({ user_id: user.id, text }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Blog Upload] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log(`[Blog Upload] Success for user ${user.id}, session ${data.session_id}`);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Blog Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
