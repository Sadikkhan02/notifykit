import type { TwilioAdapterMetadata } from './types.js';

/**
 * Adapter package metadata exported by the Twilio SMS adapter.
 * Declares the provider name, SMS channel, required environment variables,
 * version, and supported peer dependency ranges.
 */
export const metadata: TwilioAdapterMetadata = {
  name: 'twilio',
  channel: 'sms',
  requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
  version: '0.0.1',
  peerDependencies: {
    notifykit: '>=0.0.1',
    twilio: '>=4.0.0',
  },
};
