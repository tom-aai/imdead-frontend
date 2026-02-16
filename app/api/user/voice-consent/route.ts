import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has voice consent recorded
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('voice_id_consent')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[Voice Consent API] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to check consent' }, { status: 500 });
    }

    const hasConsent = !!(profile?.voice_id_consent);

    return NextResponse.json({ hasConsent });
  } catch (error) {
    console.error('[Voice Consent API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create consent record with timestamp and consent version
    const consentRecord = {
      timestamp: new Date().toISOString(),
      consent_version: 1,
    };

    // Upsert the consent record
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        voice_id_consent: consentRecord,
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('[Voice Consent API] Error updating profile:', upsertError);
      return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      consent: consentRecord,
    });
  } catch (error) {
    console.error('[Voice Consent API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
