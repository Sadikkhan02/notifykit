import type { FcmAdapterMetadata } from './types.js';

/**
 * Adapter package metadata exported by the FCM push adapter.
 * Declares the provider name, push notification channel, required environment variables,
 * version, and supported peer dependency ranges.
 */
export const metadata: FcmAdapterMetadata = {
  name: 'fcm',
  channel: 'push',
  requiredEnv: ['FCM_SERVICE_ACCOUNT_JSON'],
  version: '1.0.0',
  peerDependencies: {
    notifykit: '^1.0.0',
    'firebase-admin': '>=11.0.0',
  },
};
