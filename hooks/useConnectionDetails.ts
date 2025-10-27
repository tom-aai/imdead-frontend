import { useCallback, useEffect, useState } from 'react';
import { decodeJwt } from 'jose';
import { ConnectionDetails } from '@/app/api/connection-details/route';
import { AppConfig } from '@/lib/types';

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;

export default function useConnectionDetails(appConfig: AppConfig, pictureId: string | null) {
  // Generate room connection details, including:
  //   - A random Room name
  //   - A random Participant name
  //   - An Access Token to permit the participant to join the room
  //   - The URL of the LiveKit server to connect to
  //
  // In real-world application, you would likely allow the user to specify their
  // own participant name, and possibly to choose from existing rooms to join.

  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);

  const fetchConnectionDetails = useCallback(async () => {
    setConnectionDetails(null);
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
      window.location.origin
    );

    console.log('🔄 Fetching connection details with pictureId:', pictureId);

    let data: ConnectionDetails;
    try {
      const requestBody = {
        room_config: appConfig.agentName
          ? {
              agents: [{ agent_name: appConfig.agentName }],
            }
          : undefined,
        pictureId: pictureId,
      };
      
      console.log('📤 Sending request body:', requestBody);
      
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sandbox-Id': appConfig.sandboxId ?? '',
        },
        body: JSON.stringify(requestBody),
      });
      data = await res.json();
      console.log('✅ Connection details received:', data);
    } catch (error) {
      console.error('Error fetching connection details:', error);
      throw new Error('Error fetching connection details!');
    }

    setConnectionDetails(data);
    return data;
  }, [pictureId, appConfig.agentName, appConfig.sandboxId]);

  // Don't fetch automatically on mount - let the app fetch when it's ready to connect
  // (after the user has taken a picture and clicked start)

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
    if (isConnectionDetailsExpired() || !connectionDetails) {
      return fetchConnectionDetails();
    } else {
      return connectionDetails;
    }
  }, [connectionDetails, fetchConnectionDetails, isConnectionDetailsExpired]);

  return {
    connectionDetails,
    refreshConnectionDetails: fetchConnectionDetails,
    existingOrRefreshConnectionDetails,
  };
}
