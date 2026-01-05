import { NextResponse } from 'next/server';

export const revalidate = 0;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/reclone-voice-jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[Reclone Voice Status API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

