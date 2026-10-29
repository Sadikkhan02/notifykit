/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const smtpHost = process.env.SMTP_HOST || 'smtp.mailtrap.io';
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || 'noreply@example.com';
  const recipientEmail = process.env.RECIPIENT_EMAIL || 'alex.tester@example.com';

  console.log('=== NotifyKit Email Example ===');
  console.log(`Redis URL:       ${redisUrl}`);
  console.log(`SMTP Host:       ${smtpHost}:${smtpPort}`);
  console.log(`Sender:          ${smtpFrom}`);
  console.log(`Recipient:       ${recipientEmail}`);

  if (!smtpUser || !smtpPassword) {
    console.warn(
      '\n[NOTICE] SMTP_USER or SMTP_PASSWORD is not set.\n' +
        'Please copy .env.example to .env and configure real or sandbox (e.g. Mailtrap) credentials.\n' +
        'Running in dry-run verification mode with placeholder credentials...\n',
    );
  }

  // 1. Initialize Nodemailer Email Provider
  const emailProvider = new NodemailerEmailProvider({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    auth: {
      user: smtpUser || 'placeholder_user',
      pass: smtpPassword || 'placeholder_pass',
    },
    from: smtpFrom,
  });

  // 2. Initialize Notifier Orchestrator
  const notifier: Notifier = createNotifier({
    redis: redisUrl,
    providers: {
      email: {
        type: 'nodemailer',
        adapter: emailProvider,
        from: smtpFrom,
      },
    },
  });

  // 3. Register Template
  notifier.registerTemplate(
    'welcome-email',
    '<h1>Welcome, {{name}}!</h1>' +
      '<p>Thank you for joining our platform on {{formatDate signupDate}}.</p>' +
      '<p>Your verification code is: <strong>{{uppercase code}}</strong></p>',
  );

  // 4. Enqueue Notification (Enqueue Acceptance)
  console.log('\n[1/3] Enqueueing notification into Redis...');
  const { jobId } = await notifier.notify({
    to: { email: recipientEmail },
    channels: ['email'],
    template: 'welcome-email',
    data: {
      name: 'Alex Johnson',
      signupDate: new Date().toISOString(),
      code: 'nk-9482',
    },
  });

  console.log(`[ENQUEUE ACCEPTED] Notification safely buffered in Redis. Job ID: ${jobId}`);
  console.log('-> Invariant: Template was pre-rendered fail-fast before entering Redis.');

  // 5. Start Background Worker
  console.log('\n[2/3] Starting BullMQ background worker for "email" channel...');
  notifier.startWorker({ channels: ['email'], concurrency: 2 });
  console.log('[WORKER ACTIVE] Listening for email delivery jobs...');

  // Setup graceful shutdown handler
  let isShuttingDown = false;
  async function gracefulShutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n[3/3] Shutting down workers and closing Redis connections...');
    await notifier.stopWorker();
    await resetDefaultRegistry();
    await closeRedisConnection();
    console.log('[SHUTDOWN COMPLETE] All resources released.');
  }

  process.on('SIGINT', async () => {
    await gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await gracefulShutdown();
    process.exit(0);
  });

  // For quick standalone runs, give the worker a brief window to process the job then shutdown
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
