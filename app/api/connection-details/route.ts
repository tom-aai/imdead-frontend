import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { createClient } from '@supabase/supabase-js';

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

export type UserData = {
  userId: string;
  email: string | undefined;
  name: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
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
    
    // Resume session data (optional - for resuming existing sessions)
    const originalSessionId: string | undefined = body?.originalSessionId;
    const conversationSummary: string | undefined = body?.conversationSummary;

    // Get user data from Supabase session
    let userData: UserData | null = null;
    const authHeader = req.headers.get('authorization');
    
    if (authHeader) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: { user }, error } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        
        if (!error && user) {
          userData = {
            userId: user.id,
            email: user.email,
            name: user.user_metadata?.name,
            firstName: user.user_metadata?.given_name,
            lastName: user.user_metadata?.family_name,
          };
        } else if (error) {
          console.error('Authentication error:', error.message);
        }
      } catch (error) {
        console.error('Error validating user session:', error);
      }
    }

    // Generate participant token
    const participantName = userData?.firstName || userData?.name || 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      pictureId,
      userData,
      originalSessionId,
      conversationSummary
    );

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
  pictureId?: string,
  userData?: UserData | null,
  originalSessionId?: string,
  conversationSummary?: string
): Promise<string> {
  // Build token options with metadata included
  const tokenOptions: AccessTokenOptions = {
    ...userInfo,
    ttl: '15m',
  };
  
  // Build metadata object with all user info
  const metadata: Record<string, unknown> = {};
  
  if (pictureId) {
    metadata.pictureId = pictureId;
  }
  
  if (userData) {
    metadata.user = {
      userId: userData.userId,
      email: userData.email,
      name: userData.name,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };
  }
  
  // Add resume session data if provided
  if (originalSessionId) {
    metadata.originalSessionId = originalSessionId;
    metadata.conversationSummary = conversationSummary || '';
    metadata.isResumeSession = true;
  }
  
  // Add metadata to token if we have any
  if (Object.keys(metadata).length > 0) {
    tokenOptions.metadata = JSON.stringify(metadata);
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
