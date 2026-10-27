import type { Channel, Provider } from './types.js';

export const CHANNELS: Channel[] = ['email', 'sms', 'push'];

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export const PROVIDER_NAMES: Record<Provider, string> = {
  nodemailer: 'Nodemailer (SMTP)',
  twilio: 'Twilio (Global SMS)',
  msg91: 'MSG91 (India-focused SMS with DLT compliance)',
  fcm: 'Firebase Cloud Messaging (FCM)',
};

export const ADAPTER_PACKAGES: Record<Provider, string> = {
  nodemailer: '@notifykit/adapter-nodemailer',
  twilio: '@notifykit/adapter-twilio',
  msg91: '@notifykit/adapter-msg91',
  fcm: '@notifykit/adapter-fcm',
};

export const PEER_DEPENDENCIES: Record<Provider, string[]> = {
  nodemailer: ['nodemailer'],
  twilio: ['twilio'],
  msg91: [],
  fcm: ['firebase-admin'],
};

export const SENSITIVE_ENV_VARS = new Set<string>([
  'SMTP_PASSWORD',
  'TWILIO_AUTH_TOKEN',
  'MSG91_AUTH_KEY',
  'FCM_SERVICE_ACCOUNT_JSON',
]);

export const ENV_EXAMPLE_PLACEHOLDERS: Record<string, string> = {
  REDIS_URL: 'redis://localhost:6379',
  NOTIFYKIT_EMAIL_PROVIDER: 'nodemailer',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'your_smtp_user',
  SMTP_PASSWORD: 'your_smtp_password',
  SMTP_FROM: 'noreply@example.com',
  SMTP_SECURE: 'false',
  NOTIFYKIT_SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TWILIO_AUTH_TOKEN: 'your_twilio_auth_token',
  TWILIO_FROM: '+1234567890',
  TWILIO_MESSAGING_SERVICE_SID: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  MSG91_AUTH_KEY: 'your_msg91_auth_key',
  MSG91_FLOW_ID: 'your_msg91_flow_id',
  MSG91_SENDER_ID: 'SENDER',
  NOTIFYKIT_PUSH_PROVIDER: 'fcm',
  FCM_SERVICE_ACCOUNT_JSON: '{"type":"service_account","project_id":"..."}',
  FCM_PROJECT_ID: 'your_project_id',
};

export const STARTER_CODE_SNIPPET = `
// NotifyKit Quick Start:
import { createNotifier } from 'notifykit';

const notifier = createNotifier();

await notifier.notify({
  recipient: {
    email: 'user@example.com',
    phone: '+15551234567',
    pushToken: 'fcm-device-token',
  },
  channel: 'email',
  template: 'welcome',
  data: { name: 'Friend' },
});
`;
