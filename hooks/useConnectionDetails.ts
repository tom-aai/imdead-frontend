import { useCallback, useEffect, useState } from 'react';
import { decodeJwt } from 'jose';
import { ConnectionDetails } from '@/app/api/connection-details/route';
import { AppConfig } from '@/lib/types';
import { getSupabaseClient } from '@/lib/supabase';

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;

export interface ResumeSessionData {
  originalSessionId: string;
  conversationSummary: string;
}

export default function useConnectionDetails(
  appConfig: AppConfig, 
  pictureId: string | null,
  resumeSessionData?: ResumeSessionData | null
) {
  // Generate room connection details, including:
  //   - A random Room name
  //   - A random Participant name
  //   - An Access Token to permit the participant to join the room
  //   - The URL of the LiveKit server to connect to
  //
  // In real-world application, you would likely allow the user to specify their
  // own participant name, and possibly to choose from existing rooms to join.

  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [connectionDetailsPictureId, setConnectionDetailsPictureId] = useState<string | null>(null);
  const [connectionDetailsOriginalSessionId, setConnectionDetailsOriginalSessionId] = useState<string | null>(null);

  const fetchConnectionDetails = useCallback(async () => {
    setConnectionDetails(null);
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
      window.location.origin
    );

    let data: ConnectionDetails;
    try {
      // Get Supabase session for authentication
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const requestBody: Record<string, unknown> = {
        room_config: appConfig.agentName
          ? {
              agents: [{ agent_name: appConfig.agentName }],
            }
          : undefined,
        pictureId: pictureId,
      };
      
      // Add resume session data if resuming
      if (resumeSessionData) {
        requestBody.originalSessionId = resumeSessionData.originalSessionId;
        requestBody.conversationSummary = resumeSessionData.conversationSummary;
      }
      
      // Include authorization header with session token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Sandbox-Id': appConfig.sandboxId ?? '',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      data = await res.json();
    } catch (error) {
      console.error('Error fetching connection details:', error);
      throw new Error('Error fetching connection details!');
    }

    setConnectionDetails(data);
    setConnectionDetailsPictureId(pictureId);
    setConnectionDetailsOriginalSessionId(resumeSessionData?.originalSessionId ?? null);
    return data;
  }, [pictureId, appConfig.agentName, appConfig.sandboxId, resumeSessionData]);

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
    // Force refresh if:
    // 1. Connection details don't exist
    // 2. Token is expired
    // 3. Picture ID has changed (important for multi-session use!)
    // 4. Original session ID has changed (for resume mode)
    const pictureIdChanged = connectionDetailsPictureId !== pictureId;
    const originalSessionIdChanged = connectionDetailsOriginalSessionId !== (resumeSessionData?.originalSessionId ?? null);
    
    if (isConnectionDetailsExpired() || !connectionDetails || pictureIdChanged || originalSessionIdChanged) {
      if (pictureIdChanged) {
        console.log('Picture ID changed, fetching new connection details', {
          old: connectionDetailsPictureId,
          new: pictureId
        });
      }
      if (originalSessionIdChanged) {
        console.log('Original session ID changed, fetching new connection details (resume mode)', {
          old: connectionDetailsOriginalSessionId,
          new: resumeSessionData?.originalSessionId
        });
      }
      return fetchConnectionDetails();
    } else {
      return connectionDetails;
    }
  }, [connectionDetails, connectionDetailsPictureId, connectionDetailsOriginalSessionId, pictureId, resumeSessionData, fetchConnectionDetails, isConnectionDetailsExpired]);

  return {
    connectionDetails,
    refreshConnectionDetails: fetchConnectionDetails,
    existingOrRefreshConnectionDetails,
  };
}
