import { useCallback, useState } from 'react';
import { decodeJwt } from 'jose';
import { ConnectionDetails } from '@/app/api/connection-details/route';

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;

export default function useConnectionDetails(voiceId: string | null, sessionId: string | null) {
  // Generate room connection details. The room name derives from the session_id
  // (server-side), the identity is random, and the per-session data (voiceId,
  // sessionId) rides in the agent-dispatch metadata minted by the API route.
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [connectionDetailsSessionId, setConnectionDetailsSessionId] = useState<string | null>(null);

  const fetchConnectionDetails = useCallback(async () => {
    setConnectionDetails(null);
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
      window.location.origin
    );

    let data: ConnectionDetails;
    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, sessionId }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      data = await res.json();
    } catch (error) {
      console.error('Error fetching connection details:', error);
      throw new Error('Error fetching connection details!');
    }

    setConnectionDetails(data);
    setConnectionDetailsSessionId(sessionId);
    return data;
  }, [voiceId, sessionId]);

  const isConnectionDetailsExpired = useCallback(() => {
    const token = connectionDetails?.participantToken;
    if (!token) {
      return true;
    }

    const jwtPayload = decodeJwt(token);
    if (!jwtPayload.exp) {
      return true;
    }
    const expiresAt = new Date(jwtPayload.exp * 1000 - ONE_MINUTE_IN_MILLISECONDS);

    const now = new Date();
    return expiresAt <= now;
  }, [connectionDetails?.participantToken]);

  const existingOrRefreshConnectionDetails = useCallback(async () => {
    const sessionIdChanged = connectionDetailsSessionId !== sessionId;
    if (isConnectionDetailsExpired() || !connectionDetails || sessionIdChanged) {
      return fetchConnectionDetails();
    } else {
      return connectionDetails;
    }
  }, [
    connectionDetails,
    connectionDetailsSessionId,
    sessionId,
    fetchConnectionDetails,
    isConnectionDetailsExpired,
  ]);

  return {
    connectionDetails,
    refreshConnectionDetails: fetchConnectionDetails,
    existingOrRefreshConnectionDetails,
  };
}
