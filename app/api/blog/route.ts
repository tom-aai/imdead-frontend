import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 0; // Don't cache — signed avatar URLs expire.

export type BlogEntry = {
  session_id: string;
  main_topic: string;
  avatar_image_url: string;
  share_token: string;
  created_at: string;
};

/**
 * Public blog index.
 *
 * Returns one entry per session that has (a) a ready avatar image and (b) an
 * active, public share token, so anyone can browse the gallery and click
 * through to talk to an avatar without logging in. Mirrors the avatar-image
 * resolution used by /api/sessions.
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Only public, active, non-expired share tokens are eligible for the blog.
    const { data: shareTokens, error: shareError } = await supabase
      .from('avatar_share_tokens')
      .select('session_id, share_token')
      .eq('is_active', true)
      .eq('is_public', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    if (shareError) {
      console.error('[Blog API] Error fetching share tokens:', shareError.message);
      return NextResponse.json({ error: 'Failed to load blog' }, { status: 500 });
    }

    // A session can only have one active share token, but guard against dupes by
    // keeping the first token seen per session.
    const shareTokenBySession = new Map<string, string>();
    for (const token of shareTokens || []) {
      if (!shareTokenBySession.has(token.session_id)) {
        shareTokenBySession.set(token.session_id, token.share_token);
      }
    }

    const sessionIds = Array.from(shareTokenBySession.keys());
    if (sessionIds.length === 0) {
      return NextResponse.json({ entries: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Only sessions with analysis have a title + avatar (those still processing
    // won't appear in interview_call_analysis, so they're naturally excluded).
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_call_analysis')
      .select('session_id, user_id, created_at, main_topic, cartoon_id, use_hedra_photo_avatar')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('[Blog API] Error fetching sessions:', sessionsError.message);
      return NextResponse.json({ error: 'Failed to load blog' }, { status: 500 });
    }

    // picture_id (original photo) lives on interview_calls; used when the expert
    // opted into the photorealistic avatar.
    const { data: interviewCalls } = await supabase
      .from('interview_calls')
      .select('session_id, picture_id')
      .in('session_id', sessionIds);
    const pictureIdBySession = new Map<string, string>();
    interviewCalls?.forEach((row) => {
      if (row.picture_id) pictureIdBySession.set(row.session_id, row.picture_id);
    });

    const entries = (
      await Promise.all(
        (sessions || []).map(async (session): Promise<BlogEntry | null> => {
          // Same avatar-image resolution as /api/sessions: photo avatar uses the
          // (user-id-prefixed) picture_id, otherwise the cartoon image.
          const usePhotoAvatar = session.use_hedra_photo_avatar === true;
          const rawPictureId = pictureIdBySession.get(session.session_id);
          const pictureId =
            rawPictureId && !rawPictureId.includes('/')
              ? `${session.user_id}/${rawPictureId}`
              : rawPictureId;
          const storagePath = usePhotoAvatar && pictureId ? pictureId : session.cartoon_id;

          if (!storagePath) return null; // Avatar not ready yet — skip.

          const { data: urlData, error: urlError } = await supabase.storage
            .from('avatar-images-bucket')
            .createSignedUrl(storagePath, 3600);

          if (urlError || !urlData?.signedUrl) {
            console.error(
              `[Blog API] Error signing avatar URL for ${session.session_id}:`,
              urlError?.message
            );
            return null;
          }

          return {
            session_id: session.session_id,
            main_topic: session.main_topic || 'Untitled Session',
            avatar_image_url: urlData.signedUrl,
            share_token: shareTokenBySession.get(session.session_id)!,
            created_at: session.created_at,
          };
        })
      )
    ).filter((entry): entry is BlogEntry => entry !== null);

    console.log(`[Blog API] Returning ${entries.length} blog entries`);
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Blog API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
