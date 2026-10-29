import { NextResponse } from 'next/server';

// Thin proxy to the local Flask backend (no auth). The backend runs the AssemblyAI
// Voices two-call sequence (create + pair) synchronously and persists voice_id to
// the session's voice.json. This request can take up to ~35s (pairing).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5001';

export async function POST(req: Request) {
  try {
    const incoming = await req.formData();
    const audio = incoming.get('audio') as File | null;
    const sessionId = incoming.get('session_id') as string | null;

    if (!audio) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Forward the clip untouched (field name `audio`, as recorded) plus session_id.
    const forward = new FormData();
    forward.set('audio', audio);
    forward.set('session_id', sessionId);

    const response = await fetch(`${BACKEND_URL}/clone-voice`, {
      method: 'POST',
      body: forward,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Clone Voice] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Clone Voice] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
