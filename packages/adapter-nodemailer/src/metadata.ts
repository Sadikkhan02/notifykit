import type { NodemailerAdapterMetadata } from './types.js';

/**
 * Adapter package metadata exported by the Nodemailer email adapter.
 * Declares the provider name, delivery channel, required environment variables,
 * version, and supported peer dependency ranges.
 */
export const metadata: NodemailerAdapterMetadata = {
  name: 'nodemailer',
  channel: 'email',
  requiredEnv: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
  version: '1.0.0',
  peerDependencies: {
    notifykit: '^1.0.0',
    nodemailer: '>=6.9.0',
  },
};
