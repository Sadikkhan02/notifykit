import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { createRedisConnection, closeRedisConnection } from '../../src/queue/connection';
import { QueueRegistry } from '../../src/queue/registry';
import { enqueueJob, resetDefaultRegistry } from '../../src/queue/enqueue';
import { NotificationJob } from '../../src/queue/payload';

describe('Queue Layer — Real-Redis Integration Tests', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let directRedisClient: Redis;
  let registry: QueueRegistry;
  let isCi = Boolean(process.env.CI);

  beforeAll(async () => {
    // In CI, real Redis MUST be used. Local can use REDIS_URL or start Testcontainers.
    const localRedisUrl = process.env.REDIS_URL;

    if (localRedisUrl) {
      redisUrl = localRedisUrl;
    } else {
      try {
        redisContainer = await new RedisContainer('redis:7-alpine').start();
        redisUrl = redisContainer.getConnectionUrl();
      } catch (err) {
        if (isCi) {
          throw new Error(
            `CRITICAL: Testcontainers failed to start Redis in CI environment: ${err}`,
          );
        }
        return;
      }
    }

    if (isCi && !redisUrl) {
      throw new Error('CRITICAL: Redis is required for integration tests in CI.');
    }

    directRedisClient = new Redis(redisUrl);
    const sharedConnection = createRedisConnection(redisUrl);
    registry = new QueueRegistry(sharedConnection);
  }, 60000);

  afterAll(async () => {
    if (registry) {
      await registry.close();
    }
    await resetDefaultRegistry();
    await closeRedisConnection();

    if (directRedisClient) {
      await directRedisClient.quit();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }
  }, 30000);

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis integration test cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  it('TC-Q-INT-01: enqueues a job into real Redis and appears in wait list', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const testJob: NotificationJob = {
      id: '018f9e60-466d-71b3-a00e-6f8d098ef7ab',
      channel: 'email',
      provider: 'smtp',
      to: { email: 'alice@example.com' },
      templateId: 'order-confirmed',
      renderedBody: '<p>Your order is confirmed</p>',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_int_01',
      },
    };

    const jobId = await enqueueJob(testJob, { registry });
    expect(jobId).toBe(testJob.id);

    // Verify key in real Redis: bull:notifykit:email:wait
    const waitList = await directRedisClient.lrange('bull:notifykit:email:wait', 0, -1);
    expect(waitList).toContain(jobId);

    // Verify hash representation
    const jobHash = await directRedisClient.hgetall(`bull:notifykit:email:${jobId}`);
    expect(jobHash).toBeDefined();
    expect(jobHash.name).toBe('email');
  });

  it('enqueues using default registry when config.registry is not supplied', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const testJob: NotificationJob = {
      id: 'default_reg_job',
      channel: 'email',
      provider: 'smtp',
      to: { email: 'default@example.com' },
      templateId: 'order-confirmed',
      renderedBody: '<p>Default registry payload</p>',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_default_reg',
      },
    };

    // Calls getOrCreateDefaultRegistry(redisUrl)
    const jobId = await enqueueJob(testJob, { redisUrl });
    expect(jobId).toBe('default_reg_job');
    await resetDefaultRegistry();
  });

  it('TC-Q-INT-02: routes to correct queue keys per channel', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const smsJob: NotificationJob = {
      id: '018f9e60-466d-71b3-a00e-6f8d098ef7ac',
      channel: 'sms',
      provider: 'twilio',
      to: { phone: '+14155552671' },
      templateId: 'otp-code',
      renderedBody: 'Your code is 123456',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_int_02',
      },
    };

    const jobId = await enqueueJob(smsJob, { registry });
    expect(jobId).toBe(smsJob.id);

    const smsWait = await directRedisClient.lrange('bull:notifykit:sms:wait', 0, -1);
    expect(smsWait).toContain(jobId);

    // Email wait list should not contain the SMS job
    const emailWait = await directRedisClient.lrange('bull:notifykit:email:wait', 0, -1);
    expect(emailWait).not.toContain(jobId);
  });

  it('TC-Q-INT-03: 100-Enqueue Namespace Isolation Test (Addendum §D.1 line 5825)', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    // Flush db to ensure clean isolation check
    await directRedisClient.flushdb();

    // Enqueue 100 jobs distributed across channels
    const channels = ['email', 'sms', 'push'] as const;
    for (let i = 0; i < 100; i++) {
      const channel = channels[i % channels.length];
      const job: NotificationJob = {
        id: `iso_job_${i}`,
        channel,
        provider: 'test-provider',
        to: channel === 'email' ? { email: `test${i}@example.com` } : { phone: `+100000000${i}` },
        templateId: 'test-template',
        renderedBody: `Body ${i}`,
        metadata: {
          enqueuedAt: Date.now(),
          traceId: `trc_iso_${i}`,
        },
      };
      await enqueueJob(job, { registry });
    }

    // Scan all keys in Redis
    const allKeys = await directRedisClient.keys('*');
    expect(allKeys.length).toBeGreaterThan(0);

    // Assert that 100% of created keys match pattern 'bull:notifykit:*'
    const nonConformingKeys = allKeys.filter((k) => !k.startsWith('bull:notifykit:'));
    expect(nonConformingKeys).toEqual([]);
  });

  it('TC-Q-INT-04: Retention policy application test (Addendum §D.1 line 5826)', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const emailQueue = registry.getQueue('email');
    const emailJob = await emailQueue.getJob('iso_job_0');
    expect(emailJob).not.toBeNull();
    expect(emailJob?.opts.removeOnComplete).toEqual({ count: 1000, age: 86400 });
    expect(emailJob?.opts.removeOnFail).toEqual({ count: 5000, age: 604800 });

    const pushQueue = registry.getQueue('push');
    const pushJob = await pushQueue.getJob('iso_job_2');
    expect(pushJob).not.toBeNull();
    expect(pushJob?.opts.removeOnComplete).toEqual({ count: 5000, age: 86400 });
    expect(pushJob?.opts.removeOnFail).toEqual({ count: 10000, age: 604800 });
  });

  it('TC-Q-INT-05: Shared Client Identity & Connection Configuration', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const emailQueue = registry.getQueue('email');
    const smsQueue = registry.getQueue('sms');
    const pushQueue = registry.getQueue('push');
    const dlqQueue = registry.getQueue('dlq');

    const clientEmail = emailQueue.opts.connection as Redis;
    const clientSms = smsQueue.opts.connection as Redis;
    const clientPush = pushQueue.opts.connection as Redis;
    const clientDlq = dlqQueue.opts.connection as Redis;

    // All queues must share the identical client instance reference
    expect(clientEmail).toBe(clientSms);
    expect(clientSms).toBe(clientPush);
    expect(clientPush).toBe(clientDlq);

    // Client options must enforce maxRetriesPerRequest: null
    expect(clientEmail.options.maxRetriesPerRequest).toBeNull();
  });

  it('TC-Q-INT-06: Graceful producer shutdown leaves no dangling connections', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const tempConnection = createRedisConnection(redisUrl);
    const tempRegistry = new QueueRegistry(tempConnection);

    await expect(tempRegistry.close()).resolves.toBeUndefined();
    expect(tempRegistry.getAllQueues().size).toBe(0);
  });
});
