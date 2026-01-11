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

    // Fetch user preferences from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email_notifications_enabled')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = Row not found, which is fine for new users
      console.error('[Preferences API] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    return NextResponse.json({
      email_notifications_enabled: profile?.email_notifications_enabled ?? true,
    });
  } catch (error) {
    console.error('[Preferences API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    // Parse request body
    const body = await req.json();
    const { email_notifications_enabled } = body;

    if (typeof email_notifications_enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid email_notifications_enabled value' }, { status: 400 });
    }

    // Upsert the preference
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        email_notifications_enabled,
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('[Preferences API] Error updating profile:', upsertError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email_notifications_enabled,
    });
  } catch (error) {
    console.error('[Preferences API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

