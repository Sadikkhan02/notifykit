/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';
import { TwilioSmsProvider } from '@notifykit/adapter-twilio';
import { FcmPushProvider } from '@notifykit/adapter-fcm';

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log('=== NotifyKit Multi-Channel Example ===');
  console.log(`Redis URL: ${redisUrl}`);

  // 1. Initialize Adapters
  const emailProvider = new NodemailerEmailProvider({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || 'placeholder_user',
      pass: process.env.SMTP_PASSWORD || 'placeholder_pass',
    },
    from: process.env.SMTP_FROM || 'noreply@example.com',
  });

  const smsProvider = new TwilioSmsProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'AC00000000000000000000000000000000',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'placeholder_token',
    from: process.env.TWILIO_FROM || '+15555550100',
  });

  // Mock service account for FCM instantiation if not provided
  const fcmServiceAccount =
    process.env.FCM_SERVICE_ACCOUNT_JSON ||
    JSON.stringify({
      type: 'service_account',
      project_id: 'mock-notifykit-project',
      private_key:
        '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY-----\n',
      client_email: 'firebase-adminsdk@mock-notifykit-project.iam.gserviceaccount.com',
    });

  const pushProvider = new FcmPushProvider({
    serviceAccount: fcmServiceAccount,
  });

  // 2. Initialize Notifier with all three channels
  const notifier: Notifier = createNotifier({
    redis: redisUrl,
    providers: {
      email: { type: 'nodemailer', adapter: emailProvider, from: 'noreply@example.com' },
      sms: { type: 'twilio', adapter: smsProvider, from: '+15555550100' },
      push: { type: 'fcm', adapter: pushProvider },
    },
  });

  // 3. Register a multi-channel template
  notifier.registerTemplate(
    'security-alert',
    'SECURITY ALERT: New login detected for account {{username}} from IP {{ipAddress}} at {{formatDate timestamp}}.',
  );

  // 4. Enqueue Multi-Channel Notification
  console.log('\n[1/3] Dispatching multi-channel notification (Email + SMS + Push)...');
  const { jobId } = await notifier.notify({
    to: {
      email: process.env.RECIPIENT_EMAIL || 'security@example.com',
      phone: process.env.RECIPIENT_PHONE || '+15555550199',
      pushToken: process.env.RECIPIENT_PUSH_TOKEN || 'mock_device_push_token_xyz',
    },
    channels: ['email', 'sms', 'push'],
    template: 'security-alert',
    data: {
      username: 'alex_admin',
      ipAddress: '198.51.100.42',
      timestamp: new Date().toISOString(),
    },
  });

  console.log(`[ENQUEUE ACCEPTED] Multi-channel notification enqueued. Job ID: ${jobId}`);
  console.log('-> Invariant: Single call atomically enqueued to email, sms, and push queues.');

  // 5. Start Workers with per-channel concurrency
  console.log('\n[2/3] Starting BullMQ background workers with concurrency tuning...');
  notifier.startWorker({
    channels: ['email', 'sms', 'push'],
    concurrency: {
      email: 10, // 10 concurrent SMTP connections
      sms: 5, // 5 concurrent telephony requests
      push: 20, // 20 concurrent HTTP/2 push streams
    },
  });
  console.log('[WORKERS ACTIVE] Email, SMS, and Push workers listening for queue jobs...');

  // 6. Graceful Shutdown
  let isShuttingDown = false;
  async function gracefulShutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n[3/3] Shutting down multi-channel workers and closing Redis connections...');
    await notifier.stopWorker();
    await resetDefaultRegistry();
    await closeRedisConnection();
    console.log('[SHUTDOWN COMPLETE] All workers drained and connections closed.');
  }

  process.on('SIGINT', async () => {
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await gracefulShutdown();
    process.exit(0);
  });

  if (process.env.AUTO_CLOSE === 'true') {
    setTimeout(async () => {
      await gracefulShutdown();
      process.exit(0);
    }, 1500);
  }
}

main().catch(async (err) => {
  console.error('[ERROR] Unhandled error in main:', err);
  await resetDefaultRegistry().catch(() => {});
  await closeRedisConnection().catch(() => {});
  process.exit(1);
});
