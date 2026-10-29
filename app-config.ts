import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: "I'm Dead",
  pageTitle: "I'm Dead",
  pageDescription: 'Talk to yourself beyond the grave.',

  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  logo: '',
  accent: '#7c3aed',
  logoDark: '',
  accentDark: '#7c3aed',
  startButtonText: 'Start',

  agentName: 'imdead-ghost',
};
