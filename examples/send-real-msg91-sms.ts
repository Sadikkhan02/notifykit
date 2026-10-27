/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import type { ProviderResult } from 'notifykit/interfaces';
import { Msg91SmsProvider } from '@notifykit/adapter-msg91';

// --- Shared Global Shutdown State ---
let shutdownPromise: Promise<void> | null = null;
let activeSignal: 'SIGINT' | 'SIGTERM' | null = null;
let signalWatchdogTimer: NodeJS.Timeout | undefined;
let deliveryTimeoutTimer: NodeJS.Timeout | undefined;
let processExitCode = 0;

/**
 * Single authoritative shutdown coordinator shared by normal completion,
 * unhandled delivery errors, and OS signals (SIGINT, SIGTERM).
 */
async function requestShutdown(
  trigger: 'normal' | 'SIGINT' | 'SIGTERM',
  notifier?: Notifier,
  signalCode?: number,
): Promise<void> {
  if (trigger === 'SIGINT' || trigger === 'SIGTERM') {
    activeSignal = trigger;
    processExitCode = signalCode ?? (trigger === 'SIGINT' ? 130 : 143);

    if (!signalWatchdogTimer) {
      signalWatchdogTimer = setTimeout(() => {
        console.error(
          `[SHUTDOWN] Cleanup exceeded 10-second bound during ${activeSignal}. ` +
            'Forcing process exit. Unclosed sockets or incomplete job drains may remain.',
        );
        process.exit(processExitCode);
      }, 10000);
      signalWatchdogTimer.unref();
    }
  }

  if (deliveryTimeoutTimer) {
    clearTimeout(deliveryTimeoutTimer);
    deliveryTimeoutTimer = undefined;
  }

  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      console.log('\n[SHUTDOWN] Initiating graceful teardown...');

      if (notifier) {
        try {
          await notifier.stopWorker();
          console.log('[SHUTDOWN] Worker successfully drained and stopped.');
        } catch (err) {
          console.error('[SHUTDOWN] Failed stopping worker:', (err as Error).message);
        }
      }

      try {
        resetDefaultRegistry();
        console.log('[SHUTDOWN] Registry successfully reset.');
      } catch (err) {
        console.error('[SHUTDOWN] Failed resetting registry:', (err as Error).message);
      }

      try {
        await closeRedisConnection();
        console.log('[SHUTDOWN] Redis connection closed.');
      } catch (err) {
        console.error('[SHUTDOWN] Failed closing Redis connection:', (err as Error).message);
      }
    })();
  }

  try {
    await shutdownPromise;
  } finally {
    if (signalWatchdogTimer) {
      clearTimeout(signalWatchdogTimer);
      signalWatchdogTimer = undefined;
    }
  }

  if (activeSignal !== null) {
    process.exit(processExitCode);
  }
}

async function main(): Promise<void> {
  const { MSG91_AUTH_KEY, MSG91_FLOW_ID, RECIPIENT_PHONE, MSG91_SENDER_ID, REDIS_URL } =
    process.env;

  // 1. Validate required environment variables
  if (!MSG91_AUTH_KEY || !MSG91_FLOW_ID || !RECIPIENT_PHONE) {
    console.error(
      'Error: Required environment variables are missing.\n' +
        'Please define: MSG91_AUTH_KEY, MSG91_FLOW_ID, and RECIPIENT_PHONE (Indian mobile number, e.g. 919876543210 or +919876543210).\n' +
        'Optional: MSG91_SENDER_ID (DLT-approved 6-char sender), REDIS_URL (default redis://localhost:6379)',
    );
    process.exitCode = 1;
    return;
  }

  const redisUrl = REDIS_URL || 'redis://localhost:6379';

  console.log('--- NotifyKit Phase 8 MSG91 SMS Verification ---');
  console.log(`Flow ID:   ${MSG91_FLOW_ID}`);
  console.log(`Sender ID: ${MSG91_SENDER_ID || '(default DLT header)'}`);
  console.log(`Recipient: ${RECIPIENT_PHONE}`);
  console.log(`Redis:     ${redisUrl}`);
  console.log('--------------------------------------------------');

  // 2. Instantiate Msg91SmsProvider
  const adapter = new Msg91SmsProvider({
    authKey: MSG91_AUTH_KEY,
    flowId: MSG91_FLOW_ID,
    sender: MSG91_SENDER_ID,
  });

  // 3. Intercept sendSms to observe actual adapter result directly
  let deliveryResolve: (res: ProviderResult) => void = () => {};
  let deliveryReject: (err: unknown) => void = () => {};
  const deliveryPromise = new Promise<ProviderResult>((resolve, reject) => {
    deliveryResolve = resolve;
    deliveryReject = reject;
  });

  const originalSendSms = adapter.sendSms.bind(adapter);
  adapter.sendSms = async (opts) => {
    try {
      const res = await originalSendSms(opts);
      deliveryResolve(res);
      return res;
    } catch (err) {
      deliveryReject(err);
      throw err;
    }
  };

  // 4. Configure NotifyKit notifier
  let notifier: Notifier | undefined;
  try {
    notifier = createNotifier({
      redis: { url: redisUrl },
      providers: {
        sms: adapter,
      },
    });

    // Register test event template
    notifier.registerTemplate('msg91-verification', {
      sms: 'Verification OTP: {{otp}}',
    });

    // Register OS signal handlers
    const sigintHandler = () => {
      requestShutdown('SIGINT', notifier, 130).catch(() => {});
    };
    const sigtermHandler = () => {
      requestShutdown('SIGTERM', notifier, 143).catch(() => {});
    };

    process.once('SIGINT', sigintHandler);
    process.once('SIGTERM', sigtermHandler);

    // 5. Start queue worker
    await notifier.startWorker();
    console.log('[WORKER] Queue worker started. Listening for SMS jobs...');

    // 6. Arm 30-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      deliveryTimeoutTimer = setTimeout(() => {
        reject(new Error('Timeout: SMS delivery was not accepted by MSG91 within 30 seconds.'));
      }, 30000);
      deliveryTimeoutTimer.unref();
    });

    // 7. Enqueue SMS notification
    console.log('[ENQUEUE] Enqueueing notification for recipient...');
    const result = await notifier.notify({
      event: 'msg91-verification',
      to: {
        phone: RECIPIENT_PHONE,
      },
      data: {
        otp: '123456',
        name: 'NotifyKit Tester',
      },
      channels: ['sms'],
    });

    console.log(`[ENQUEUE] Enqueued job successfully. Job ID: ${result.jobId}`);

    // 8. Deterministically await adapter delivery or timeout
    const deliveryResult = await Promise.race([deliveryPromise, timeoutPromise]);

    if (deliveryResult.success) {
      console.log('--------------------------------------------------');
      console.log(' SUCCESS: MSG91 accepted the SMS request!');
      console.log(` Request/Message ID: ${deliveryResult.messageId || 'N/A'}`);
      console.log(' Note: Verify SMS receipt on Indian handset within 30 seconds.');
      console.log('--------------------------------------------------');
      process.exitCode = 0;
    } else {
      console.error('--------------------------------------------------');
      console.error(' FAILURE: MSG91 rejected delivery.');
      console.error(` Error:     ${deliveryResult.error}`);
      console.error(` Retryable: ${deliveryResult.retryable}`);
      console.error('--------------------------------------------------');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[ERROR] Unhandled delivery failure:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await requestShutdown('normal', notifier);
  }
}

main().catch((err) => {
  console.error('[FATAL] Process terminated abruptly:', err);
  process.exit(1);
});
