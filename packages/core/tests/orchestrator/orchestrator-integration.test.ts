import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { createNotifier } from '../../src/orchestrator/notifier.js';
import { closeRedisConnection, resetDefaultRegistry } from '../../src/queue/index.js';
import { isValidUuidV7 } from '../../src/orchestrator/uuid.js';

describe('Orchestrator — Real-Redis Integration Tests', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let directRedis: Redis;
  const isCi = Boolean(process.env.CI);

  beforeAll(async () => {
    const localRedisUrl = process.env.REDIS_URL;

    if (localRedisUrl) {
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
      throw new Error('CRITICAL: Redis is required for orchestrator integration tests in CI.');
    }

    directRedis = new Redis(redisUrl);
  }, 60000);

  afterAll(async () => {
    await resetDefaultRegistry();
    await closeRedisConnection();

    if (directRedis) {
      await directRedis.quit();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }
  }, 30000);

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis integration tests cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  it('TC-ORCH-INT-01: full flow from notify() to durable BullMQ job in Redis', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const notifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: { type: 'nodemailer' },
      },
    });

    notifier.registerTemplate(
      'order-confirmation',
      'Thank you for your order, {{customerName}}! Order #{{orderId}}.',
    );

    const result = await notifier.notify({
      to: { email: 'customer@example.com' },
      channels: ['email'],
      template: 'order-confirmation',
      data: { customerName: 'Emma', orderId: 'ORD-999' },
    });

    expect(result).toHaveProperty('jobId');
    expect(isValidUuidV7(result.jobId)).toBe(true);

    // Verify raw Redis key created under approved namespace bull:notifykit:email:wait
    const waitList = await directRedis.lrange('bull:notifykit:email:wait', 0, -1);
    expect(waitList).toContain(result.jobId);

    // Inspect job hash in Redis
    const jobHash = await directRedis.hgetall(`bull:notifykit:email:${result.jobId}`);
    expect(jobHash).toBeDefined();
    expect(jobHash.name).toBe('email');

    const jobData = JSON.parse(jobHash.data);
    expect(jobData.id).toBe(result.jobId);
    expect(jobData.channel).toBe('email');
    expect(jobData.provider).toBe('nodemailer');
    expect(jobData.renderedBody).toBe('Thank you for your order, Emma! Order #ORD-999.');
    expect(jobData.to.email).toBe('customer@example.com');
    expect(jobData.metadata.traceId).toBeDefined();
    expect(isValidUuidV7(jobData.metadata.traceId)).toBe(true);
  });

  it('TC-ORCH-INT-02: multi-channel event persists jobs to independent Redis queues', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const notifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: { type: 'nodemailer' },
        sms: {
          type: 'twilio',
          accountSid: 'mock-twilio-account-sid',
          authToken: 'mock_auth_token_secret',
        },
      },
    });

    notifier.registerTemplate('alert', 'Urgent: {{message}}');

    const result = await notifier.notify({
      to: { email: 'admin@example.com', phone: '+14155552671' },
      channels: ['email', 'sms'],
      template: 'alert',
      data: { message: 'High CPU load detected' },
    });

    expect(isValidUuidV7(result.jobId)).toBe(true);

    // Email queue verification
    const emailWait = await directRedis.lrange('bull:notifykit:email:wait', 0, -1);
    expect(emailWait).toContain(result.jobId);

    // SMS queue verification
    const smsWait = await directRedis.lrange('bull:notifykit:sms:wait', 0, -1);
    expect(smsWait.length).toBeGreaterThan(0);
    const smsJobId = smsWait[smsWait.length - 1];

    const smsHash = await directRedis.hgetall(`bull:notifykit:sms:${smsJobId}`);
    const smsData = JSON.parse(smsHash.data);
    expect(smsData.renderedBody).toBe('Urgent: High CPU load detected');
    expect(smsData.to.phone).toBe('+14155552671');

    // Both jobs share identical traceId in Redis
    const emailHash = await directRedis.hgetall(`bull:notifykit:email:${result.jobId}`);
    const emailData = JSON.parse(emailHash.data);
    expect(emailData.metadata.traceId).toBe(smsData.metadata.traceId);
  });
});
