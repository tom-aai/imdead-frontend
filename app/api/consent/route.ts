import { NextResponse } from 'next/server';

// Thin proxy to the local Flask backend (no auth — see IMDEAD-BUILD-PLAN.md).
// Keeping the browser talking to same-origin /api/* avoids CORS against the backend.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5001';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId: string | undefined = body?.session_id;
    const name: string | undefined = body?.name;

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The backend server-stamps consented_at; we only forward session_id + name.
      body: JSON.stringify({ session_id: sessionId, name: name.trim() }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Consent] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Consent] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
