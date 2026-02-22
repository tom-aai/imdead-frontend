import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

export const revalidate = 0;

export type ChatConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  sourceSessionId: string;
  expertName: string;
  mainTopic: string;
};

interface RouteParams {
  params: Promise<{
    share_token: string;
  }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { share_token } = await params;

    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      console.error('[Chat Session API] Missing LiveKit configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Initialize Supabase client with service key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Look up share token first to check if it's public
    const { data: shareData, error: shareError } = await supabase
      .from('avatar_share_tokens')
      .select('session_id, owner_user_id, is_active, expires_at, is_public')
      .eq('share_token', share_token)
      .single();

    if (shareError || !shareData) {
      console.error('[Chat Session API] Share token not found:', shareError?.message);
      return NextResponse.json({ error: 'Invalid share token' }, { status: 404 });
    }

    // Verify token is active (is_active is set to false when session is deleted)
    if (!shareData.is_active) {
      console.error('[Chat Session API] Share token is inactive (session may have been deleted)');
      return NextResponse.json({ error: 'Share link has been revoked' }, { status: 403 });
    }

    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      console.error('[Chat Session API] Share token is expired');
      return NextResponse.json({ error: 'Share link has expired' }, { status: 403 });
    }

    // Check if this is a public token
    const isPublic = shareData.is_public === true;

    // For non-public tokens, require authentication
    let user = null;
    if (!isPublic) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify user authentication
      const { data: authUser, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !authUser) {
        console.error('[Chat Session API] Auth error:', authError?.message || 'No user');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      user = authUser;
      console.log('[Chat Session API] Student authenticated:', user.id);
    } else {
      console.log('[Chat Session API] Public token - allowing unauthenticated access');
    }

    // Fetch source session data from interview_calls
    const { data: interviewData, error: interviewError } = await supabase
      .from('interview_calls')
      .select('session_id, user_id, user_firstname, user_lastname')
      .eq('session_id', shareData.session_id)
      .single();

    if (interviewError || !interviewData) {
      console.error('[Chat Session API] Source session not found:', interviewError?.message);
      return NextResponse.json({ error: 'Source session not found' }, { status: 404 });
    }

    // Fetch analysis data
    const { data: analysisData } = await supabase
      .from('interview_call_analysis')
      .select('main_topic')
      .eq('session_id', shareData.session_id)
      .single();

    const expertName = `${interviewData.user_firstname || ''} ${interviewData.user_lastname || ''}`.trim() || 'Expert';
    const mainTopic = analysisData?.main_topic || 'their expertise';

    // Check if expert has available credits before creating the room
    const expertUserId = interviewData.user_id;
    const creditCheck = await checkExpertCredits(expertUserId);
    
    if (!creditCheck.canStart) {
      console.log('[Chat Session API] Expert has no credits:', creditCheck.reason);
      
      // Send notification email to expert (fire and forget)
      const seekerName = user?.user_metadata?.given_name || user?.user_metadata?.name || 'Someone';
      notifyExpertOutOfCredits(expertUserId, seekerName).catch(err => {
        console.error('[Chat Session API] Failed to send out-of-credits notification:', err);
      });
      
      return NextResponse.json(
        { 
          error: 'Expert has reached their free usage limit',
          code: 'NO_CREDITS',
          reason: creditCheck.reason 
        }, 
        { status: 402 }
      );
    }

    // Generate participant token
    // For public sessions, use guest identity; for authenticated sessions, use user info
    const participantName = user?.user_metadata?.given_name || user?.user_metadata?.name || 'Guest';
    const participantIdentity = user 
      ? `chat_student_${user.id.substring(0, 8)}_${Math.floor(Math.random() * 1000)}`
      : `chat_guest_${Math.floor(Math.random() * 10000)}_${Date.now()}`;
    const roomName = `chat_session_${share_token.substring(0, 8)}_${Math.floor(Math.random() * 10_000)}`;

    // Build metadata for the chat-agent
    const metadata = {
      share_token,
      source_session_id: shareData.session_id,
      student_user_id: user?.id || 'anonymous',
      expert_name: expertName,
      main_topic: mainTopic,
    };

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      'chat-agent', // Different agent for chat sessions
      metadata
    );

    console.log('[Chat Session API] Created connection:', {
      student: user?.id || 'anonymous (public)',
      sourceSession: shareData.session_id,
      room: roomName,
      isPublic,
    });

    const data: ChatConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName,
      sourceSessionId: shareData.session_id,
      expertName,
      mainTopic,
    };

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error) {
    console.error('[Chat Session API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName: string,
  metadata: object
): Promise<string> {
  const tokenOptions: AccessTokenOptions = {
    ...userInfo,
    ttl: '15m',
    metadata: JSON.stringify(metadata),
  };

  const at = new AccessToken(API_KEY, API_SECRET, tokenOptions);

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  at.roomConfig = new RoomConfiguration({
    agents: [{ agentName }],
  });

  return at.toJwt();
}

/**
 * Check if the expert has available credits for a chat session.
 */
async function checkExpertCredits(expertUserId: string): Promise<{ canStart: boolean; reason: string }> {
  try {
    const headers: HeadersInit = {};
    if (BACKEND_API_KEY) {
      headers['X-API-Key'] = BACKEND_API_KEY;
    }

    const response = await fetch(`${BACKEND_URL}/api/billing/can-start-session/${expertUserId}`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        canStart: data.can_start ?? true,
        reason: data.reason ?? '',
      };
    } else {
      // On error, allow session to proceed (fail open)
      console.warn('[Chat Session API] Credit check failed with status', response.status, '- allowing session');
      return { canStart: true, reason: 'Credit check unavailable' };
    }
  } catch (error) {
    console.warn('[Chat Session API] Error checking credits:', error, '- allowing session');
    return { canStart: true, reason: 'Credit check unavailable' };
  }
}

/**
 * Send notification to expert that someone tried to chat but credits are exhausted.
 * Fire and forget - errors are logged but don't block the response.
 */
async function notifyExpertOutOfCredits(expertUserId: string, seekerName: string): Promise<void> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (BACKEND_API_KEY) {
      headers['X-API-Key'] = BACKEND_API_KEY;
    }

    await fetch(`${BACKEND_URL}/api/billing/notify-out-of-credits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expert_user_id: expertUserId,
        seeker_name: seekerName,
      }),
    });
  } catch (error) {
    console.error('[Chat Session API] Error sending out-of-credits notification:', error);
  }
}
