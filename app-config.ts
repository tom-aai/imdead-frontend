import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Expert Avatar',
  pageTitle: 'Expert Avatar',
  pageDescription: 'A voice agent built with LiveKit',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '',
  accent: '#ff10f0',
  logoDark: '',
  accentDark: '#ff10f0',
  startButtonText: 'Start call',

  agentName: 'interview-agent',
};
