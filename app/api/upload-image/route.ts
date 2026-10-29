import { NextResponse } from 'next/server';

// Thin proxy to the local Flask backend (no auth). Mirrors the old upload-avatar
// multipart pattern: forward `file` + `session_id`. The backend stores the original
// and runs the Gemini ghost transform inline before returning {status:"ready"}, so
// this request can take a while.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5001';

export async function POST(req: Request) {
  try {
    const incoming = await req.formData();
    const file = incoming.get('file') as File | null;
    const sessionId = incoming.get('session_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const forward = new FormData();
    forward.set('file', file);
    forward.set('session_id', sessionId);

    const response = await fetch(`${BACKEND_URL}/upload-image`, {
      method: 'POST',
      body: forward,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Upload Image] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Upload Image] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
