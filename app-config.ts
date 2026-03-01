import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Expert Avatar',
  pageTitle: 'Expert Avatar',
  pageDescription: 'Train your avatar on your expertise. Scale your reach.',

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
