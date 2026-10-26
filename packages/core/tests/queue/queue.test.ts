import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis-mock';
import type { Redis as RedisClient } from 'ioredis';
import type { Job } from 'bullmq';
import { createRedisConnection, closeRedisConnection } from '../../src/queue/connection';
import { QueueRegistry, type LogicalQueueName } from '../../src/queue/registry';
import { enqueueJob, resetDefaultRegistry } from '../../src/queue/enqueue';
import { NotificationJob, notificationJobSchema, type QueueChannel } from '../../src/queue/payload';
import {
  DEFAULT_RETRY_POLICY,
  DEFAULT_RETENTION_POLICIES,
  getDefaultJobOptions,
} from '../../src/queue/retry-policy';
import { RedisUnavailableError, QueueFullError } from '../../src/queue/errors';
import { NotifyKitError } from '../../src/errors/notifykit-error';

describe('Queue Layer — Unit Tests (ioredis-mock)', () => {
  beforeEach(async () => {
    await resetDefaultRegistry();
    await closeRedisConnection();
  });

  afterEach(async () => {
    await resetDefaultRegistry();
    await closeRedisConnection();
    vi.restoreAllMocks();
  });

  describe('createRedisConnection', () => {
    it('TC-Q-01: initializes client with required options (maxRetriesPerRequest: null)', () => {
      const client = createRedisConnection();
      expect(client).toBeDefined();
      expect(client.options.maxRetriesPerRequest).toBeNull();
      expect(client.options.enableReadyCheck).toBe(false);
    });

    it('TC-Q-02: reuses memoized instance across multiple calls', () => {
      const client1 = createRedisConnection();
      const client2 = createRedisConnection();
      expect(client1).toBe(client2);
    });

    it('TC-Q-03: closeRedisConnection cleans up and clears memoized reference', async () => {
      const client1 = createRedisConnection();
      await closeRedisConnection();
      const client2 = createRedisConnection();
      expect(client2).not.toBe(client1);
    });

    it('uses retryStrategy calculating exponential backoff capped at 3000ms', () => {
      const client = createRedisConnection();
      const retryStrategy = client.options.retryStrategy as (times: number) => number;
      expect(retryStrategy(5)).toBe(500);
      expect(retryStrategy(50)).toBe(3000);
    });
  });

  describe('QueueRegistry', () => {
    it('TC-Q-04: initializes four queues and exposes logical naming contract', () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);

      // Access via bare channel
      expect(registry.getQueue('email')).toBeDefined();
      expect(registry.getQueue('sms')).toBeDefined();
      expect(registry.getQueue('push')).toBeDefined();
      expect(registry.getQueue('dlq')).toBeDefined();

      // Access via public logical queue name
      expect(registry.getQueue('notifykit:email')).toBeDefined();
      expect(registry.getQueue('notifykit:sms')).toBeDefined();
      expect(registry.getQueue('notifykit:push')).toBeDefined();
      expect(registry.getQueue('notifykit:dlq')).toBeDefined();

      const allQueues = registry.getAllQueues();
      expect(allQueues.size).toBe(4);
      expect(Array.from(allQueues.keys())).toEqual([
        'notifykit:email',
        'notifykit:sms',
        'notifykit:push',
        'notifykit:dlq',
      ]);
    });

    it('throws error when requesting unregistered queue', () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      expect(() => registry.getQueue('unknown' as QueueChannel)).toThrow('is not registered');
    });

    it('TC-Q-05: shares connection client passed into registry', () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');
      const smsQueue = registry.getQueue('sms');

      expect(emailQueue.opts.connection).toBe(smsQueue.opts.connection);
    });

    it('TC-Q-06: close() cleanly shuts down all queues', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      await expect(registry.close()).resolves.toBeUndefined();
      expect(registry.getAllQueues().size).toBe(0);
    });

    it('generates Redis keys conforming to bull:notifykit:<channel>:*', () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');
      expect(emailQueue.toKey('wait')).toBe('bull:notifykit:email:wait');
      expect(emailQueue.toKey('id')).toBe('bull:notifykit:email:id');
    });
  });

  describe('Job Payload Schema & Validation', () => {
    const validJob: NotificationJob = {
      id: '018f9e60-466d-71b3-a00e-6f8d098ef7ab',
      channel: 'email',
      provider: 'smtp',
      to: { email: 'user@example.com' },
      templateId: 'welcome',
      renderedBody: '<h1>Welcome!</h1>',
      variables: { name: 'Alice' },
      metadata: {
        enqueuedAt: Date.now(),
        userId: 'usr_123',
        traceId: 'trc_abc',
      },
    };

    it('validates a correct NotificationJob', () => {
      const parsed = notificationJobSchema.safeParse(validJob);
      expect(parsed.success).toBe(true);
    });

    it('TC-Q-12: rejects missing templateId or invalid channel with E_INVALID_EVENT', async () => {
      const invalidJob = {
        ...validJob,
        channel: 'telegram' as unknown as QueueChannel,
        templateId: '',
      };

      await expect(enqueueJob(invalidJob)).rejects.toThrowError(NotifyKitError);
      try {
        await enqueueJob(invalidJob);
      } catch (err: unknown) {
        const error = err as NotifyKitError;
        expect(error.code).toBe('E_INVALID_EVENT');
        expect(error.hint).toContain('Ensure job payload contains valid channel');
      }
    });
  });

  describe('Retry & Retention Policies', () => {
    it('TC-Q-10: returns default retry policy with 3 attempts and exponential backoff', () => {
      expect(DEFAULT_RETRY_POLICY.attempts).toBe(3);
      expect(DEFAULT_RETRY_POLICY.backoff.type).toBe('exponential');
      expect(DEFAULT_RETRY_POLICY.backoff.delay).toBe(1000);
    });

    it('TC-Q-11: returns channel retention settings per Architecture §A.4.2', () => {
      expect(DEFAULT_RETENTION_POLICIES.email.removeOnComplete).toEqual({
        count: 1000,
        age: 86400,
      });
      expect(DEFAULT_RETENTION_POLICIES.email.removeOnFail).toEqual({
        count: 5000,
        age: 604800,
      });
      expect(DEFAULT_RETENTION_POLICIES.push.removeOnComplete).toEqual({
        count: 5000,
        age: 86400,
      });
      expect(DEFAULT_RETENTION_POLICIES.push.removeOnFail).toEqual({
        count: 10000,
        age: 604800,
      });
      expect(DEFAULT_RETENTION_POLICIES.dlq.removeOnComplete).toBe(false);
      expect(DEFAULT_RETENTION_POLICIES.dlq.removeOnFail).toBe(false);

      const emailOpts = getDefaultJobOptions('email');
      expect(emailOpts.attempts).toBe(3);
      expect(emailOpts.removeOnComplete).toEqual({ count: 1000, age: 86400 });
    });
  });

  describe('enqueueJob', () => {
    const validJob: NotificationJob = {
      id: '018f9e60-466d-71b3-a00e-6f8d098ef7ab',
      channel: 'email',
      provider: 'smtp',
      to: { email: 'user@example.com' },
      templateId: 'welcome',
      renderedBody: '<h1>Welcome!</h1>',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_123',
      },
    };

    it('TC-Q-07: enqueues to email channel queue using registry', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');

      const addSpy = vi
        .spyOn(emailQueue, 'add')
        .mockResolvedValueOnce({ id: 'job_email_1' } as Job<NotificationJob>);

      const jobId = await enqueueJob(validJob, { registry });
      expect(jobId).toBe('job_email_1');
      expect(addSpy).toHaveBeenCalledWith(
        'email',
        validJob,
        expect.objectContaining({
          attempts: 3,
          jobId: validJob.id,
        }),
      );
    });

    it('TC-Q-08: enqueues to sms channel queue', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const smsQueue = registry.getQueue('sms');
      const addSpy = vi
        .spyOn(smsQueue, 'add')
        .mockResolvedValueOnce({ id: 'job_sms_1' } as Job<NotificationJob>);

      const smsJob: NotificationJob = {
        ...validJob,
        channel: 'sms',
        to: { phone: '+14155552671' },
      };

      const jobId = await enqueueJob(smsJob, { registry });
      expect(jobId).toBe('job_sms_1');
      expect(addSpy).toHaveBeenCalledWith('sms', smsJob, expect.any(Object));
    });

    it('TC-Q-09: enqueues to push channel queue', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const pushQueue = registry.getQueue('push');
      const addSpy = vi
        .spyOn(pushQueue, 'add')
        .mockResolvedValueOnce({ id: 'job_push_1' } as Job<NotificationJob>);

      const pushJob: NotificationJob = {
        ...validJob,
        channel: 'push',
        to: { pushToken: 'token_123' },
      };

      const jobId = await enqueueJob(pushJob, { registry });
      expect(jobId).toBe('job_push_1');
      expect(addSpy).toHaveBeenCalledWith('push', pushJob, expect.any(Object));
    });

    it('TC-Q-13: translates connection failure to RedisUnavailableError (E_REDIS_UNAVAILABLE)', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');

      vi.spyOn(emailQueue, 'add').mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:6379'),
      );

      await expect(enqueueJob(validJob, { registry })).rejects.toThrowError(RedisUnavailableError);
      try {
        await enqueueJob(validJob, { registry });
      } catch (err: unknown) {
        const error = err as RedisUnavailableError;
        expect(error.code).toBe('E_REDIS_UNAVAILABLE');
        expect(error.hint).toContain('Verify that Redis is running');
      }
    });

    it('TC-Q-14: translates maxmemory error to QueueFullError (E_QUEUE_FULL)', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');

      vi.spyOn(emailQueue, 'add').mockRejectedValue(
        new Error('OOM command not allowed when used memory > maxmemory'),
      );

      await expect(enqueueJob(validJob, { registry })).rejects.toThrowError(QueueFullError);
      try {
        await enqueueJob(validJob, { registry });
      } catch (err: unknown) {
        const error = err as QueueFullError;
        expect(error.code).toBe('E_QUEUE_FULL');
        expect(error.hint).toContain('Redis maxmemory reached');
      }
    });

    it('TC-Q-15: handles sequential enqueues across different channels without cross-talk', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');
      const smsQueue = registry.getQueue('sms');

      const emailSpy = vi
        .spyOn(emailQueue, 'add')
        .mockResolvedValueOnce({ id: 'email_id' } as Job<NotificationJob>);
      const smsSpy = vi
        .spyOn(smsQueue, 'add')
        .mockResolvedValueOnce({ id: 'sms_id' } as Job<NotificationJob>);

      const emailJob: NotificationJob = { ...validJob, id: '1' };
      const smsJob: NotificationJob = {
        ...validJob,
        id: '2',
        channel: 'sms',
        to: { phone: '+123' },
      };

      const id1 = await enqueueJob(emailJob, { registry });
      const id2 = await enqueueJob(smsJob, { registry });

      expect(id1).toBe('email_id');
      expect(id2).toBe('sms_id');
      expect(emailSpy).toHaveBeenCalledTimes(1);
      expect(smsSpy).toHaveBeenCalledTimes(1);
    });

    it('maps BullMQ jobId to job.id', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');

      const addSpy = vi
        .spyOn(emailQueue, 'add')
        .mockResolvedValueOnce({ id: validJob.id } as Job<NotificationJob>);

      await enqueueJob(validJob, { registry });
      expect(addSpy).toHaveBeenCalledWith(
        'email',
        validJob,
        expect.objectContaining({
          jobId: validJob.id,
        }),
      );
    });

    it('uses custom registry and handles unexpected queue errors with E_INTERNAL', async () => {
      const mockRedis = new Redis() as unknown as RedisClient;
      const registry = new QueueRegistry(mockRedis);
      const emailQueue = registry.getQueue('email');
      vi.spyOn(emailQueue, 'add').mockRejectedValueOnce(new Error('Unexpected disk failure'));

      await expect(enqueueJob(validJob, { registry })).rejects.toThrowError(NotifyKitError);
      try {
        await enqueueJob(validJob, { registry });
      } catch (err: unknown) {
        const error = err as NotifyKitError;
        expect(error.code).toBe('E_INTERNAL');
        expect(error.hint).toContain('Verify Redis connection');
      }
    });
  });
});
