/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import { TwilioSmsProvider } from '@notifykit/adapter-twilio';
import { Msg91SmsProvider } from '@notifykit/adapter-msg91';

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const providerType = (process.env.SMS_PROVIDER || 'twilio').toLowerCase();
  const recipientPhone = process.env.RECIPIENT_PHONE || '+15555550199';

  console.log('=== NotifyKit SMS Example ===');
  console.log(`Redis URL:       ${redisUrl}`);
  console.log(`Provider Selected: ${providerType.toUpperCase()}`);
  console.log(`Target Phone:    ${recipientPhone} (E.164 format)`);

  let adapter: unknown;
  let senderInfo = '';

  if (providerType === 'msg91') {
    const authKey = process.env.MSG91_AUTH_KEY || 'placeholder_auth_key';
    const flowId = process.env.MSG91_FLOW_ID || 'placeholder_flow_id';
    const sender = process.env.MSG91_SENDER_ID || 'NOTIFY';

    senderInfo = `Sender ID: ${sender}, Flow ID: ${flowId}`;
    adapter = new Msg91SmsProvider({
      authKey,
      flowId,
      sender,
    });
  } else {
    // Default to Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC00000000000000000000000000000000';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'placeholder_auth_token';
    const fromNumber = process.env.TWILIO_FROM || '+15555550100';

    senderInfo = `From Number: ${fromNumber}`;
    adapter = new TwilioSmsProvider({
      accountSid,
      authToken,
      from: fromNumber,
    });
  }

  console.log(`Configuration:   ${senderInfo}`);

  // 1. Initialize Notifier
  const notifier: Notifier = createNotifier({
    redis: redisUrl,
    providers: {
      sms: {
        type: providerType,
        adapter,
      },
    },
  });

  // 2. Register SMS Template
  notifier.registerTemplate(
    'otp-sms',
    'Your verification code is {{otp}}. Valid for 10 minutes. Do not share.',
  );

  // 3. Enqueue Notification (Enqueue Acceptance)
  console.log('\n[1/3] Enqueueing SMS notification into Redis...');
  const { jobId } = await notifier.notify({
    to: { phone: recipientPhone },
    channels: ['sms'],
    template: 'otp-sms',
    data: {
      otp: '739201',
    },
  });

  console.log(`[ENQUEUE ACCEPTED] SMS job successfully queued. Job ID: ${jobId}`);
  console.log('-> Invariant: Recipient phone was validated and template pre-rendered fail-fast.');

  // 4. Start Background Worker
  console.log('\n[2/3] Starting BullMQ worker for "sms" channel...');
  notifier.startWorker({ channels: ['sms'], concurrency: 2 });
  console.log('[WORKER ACTIVE] Listening for SMS dispatch jobs...');

  // 5. Graceful Teardown
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
