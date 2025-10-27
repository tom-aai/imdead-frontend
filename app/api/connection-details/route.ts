import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse agent configuration from request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name;
    const pictureId: string | undefined = body?.pictureId;
    
    console.log('📥 Connection details request received:', { 
      agentName, 
      pictureId,
      fullBody: body 
    });

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      pictureId
    );
    
    console.log('✅ Participant token created with pictureId:', pictureId);
    
    // Debug: decode the token to verify attributes are included
    try {
      const tokenPayload = JSON.parse(Buffer.from(participantToken.split('.')[1], 'base64').toString());
      console.log('🔍 Token payload:', JSON.stringify(tokenPayload, null, 2));
      console.log('🔍 Attributes in token:', tokenPayload.attributes);
    } catch (e) {
      console.error('Error decoding token for debug:', e);
    }

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
  pictureId?: string
): Promise<string> {
  // Build token options with metadata included
  const tokenOptions: AccessTokenOptions = {
    ...userInfo,
    ttl: '15m',
  };
  
  // Add pictureId as participant metadata (JSON string)
  // This is more reliable than attributes for passing data to agents
  if (pictureId) {
    tokenOptions.metadata = JSON.stringify({
      pictureId: pictureId,
    });
    console.log('🏷️  Adding pictureId to token metadata:', pictureId);
  } else {
    console.warn('⚠️  No pictureId provided, skipping metadata');
  }
  
  const at = new AccessToken(API_KEY, API_SECRET, tokenOptions);
  
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
