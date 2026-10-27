/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import type { ProviderResult } from 'notifykit/interfaces';
import { FcmPushProvider } from '@notifykit/adapter-fcm';

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
  const {
    FCM_SERVICE_ACCOUNT_JSON,
    GOOGLE_APPLICATION_CREDENTIALS,
    RECIPIENT_PUSH_TOKEN,
    FCM_PROJECT_ID,
    REDIS_URL,
  } = process.env;

  const credentials = FCM_SERVICE_ACCOUNT_JSON || GOOGLE_APPLICATION_CREDENTIALS;

  // 1. Validate required environment variables
  if (!credentials || !RECIPIENT_PUSH_TOKEN) {
    console.error(
      'Error: Required environment variables are missing.\n' +
        'Please define: FCM_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS) and RECIPIENT_PUSH_TOKEN (FCM device registration token).\n' +
        'Optional: FCM_PROJECT_ID, REDIS_URL (default redis://localhost:6379)',
    );
    process.exitCode = 1;
    return;
  }

  const redisUrl = REDIS_URL || 'redis://localhost:6379';
  const maskedToken =
    RECIPIENT_PUSH_TOKEN.length > 12
      ? `${RECIPIENT_PUSH_TOKEN.slice(0, 6)}...${RECIPIENT_PUSH_TOKEN.slice(-6)}`
      : RECIPIENT_PUSH_TOKEN;

  console.log('--- NotifyKit Phase 9 FCM Push Verification ---');
  console.log(`Device Token: ${maskedToken}`);
  console.log(`Project ID:   ${FCM_PROJECT_ID || '(derived from service account)'}`);
  console.log(`Redis:        ${redisUrl}`);
  console.log('--------------------------------------------------');

  // 2. Instantiate FcmPushProvider
  const adapter = new FcmPushProvider({
    serviceAccount: credentials,
    projectId: FCM_PROJECT_ID,
  });

  // 3. Intercept sendPush to observe actual adapter result directly
  let deliveryResolve: (res: ProviderResult) => void = () => {};
  let deliveryReject: (err: unknown) => void = () => {};
  const deliveryPromise = new Promise<ProviderResult>((resolve, reject) => {
    deliveryResolve = resolve;
    deliveryReject = reject;
  });

  const originalSendPush = adapter.sendPush.bind(adapter);
  adapter.sendPush = async (opts) => {
    try {
      const res = await originalSendPush(opts);
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
        push: adapter,
      },
    });

    // Register test event template
    notifier.registerTemplate('fcm-verification', {
      push: 'Real push verification from NotifyKit',
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
    console.log('[WORKER] Queue worker started. Listening for Push jobs...');

    // 6. Arm 30-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      deliveryTimeoutTimer = setTimeout(() => {
        reject(
          new Error(
            'Timeout: Push notification delivery was not accepted by FCM within 30 seconds.',
          ),
        );
      }, 30000);
      deliveryTimeoutTimer.unref();
    });

    // 7. Enqueue Push notification
    console.log('[ENQUEUE] Enqueueing notification for recipient device token...');
    const result = await notifier.notify({
      event: 'fcm-verification',
      to: {
        pushToken: RECIPIENT_PUSH_TOKEN,
      },
      data: {
        title: 'NotifyKit FCM Test',
        timestamp: String(Date.now()),
      },
      channels: ['push'],
    });

    console.log(`[ENQUEUE] Enqueued job successfully. Job ID: ${result.jobId}`);

    // 8. Deterministically await adapter delivery or timeout
    const deliveryResult = await Promise.race([deliveryPromise, timeoutPromise]);

    if (deliveryResult.success) {
      console.log('--------------------------------------------------');
      console.log(' SUCCESS: FCM accepted the push notification request!');
      console.log(` Message ID: ${deliveryResult.messageId || 'N/A'}`);
      console.log(' Note: Verify push notification receipt on target device.');
      console.log('--------------------------------------------------');
      process.exitCode = 0;
    } else {
      console.error('--------------------------------------------------');
      console.error(' FAILURE: FCM rejected delivery.');
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
