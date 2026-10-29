import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// The agent registers under this exact name (WorkerOptions agent_name="imdead-ghost").
// Setting agent_name disables automatic dispatch, so the token below must request
// this agent by the same name or the ghost never joins. See IMDEAD-BUILD-PLAN.md.
const AGENT_NAME = 'imdead-ghost';

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

    // Per-session data from the client. These ride in the agent-dispatch metadata
    // (NOT participant metadata, and NOT the room name or identity, which LiveKit
    // logs without redaction — see IMDEAD-BUILD-PLAN.md "The LiveKit token change").
    const body = await req.json();
    const voiceId: string | undefined = body?.voiceId;
    const sessionId: string | undefined = body?.sessionId;

    if (!sessionId) {
      return new NextResponse('sessionId is required', { status: 400 });
    }

    // One room per guest. Deriving the room name from the opaque session_id keeps
    // token-based dispatch firing on room creation. No PII in the room name.
    const roomName = `imdead_${sessionId}`;
    // Random, non-PII identity. The guest's real name never goes here.
    const participantIdentity = `guest_${Math.floor(Math.random() * 1_000_000)}`;
    const participantName = 'guest';

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      voiceId,
      sessionId
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
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
  voiceId?: string,
  sessionId?: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  // Explicit agent dispatch: name the agent and carry the per-session data as the
  // dispatch metadata. The agent reads it via json.loads(ctx.job.metadata).
  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName: AGENT_NAME,
        metadata: JSON.stringify({ voiceId, sessionId }),
      }),
    ],
  });

  return at.toJwt();
}
