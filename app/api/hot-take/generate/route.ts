import { NextResponse } from 'next/server';

export const revalidate = 0;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, hot_take_number, hot_take_text } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    if (hot_take_number !== 1 && hot_take_number !== 2) {
      return NextResponse.json({ error: 'hot_take_number must be 1 or 2' }, { status: 400 });
    }

    if (!hot_take_text || !hot_take_text.trim()) {
      return NextResponse.json({ error: 'hot_take_text is required' }, { status: 400 });
    }

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/generate-hot-take-video`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id,
        hot_take_number,
        hot_take_text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Hot Take Generate API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

