import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    share_token: string;
  }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { share_token } = await params;

    // Initialize Supabase client with service key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Look up share token to check if it's public
    const { data: shareData, error: shareError } = await supabase
      .from('avatar_share_tokens')
      .select('is_public, is_active')
      .eq('share_token', share_token)
      .single();

    if (shareError || !shareData) {
      // Token doesn't exist or error occurred
      return NextResponse.json({ isPublic: false }, { status: 200 });
    }

    // Check if token is active and public
    const isPublic = shareData.is_active && shareData.is_public === true;

    return NextResponse.json({ isPublic }, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error) {
    console.error('[Public Check API] Unexpected error:', error);
    return NextResponse.json({ isPublic: false }, { status: 200 });
  }
}
