import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL;

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    session_id: string;
  }>;
}

/**
 * Proxy PATCH to backend to toggle use_hedra_photo_avatar for the session.
 * Forwards the user's Supabase JWT for backend auth.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { session_id } = await params;

    if (!BACKEND_URL) {
      console.error('[Avatar Type API] Missing BACKEND_URL');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { use_hedra_photo_avatar } = body;

    if (use_hedra_photo_avatar === undefined) {
      return NextResponse.json({ error: 'use_hedra_photo_avatar is required' }, { status: 400 });
    }

    if (typeof use_hedra_photo_avatar !== 'boolean') {
      return NextResponse.json({ error: 'use_hedra_photo_avatar must be a boolean' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/sessions/${session_id}/avatar-type`, {
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ use_hedra_photo_avatar }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Avatar Type API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
