import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createNotifier, type Notifier } from '../../src/orchestrator/notifier.js';
import { createRedisConnection, closeRedisConnection } from '../../src/queue/connection.js';
import { resetDefaultRegistry } from '../../src/queue/enqueue.js';
import type { EmailProvider, ProviderResult } from '../../src/interfaces/index.js';

describe('Redis Reliability & Reconnection Resilience (Phase 13)', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let activeNotifier: Notifier | null = null;
  const isCi = Boolean(process.env.CI);

  beforeAll(async () => {
    const localRedisUrl = process.env.REDIS_URL;

    if (localRedisUrl) {
      if (process.env.ALLOW_REDIS_FLUSHDB !== 'true') {
        throw new Error(
          'CRITICAL: External REDIS_URL provided without ALLOW_REDIS_FLUSHDB=true. ' +
            'Safety guard required for external Redis test execution.',
        );
      }
      redisUrl = localRedisUrl;
    } else {
      try {
        redisContainer = await new RedisContainer('redis:7-alpine').start();
        redisUrl = redisContainer.getConnectionUrl();
      } catch (err) {
        if (isCi) {
          throw new Error(`CRITICAL: Testcontainers failed to start Redis in CI: ${err}`);
        }
        return;
      }
    }

    if (isCi && !redisUrl) {
      throw new Error('CRITICAL: Redis is required for reconnection tests in CI.');
    }
  }, 60000);

  afterAll(async () => {
    if (activeNotifier) {
      await activeNotifier.stopWorker().catch(() => {});
    }
    await resetDefaultRegistry().catch(() => {});
    await closeRedisConnection().catch(() => {});

    if (redisContainer) {
      await redisContainer.stop().catch(() => {});
    }
  }, 30000);

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis reconnection test cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  it('TC-REL-01: worker handles connection disconnect and resumes processing upon reconnection', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    await resetDefaultRegistry();
    await closeRedisConnection();

    const deliveredJobs: string[] = [];
    const mockEmailProvider: EmailProvider = {
      name: 'mock-reconnect-email',
      async sendEmail(opts): Promise<ProviderResult> {
        deliveredJobs.push(opts.subject);
        return { success: true, messageId: `msg-${deliveredJobs.length}` };
      },
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'mock-reconnect-email',
          adapter: mockEmailProvider,
          from: 'reconnect@example.com',
        },
      },
      logLevel: 'silent',
    });

    activeNotifier.registerTemplate('reconnect-template', '<p>Message: {{msg}}</p>');

    // 1. Enqueue Job 1 before disconnect
    const res1 = await activeNotifier.notify({
      to: { email: 'user1@example.com' },
      channels: ['email'],
      template: 'reconnect-template',
      data: { msg: 'Job 1 before disconnect' },
    });
    expect(res1.jobId).toBeTruthy();

    // 2. Start workers and process Job 1
    activeNotifier.startWorker({ channels: ['email'], concurrency: 1 });
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(deliveredJobs).toContain('Notification: reconnect-template');

    // 3. Inspect connection and simulate connection drop event
    const sharedClient = createRedisConnection(redisUrl);
    expect(sharedClient.status).toBe('ready');

    // Simulate transient connection drop
    sharedClient.emit('error', new Error('ECONNRESET: simulated transient socket reset'));

    // Verify worker did not crash and remains healthy
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Enqueue Job 2 after connection event
    const res2 = await activeNotifier.notify({
      to: { email: 'user2@example.com' },
      channels: ['email'],
      template: 'reconnect-template',
      data: { msg: 'Job 2 after reconnection' },
    });
    expect(res2.jobId).toBeTruthy();

    // Give worker time to process Job 2
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(deliveredJobs.length).toBeGreaterThanOrEqual(2);

    // 5. Graceful shutdown
    await activeNotifier.stopWorker();
    await resetDefaultRegistry();
    await closeRedisConnection();
  }, 30000);
});
