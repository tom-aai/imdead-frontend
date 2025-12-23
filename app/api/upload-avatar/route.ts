import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.BACKEND_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

export async function POST(req: Request) {
  try {
    // Validate backend configuration
    if (!BACKEND_URL || !BACKEND_API_KEY) {
      console.error('[Upload Avatar] Missing backend configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[Upload Avatar] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the incoming form data
    const incomingFormData = await req.formData();
    const file = incomingFormData.get('file') as File | null;
    const sessionId = incomingFormData.get('session_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Build new form data with verified user_id
    const backendFormData = new FormData();
    backendFormData.set('file', file);
    backendFormData.set('user_id', user.id); // Use verified user ID from JWT
    backendFormData.set('session_id', sessionId);

    // Forward request to Flask backend with API key
    const response = await fetch(`${BACKEND_URL}/upload-avatar-image`, {
      method: 'POST',
      headers: {
        'X-API-Key': BACKEND_API_KEY,
      },
      body: backendFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Upload Avatar] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log(`[Upload Avatar] Success for user ${user.id}`);
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Upload Avatar] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

