import type { TranscriptionSegment } from 'livekit-client';

export interface CombinedTranscription extends TranscriptionSegment {
  role: 'assistant' | 'user';
  receivedAtMediaTimestamp: number;
  receivedAt: number;
}
export type ThemeMode = 'dark' | 'light' | 'system';

export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  sandboxId?: string;
  agentName?: string;
}

export interface SandboxConfig {
  [key: string]:
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | null;
}

export interface Session {
  session_id: string;
  user_id: string;
  created_at: string;
  main_topic: string | null;
  hot_take_1: string | null;
  hot_take_video_1: string | null;
  hot_take_video_1_url: string | null;
  avatar_image_url: string | null;
  share_token: string | null;
}

export interface AvatarShareToken {
  id: string;
  share_token: string;
  session_id: string;
  owner_user_id: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}
