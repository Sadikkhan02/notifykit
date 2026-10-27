/* eslint-disable no-console */
import process from 'node:process';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from 'notifykit';
import type { ProviderResult } from 'notifykit/interfaces';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

// --- Shared Global Shutdown State ---
let shutdownPromise: Promise<void> | null = null;
let activeSignal: 'SIGINT' | 'SIGTERM' | null = null;
let signalWatchdogTimer: NodeJS.Timeout | undefined;
let deliveryTimeoutTimer: NodeJS.Timeout | undefined;
let processExitCode = 0;

/**
 * Single authoritative shutdown coordinator shared by normal completion,
 * unhandled delivery errors, and OS signals (SIGINT, SIGTERM).
 *
 * Invariants:
 * 1. Exactly one cleanup sequence executes; concurrent callers await the same promise.
 * 2. Signal handlers delegate here and do not force process exit while cleanup is in flight.
 * 3. Worker shutdown, registry reset, and Redis connection closure are each attempted
 *    independently even if an earlier teardown operation fails.
 * 4. A bounded 10-second watchdog guards signal-triggered shutdown; if cleanup hangs,
 *    it logs explicitly that teardown cannot be guaranteed before forcing exit.
 */
async function requestShutdown(
  trigger: 'normal' | 'SIGINT' | 'SIGTERM',
  notifier?: Notifier,
  signalCode?: number,
): Promise<void> {
  // If triggered by an OS signal, record active signal and target exit code
  if (trigger === 'SIGINT' || trigger === 'SIGTERM') {
    activeSignal = trigger;
    processExitCode = signalCode ?? (trigger === 'SIGINT' ? 130 : 143);

    // Start 10-second watchdog if not already armed
    if (!signalWatchdogTimer) {
      signalWatchdogTimer = setTimeout(() => {
        console.error(
          `[SHUTDOWN] Cleanup exceeded 10-second bound during ${activeSignal}. ` +
            'Forcing process exit. Unclosed sockets, lingering queue locks, or incomplete job drains may remain.',
        );
        process.exit(processExitCode);
      }, 10000);
      signalWatchdogTimer.unref();
    }
  }

  // Clear delivery timeout timer immediately upon any shutdown request
  if (deliveryTimeoutTimer) {
    clearTimeout(deliveryTimeoutTimer);
    deliveryTimeoutTimer = undefined;
  }

  // Initiate or join the single authoritative in-flight cleanup promise
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      const errors: unknown[] = [];

      // Step 1: Drain and stop BullMQ worker processors
      if (notifier) {
        try {
          await notifier.stopWorker();
        } catch (err) {
          errors.push(err);
          console.error('[CLEANUP] Worker shutdown failed:', err);
        }
      }

      // Step 2: Reset BullMQ queue registry
      try {
        await resetDefaultRegistry();
      } catch (err) {
        errors.push(err);
        console.error('[CLEANUP] Registry reset failed:', err);
      }

      // Step 3: Close underlying Redis connection
      try {
        await closeRedisConnection();
      } catch (err) {
        errors.push(err);
        console.error('[CLEANUP] Redis connection closure failed:', err);
      }

      if (errors.length > 0) {
        console.warn(
          `[CLEANUP] Teardown completed with ${errors.length} error(s). Clean shutdown not fully guaranteed.`,
        );
      }
    })();
  }

  // Await shared cleanup sequence to settle
  try {
    await shutdownPromise;
  } finally {
    // If cleanup settled within the 10-second window, disarm the watchdog
    if (signalWatchdogTimer) {
      clearTimeout(signalWatchdogTimer);
      signalWatchdogTimer = undefined;
    }
  }

  // If a signal initiated shutdown, exit with signal code
  if (activeSignal !== null) {
    process.exit(processExitCode);
  }
}

async function main(): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, RECIPIENT_EMAIL, REDIS_URL, SMTP_FROM } =
    process.env;

  // 1. Validate required environment variables
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !RECIPIENT_EMAIL) {
    console.error(
      'Error: Required environment variables are missing.\n' +
        'Please define: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and RECIPIENT_EMAIL.\n' +
        'Optional: SMTP_PORT (default 587), SMTP_FROM (default SMTP_USER), REDIS_URL (default redis://localhost:6379)',
    );
    process.exitCode = 1;
    return;
  }

  // 2. Resolve port and sender
  const port = SMTP_PORT ? Number(SMTP_PORT) : 587;
  const fromAddress = SMTP_FROM || SMTP_USER;
  const redisUrl = REDIS_URL || 'redis://localhost:6379';

  console.log('--- NotifyKit Phase 6 Real-Email Verification ---');
  console.log(`SMTP Host: ${SMTP_HOST}:${port}`);
  console.log(`Sender:    ${fromAddress}`);
  console.log(`Recipient: ${RECIPIENT_EMAIL}`);
  console.log(`Redis:     ${redisUrl}`);
  console.log('--------------------------------------------------');

  // 3. Instantiate NodemailerEmailProvider
  const adapter = new NodemailerEmailProvider({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    from: fromAddress,
  });

  // 4. Intercept sendEmail to observe actual adapter result directly
  let deliveryResolve!: (res: ProviderResult) => void;
  let deliveryReject!: (err: unknown) => void;
  const deliveryPromise = new Promise<ProviderResult>((resolve, reject) => {
    deliveryResolve = resolve;
    deliveryReject = reject;
  });

  const originalSendEmail = adapter.sendEmail.bind(adapter);
  adapter.sendEmail = async (opts) => {
    try {
      const res = await originalSendEmail(opts);
      deliveryResolve(res);
      return res;
    } catch (err) {
      deliveryReject(err);
      throw err;
    }
  };

  // 5. Initialize Notifier instance
  const notifier: Notifier = createNotifier({
    redis: redisUrl,
    providers: {
      email: { type: 'nodemailer', adapter },
    },
  });

  // 6. Register verification template
  notifier.registerTemplate(
    'phase6-verification',
    '<h1>NotifyKit Verification</h1>' +
      '<p>Hello <strong>{{name}}</strong>,</p>' +
      '<p>This email confirms that the NotifyKit email vertical slice is operational:</p>' +
      '<ul>' +
      '<li>createNotifier() &rarr; orchestrator &rarr; BullMQ &rarr; worker &rarr; Nodemailer adapter &rarr; SMTP</li>' +
      '</ul>' +
      '<p>Sent at: {{timestamp}}</p>',
  );

  // 7. Register signal handlers delegating to authoritative coordinator
  process.once('SIGINT', () => void requestShutdown('SIGINT', notifier, 130));
  process.once('SIGTERM', () => void requestShutdown('SIGTERM', notifier, 143));

  // 8. 30-second delivery timeout: covers queue stalls or job never reaching adapter
  const timeoutPromise = new Promise<never>((_, reject) => {
    deliveryTimeoutTimer = setTimeout(() => {
      reject(
        new Error(
          'Delivery timed out after 30 seconds: The notification job did not complete ' +
            'or failed to reach the Nodemailer adapter.',
        ),
      );
    }, 30000);
  });

  try {
    // 9. Start worker for email channel
    notifier.startWorker({ channels: ['email'] });

    // 10. Enqueue notification event
    const timestamp = new Date().toISOString();
    const notifyResult = await notifier.notify({
      to: { email: RECIPIENT_EMAIL },
      channels: ['email'],
      template: 'phase6-verification',
      data: {
        name: 'NotifyKit Human Operator',
        timestamp,
      },
    });

    console.log(`[JOB ENQUEUED] BullMQ Job ID: ${notifyResult.jobId}`);
    console.log('Waiting for worker to dispatch job to Nodemailer adapter...');

    // 11. Race actual adapter delivery result against 30s timeout
    const result = await Promise.race([deliveryPromise, timeoutPromise]);

    if (!result.success) {
      console.error(`[SMTP ERROR] Message rejected by SMTP relay: ${result.error}`);
      processExitCode = 1;
      process.exitCode = 1;
      return;
    }

    // 12. Distinguish relay acceptance from confirmed inbox delivery
    console.log('\n======================================================================');
    console.log(`[SMTP ACCEPTED] Message accepted by SMTP relay with ID: ${result.messageId}`);
    console.log('----------------------------------------------------------------------');
    console.log(`[ACTION REQUIRED] Check recipient inbox for <${RECIPIENT_EMAIL}>.`);
    console.log(
      'Confirm email subject "Notification: phase6-verification" arrived within 30 seconds.',
    );
    console.log('Note: SMTP relay acceptance does NOT guarantee final inbox placement.');
    console.log('======================================================================\n');
    processExitCode = 0;
    process.exitCode = 0;
  } catch (err) {
    console.error(`\n[EXECUTION FAILED] ${(err as Error).message}`);
    processExitCode = 1;
    process.exitCode = 1;
  } finally {
    await requestShutdown('normal', notifier);
  }
}

main().catch((err) => {
  console.error('[UNHANDLED ERROR]', err);
  process.exit(1);
});
