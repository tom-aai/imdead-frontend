import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forward request to backend
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (BACKEND_API_KEY) {
      headers['X-API-Key'] = BACKEND_API_KEY;
    }

    const response = await fetch(`${BACKEND_URL}/api/user/account`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to delete account' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Delete Account API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
