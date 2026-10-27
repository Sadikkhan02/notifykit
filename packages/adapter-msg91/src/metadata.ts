import type { Msg91AdapterMetadata } from './types.js';

/**
 * Adapter package metadata exported by the MSG91 SMS adapter.
 * Declares the provider name, SMS channel, required environment variables,
 * version, and supported peer dependency ranges.
 */
export const metadata: Msg91AdapterMetadata = {
  name: 'msg91',
  channel: 'sms',
  requiredEnv: ['MSG91_AUTH_KEY', 'MSG91_FLOW_ID'],
  version: '0.0.1',
  peerDependencies: {
    notifykit: '>=0.0.1',
  },
};
