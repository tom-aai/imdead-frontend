import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

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

    // Check authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[Chat Session API] Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Chat Session API] Student authenticated:', user.id);

    // Look up share token
    const { data: shareData, error: shareError } = await supabase
      .from('avatar_share_tokens')
      .select('session_id, owner_user_id, is_active, expires_at')
      .eq('share_token', share_token)
      .single();

    if (shareError || !shareData) {
      console.error('[Chat Session API] Share token not found:', shareError?.message);
      return NextResponse.json({ error: 'Invalid share token' }, { status: 404 });
    }

    // Verify token is active and not expired
    if (!shareData.is_active) {
      console.error('[Chat Session API] Share token is revoked');
      return NextResponse.json({ error: 'Share link has been revoked' }, { status: 403 });
    }

    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      console.error('[Chat Session API] Share token is expired');
      return NextResponse.json({ error: 'Share link has expired' }, { status: 403 });
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

    // Generate participant token
    const participantName = user.user_metadata?.given_name || user.user_metadata?.name || 'Student';
    const participantIdentity = `chat_student_${user.id.substring(0, 8)}_${Math.floor(Math.random() * 1000)}`;
    const roomName = `chat_session_${share_token.substring(0, 8)}_${Math.floor(Math.random() * 10_000)}`;

    // Build metadata for the chat-agent
    const metadata = {
      share_token,
      source_session_id: shareData.session_id,
      student_user_id: user.id,
      expert_name: expertName,
      main_topic: mainTopic,
    };

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      'chat-agent', // Different agent for chat sessions
      metadata
    );

    console.log('[Chat Session API] Created connection for student:', {
      student: user.id,
      sourceSession: shareData.session_id,
      room: roomName,
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

