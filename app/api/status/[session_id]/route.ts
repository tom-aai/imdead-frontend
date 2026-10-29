import { NextResponse } from 'next/server';

// Thin proxy to the local Flask backend (no auth). Returns {voice:bool, ghost:bool}
// so the "please wait" screen can gate the session on both being ready.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5001';

export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ session_id: string }> }) {
  try {
    const { session_id: sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/status/${sessionId}`, {
      cache: 'no-store',
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Status] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
