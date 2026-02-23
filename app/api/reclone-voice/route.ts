import { NextResponse } from 'next/server';

export const revalidate = 0;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the incoming form data
    const incomingFormData = await req.formData();
    const audioFile = incomingFormData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    // Build form data for the backend
    const backendFormData = new FormData();
    backendFormData.set('audio', audioFile);

    // Forward the request to the backend with the auth header
    const response = await fetch(`${BACKEND_URL}/reclone-voice`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        // Don't set Content-Type - let fetch set it with the boundary for multipart
      },
      body: backendFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Reclone Voice API] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Reclone Voice API] Job enqueued:', data.job_id);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Reclone Voice API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
