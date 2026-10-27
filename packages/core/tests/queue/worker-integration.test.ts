import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { QueueEvents } from 'bullmq';
import { createNotifier, type Notifier } from '../../src/orchestrator/notifier.js';
import { createRedisConnection, closeRedisConnection } from '../../src/queue/connection.js';
import { resetDefaultRegistry, getOrCreateDefaultRegistry } from '../../src/queue/enqueue.js';
import * as dlqModule from '../../src/queue/dlq.js';
import { generateDlqJobId, routeToDlq, type DeadLetterJob } from '../../src/queue/dlq.js';
import type { EmailProvider, SmsProvider, PushProvider } from '../../src/interfaces/providers.js';
import type { NotificationJob } from '../../src/queue/payload.js';

describe('Worker Engine — Real-Redis Integration Tests', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let directRedisClient: Redis;
  let sharedConnection: Redis;
  const isCi = Boolean(process.env.CI);

  let activeNotifier: Notifier | null = null;
  const activeQueueEvents = new Set<QueueEvents>();

  beforeAll(async () => {
    const localRedisUrl = process.env.REDIS_URL;

    if (localRedisUrl) {
      if (process.env.ALLOW_REDIS_FLUSHDB !== 'true') {
        throw new Error(
          'CRITICAL: External REDIS_URL provided without ALLOW_REDIS_FLUSHDB=true. ' +
            'Integration tests execute FLUSHDB between test cases to ensure complete BullMQ isolation. ' +
            'To prevent accidental data loss on shared or non-disposable Redis databases, the operator must ' +
            'explicitly confirm that the database is dedicated and disposable by setting ALLOW_REDIS_FLUSHDB=true. ' +
            'Setting this flag is an explicit acknowledgment of disposability, not automatic verification.',
        );
      }
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
    sharedConnection = createRedisConnection(redisUrl);
  }, 60000);

  afterAll(async () => {
    try {
      await resetDefaultRegistry();
    } catch {}

    try {
      await closeRedisConnection();
    } catch {}

    if (directRedisClient) {
      try {
        await directRedisClient.quit();
      } catch {}
    }

    if (redisContainer) {
      try {
        await redisContainer.stop();
      } catch {}
    }
  }, 30000);

  afterEach(async () => {
    // Step 1: Close any active QueueEvents listeners
    for (const qe of activeQueueEvents) {
      try {
        await qe.close();
      } catch {}
    }
    activeQueueEvents.clear();

    // Step 2: Stop active worker instance (drains in-flight work and terminates blocking sockets)
    if (activeNotifier) {
      try {
        await activeNotifier.stopWorker();
      } catch {}
      activeNotifier = null;
    }

    // Step 3: Reset default queue registry (closes BullMQ queue producers)
    try {
      await resetDefaultRegistry();
    } catch {}

    // Step 4: Safely flush the database only if running on a dedicated test environment.
    // Cleanup is permitted when the test suite started and owns the isolated Testcontainers instance,
    // or when the operator explicitly opted in with ALLOW_REDIS_FLUSHDB=true for an external URL.
    const isPermittedToFlush =
      Boolean(redisContainer) || process.env.ALLOW_REDIS_FLUSHDB === 'true';

    if (isPermittedToFlush && directRedisClient) {
      try {
        await directRedisClient.flushdb();
      } catch {}
    }

    vi.restoreAllMocks();
  });

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis integration test cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  /**
   * Helper to wait race-free for a job to reach 'completed' state using QueueEvents.
   */
  function waitForJobCompleted(
    queueEvents: QueueEvents,
    jobId: string,
    timeoutMs = 10000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        queueEvents.off('completed', onCompleted);
        queueEvents.off('failed', onFailed);
        reject(new Error(`Timeout waiting for job ${jobId} to complete after ${timeoutMs}ms`));
      }, timeoutMs);

      const onCompleted = ({ jobId: id }: { jobId: string }) => {
        if (id === jobId) {
          clearTimeout(timer);
          queueEvents.off('completed', onCompleted);
          queueEvents.off('failed', onFailed);
          resolve(id);
        }
      };

      const onFailed = ({ jobId: id, failedReason }: { jobId: string; failedReason: string }) => {
        if (id === jobId) {
          clearTimeout(timer);
          queueEvents.off('completed', onCompleted);
          queueEvents.off('failed', onFailed);
          reject(new Error(`Job ${jobId} failed unexpectedly: ${failedReason}`));
        }
      };

      queueEvents.on('completed', onCompleted);
      queueEvents.on('failed', onFailed);
    });
  }

  /**
   * Helper to wait race-free for a job to reach 'failed' state using QueueEvents.
   */
  function waitForJobFailed(
    queueEvents: QueueEvents,
    jobId: string,
    timeoutMs = 15000,
  ): Promise<{ jobId: string; failedReason: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        queueEvents.off('failed', onFailed);
        queueEvents.off('completed', onCompleted);
        reject(new Error(`Timeout waiting for job ${jobId} to fail after ${timeoutMs}ms`));
      }, timeoutMs);

      const onFailed = ({ jobId: id, failedReason }: { jobId: string; failedReason: string }) => {
        if (id === jobId) {
          clearTimeout(timer);
          queueEvents.off('failed', onFailed);
          queueEvents.off('completed', onCompleted);
          resolve({ jobId: id, failedReason });
        }
      };

      const onCompleted = ({ jobId: id }: { jobId: string }) => {
        if (id === jobId) {
          clearTimeout(timer);
          queueEvents.off('failed', onFailed);
          queueEvents.off('completed', onCompleted);
          reject(new Error(`Job ${jobId} completed unexpectedly when failure was expected`));
        }
      };

      queueEvents.on('failed', onFailed);
      queueEvents.on('completed', onCompleted);
    });
  }

  it('TC-W-INT-01: email channel dispatch to mock provider adapter and job completion', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'email-msg-01' }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
          from: 'notifications@notifykit.dev',
        },
      },
    });

    activeNotifier.registerTemplate('welcome', '<p>Welcome, {{name}}!</p>');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const completionPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Email job timeout')), 10000);
      queueEvents.on('completed', ({ jobId }) => {
        clearTimeout(timer);
        resolve(jobId);
      });
    });

    const result = await activeNotifier.notify({
      to: { email: 'user@example.com' },
      channels: ['email'],
      template: 'welcome',
      data: { name: 'Alice' },
    });

    const completedJobId = await completionPromise;
    expect(completedJobId).toBe(result.jobId);

    expect(mockEmailAdapter.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailAdapter.sendEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      from: 'notifications@notifykit.dev',
      subject: 'Notification: welcome',
      html: '<p>Welcome, Alice!</p>',
      text: undefined,
    });

    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).toBe('completed');
  });

  it('TC-W-INT-02: sms channel dispatch to mock provider adapter and recipient extraction', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const mockSmsAdapter: SmsProvider = {
      sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'sms-msg-02' }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        sms: {
          type: 'test-sms',
          adapter: mockSmsAdapter,
          from: '+18005550199',
        },
      },
    });

    activeNotifier.registerTemplate('otp', 'Your verification code is {{code}}');

    const queueEvents = new QueueEvents('sms', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['sms'] });

    const completionPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMS job timeout')), 10000);
      queueEvents.on('completed', ({ jobId }) => {
        clearTimeout(timer);
        resolve(jobId);
      });
    });

    const result = await activeNotifier.notify({
      to: { phone: '+14155552671' },
      channels: ['sms'],
      template: 'otp',
      data: { code: '482910' },
    });

    const completedJobId = await completionPromise;
    expect(completedJobId).toBe(result.jobId);

    expect(mockSmsAdapter.sendSms).toHaveBeenCalledTimes(1);
    expect(mockSmsAdapter.sendSms).toHaveBeenCalledWith({
      to: '+14155552671',
      from: '+18005550199',
      body: 'Your verification code is 482910',
      templateId: 'otp',
      variables: undefined,
    });
  });

  it('TC-W-INT-03: push channel dispatch to mock provider adapter and token extraction', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const mockPushAdapter: PushProvider = {
      sendPush: vi.fn().mockResolvedValue({ success: true, messageId: 'push-msg-03' }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        push: {
          type: 'test-push',
          adapter: mockPushAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('alert', 'System Alert: {{message}}');

    const queueEvents = new QueueEvents('push', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['push'] });

    const completionPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Push job timeout')), 10000);
      queueEvents.on('completed', ({ jobId }) => {
        clearTimeout(timer);
        resolve(jobId);
      });
    });

    const result = await activeNotifier.notify({
      to: { pushToken: 'device_token_xyz_987' },
      channels: ['push'],
      template: 'alert',
      data: { message: 'CPU above 95%' },
    });

    const completedJobId = await completionPromise;
    expect(completedJobId).toBe(result.jobId);

    expect(mockPushAdapter.sendPush).toHaveBeenCalledTimes(1);
    expect(mockPushAdapter.sendPush).toHaveBeenCalledWith({
      token: 'device_token_xyz_987',
      title: 'Alert: alert',
      body: 'System Alert: CPU above 95%',
      data: undefined,
    });
  });

  it('TC-W-INT-04: transient retryable error eventually succeeds on attempt 2', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    let callCount = 0;
    const timestamps: number[] = [];

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn(async () => {
        callCount++;
        timestamps.push(Date.now());
        if (callCount === 1) {
          return { success: false, error: 'Rate limit 429', retryable: true };
        }
        return { success: true, messageId: 'retry-success-msg' };
      }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('order', 'Order status: {{status}}');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const result = await activeNotifier.notify({
      to: { email: 'retry@example.com' },
      channels: ['email'],
      template: 'order',
      data: { status: 'shipped' },
    });

    await waitForJobCompleted(queueEvents, result.jobId, 15000);

    expect(mockEmailAdapter.sendEmail).toHaveBeenCalledTimes(2);

    // Bounded elapsed time check between attempt 1 and attempt 2 (exponential backoff nominal 1000ms)
    expect(timestamps.length).toBe(2);
    const deltaMs = timestamps[1] - timestamps[0];
    expect(deltaMs).toBeGreaterThanOrEqual(800);

    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).toBe('completed');
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });

    // DLQ must remain empty since job eventually succeeded
    const dlqQueue = registry.getQueue('dlq');
    const dlqJobId = generateDlqJobId('email', result.jobId);
    const dlqJob = await dlqQueue.getJob(dlqJobId);
    expect(dlqJob).toBeFalsy();
  }, 20000);

  it('TC-W-INT-05: transient retry exhaustion executes 3 attempts and routes to DLQ', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    let callCount = 0;
    const timestamps: number[] = [];

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn(async () => {
        callCount++;
        timestamps.push(Date.now());
        const err = new Error('ECONNRESET: socket hang up');
        (err as Record<string, unknown>).code = 'ECONNRESET';
        throw err;
      }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('exhaust', 'Message: {{text}}');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const result = await activeNotifier.notify({
      to: { email: 'fail@example.com' },
      channels: ['email'],
      template: 'exhaust',
      data: { text: 'critical alert' },
    });

    await waitForJobFailed(queueEvents, result.jobId, 20000);

    // Exactly 3 total processing attempts: 1 initial + 2 retries
    expect(mockEmailAdapter.sendEmail).toHaveBeenCalledTimes(3);

    // Total elapsed time across 3 attempts (nominal backoffs: 1000ms + 2000ms = ~3000ms)
    expect(timestamps.length).toBe(3);
    const totalElapsedMs = timestamps[2] - timestamps[0];
    expect(totalElapsedMs).toBeGreaterThanOrEqual(2500);

    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).toBe('failed');

    // Verify DLQ contents and contract
    const dlqQueue = registry.getQueue('dlq');
    const dlqJobId = generateDlqJobId('email', result.jobId);
    const dlqBullJob = await dlqQueue.getJob(dlqJobId);
    expect(dlqBullJob).not.toBeNull();

    const deadLetter = dlqBullJob?.data as unknown as DeadLetterJob;
    expect(deadLetter.originalJob.id).toBe(result.jobId);
    expect(deadLetter.terminalReason).toBe('MAX_RETRIES_EXCEEDED');
    expect(deadLetter.attemptsMade).toBe(3);
    expect(deadLetter.error.retryable).toBe(true);
    expect(deadLetter.error.message).toContain('ECONNRESET');
    expect(deadLetter.traceId).toBeDefined();
    expect(deadLetter.failedAt).toBeGreaterThan(0);
  }, 25000);

  it('TC-W-INT-06: non-retryable error routes immediately to DLQ on attempt 1 without retries', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn().mockResolvedValue({
        success: false,
        error: '550 User unknown / invalid mailbox',
        retryable: false,
      }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('receipt', 'Your receipt: {{id}}');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const result = await activeNotifier.notify({
      to: { email: 'baduser@example.com' },
      channels: ['email'],
      template: 'receipt',
      data: { id: 'RC-123' },
    });

    await waitForJobFailed(queueEvents, result.jobId, 10000);

    // Non-retryable error aborts immediately on attempt 1
    expect(mockEmailAdapter.sendEmail).toHaveBeenCalledTimes(1);

    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).toBe('failed');

    // Inspect DLQ entry
    const dlqQueue = registry.getQueue('dlq');
    const dlqJobId = generateDlqJobId('email', result.jobId);
    const dlqBullJob = await dlqQueue.getJob(dlqJobId);
    expect(dlqBullJob).not.toBeNull();

    const deadLetter = dlqBullJob?.data as unknown as DeadLetterJob;
    expect(deadLetter.originalJob.id).toBe(result.jobId);
    expect(deadLetter.terminalReason).toBe('NON_RETRYABLE_ERROR');
    expect(deadLetter.attemptsMade).toBe(1);
    expect(deadLetter.error.retryable).toBe(false);
  });

  it('TC-W-INT-07: malformed job payload directly in Redis routes to DLQ with MALFORMED_JOB', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: { sendEmail: vi.fn() },
        },
      },
    });

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    // Directly inject a malformed payload missing required schema fields into BullMQ
    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const rawMalformedJobId = 'raw-corrupt-job-007';

    const failPromise = waitForJobFailed(queueEvents, rawMalformedJobId, 10000);

    await emailQueue.add(
      'email',
      {
        id: rawMalformedJobId,
        channel: 'email',
        // 'to', 'templateId', 'renderedBody', and 'metadata' are missing
      } as unknown as NotificationJob,
      { jobId: rawMalformedJobId },
    );

    await failPromise;

    // Verify DLQ has record with terminalReason: MALFORMED_JOB
    const dlqQueue = registry.getQueue('dlq');
    const expectedDlqJobId = generateDlqJobId('email', rawMalformedJobId);
    const dlqBullJob = await dlqQueue.getJob(expectedDlqJobId);
    expect(dlqBullJob).not.toBeNull();

    const deadLetter = dlqBullJob?.data as unknown as DeadLetterJob;
    expect(deadLetter.originalJob.id).toBe(rawMalformedJobId);
    expect(deadLetter.terminalReason).toBe('MALFORMED_JOB');
    expect(deadLetter.attemptsMade).toBe(1);
  });

  it('TC-W-INT-08: colon-free Base64URL DLQ job ID deduplicates replay in Redis', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const sourceJobId = '018f9e60-466d-71b3-a00e-6f8d098ef7ab';
    const sampleJob: NotificationJob = {
      id: sourceJobId,
      channel: 'email',
      provider: 'test-provider',
      to: { email: 'dedup@example.com' },
      templateId: 'test-tpl',
      renderedBody: 'Test Body',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_dedup_01',
      },
    };

    const registry = getOrCreateDefaultRegistry(redisUrl);
    const dlqJobId1 = await routeToDlq(
      sampleJob,
      new Error('Initial failure'),
      1,
      'NON_RETRYABLE_ERROR',
      { registry },
    );

    const expectedDlqId = generateDlqJobId('email', sourceJobId);
    expect(dlqJobId1).toBe(expectedDlqId);

    // Verify custom job ID contains zero colon characters
    expect(expectedDlqId).not.toContain(':');

    // Verify raw Redis key matches BullMQ namespace bull:notifykit:dlq:<customId>
    const dlqHash = await directRedisClient.hgetall(`bull:notifykit:dlq:${expectedDlqId}`);
    expect(dlqHash).toBeDefined();
    expect(dlqHash.name).toBe('dlq');
    const dlqData = JSON.parse(dlqHash.data);
    expect(dlqData.originalJob.id).toBe(sourceJobId);

    // Second routing call for the identical terminal job (simulating duplicate/replay processing)
    const dlqJobId2 = await routeToDlq(
      sampleJob,
      new Error('Duplicate replay failure'),
      1,
      'NON_RETRYABLE_ERROR',
      { registry },
    );
    expect(dlqJobId2).toBe(expectedDlqId);

    // BullMQ deduplicates identical job IDs in Redis; wait list should have only 1 entry
    const dlqWait = await directRedisClient.lrange('bull:notifykit:dlq:wait', 0, -1);
    const occurrences = dlqWait.filter((id) => id === expectedDlqId);
    expect(occurrences.length).toBe(1);
  });

  it('TC-W-INT-09: DLQ enqueue failure propagates error without false success', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn().mockResolvedValue({
        success: false,
        error: 'Permanent delivery error',
        retryable: false,
      }),
    };

    // Spy on routeToDlq to simulate persistent DLQ enqueue failure
    vi.spyOn(dlqModule, 'routeToDlq').mockRejectedValue(
      new Error('Simulated Redis DLQ write connection failure'),
    );

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('dlq-fail', 'Order notification');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const result = await activeNotifier.notify({
      to: { email: 'dlqfail@example.com' },
      channels: ['email'],
      template: 'dlq-fail',
      data: {},
    });

    const failedEvent = await waitForJobFailed(queueEvents, result.jobId, 25000);

    // Error from DLQ must propagate through the worker
    expect(failedEvent.failedReason).toContain('Simulated Redis DLQ write connection failure');

    // Absence of false completion: job is never marked as completed
    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).not.toBe('completed');
  }, 30000);

  it('TC-W-INT-10: graceful shutdown drains in-flight job before stopWorker() resolves', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    let inFlightStarted = false;
    let inFlightCompleted = false;

    const mockEmailAdapter: EmailProvider = {
      sendEmail: vi.fn(async () => {
        inFlightStarted = true;
        // Simulate in-flight I/O latency
        await new Promise((resolve) => setTimeout(resolve, 300));
        inFlightCompleted = true;
        return { success: true, messageId: 'drained-msg-10' };
      }),
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: {
          type: 'test-email',
          adapter: mockEmailAdapter,
        },
      },
    });

    activeNotifier.registerTemplate('drain', 'Draining notification');

    const queueEvents = new QueueEvents('email', {
      connection: sharedConnection,
      prefix: 'bull:notifykit',
    });
    await queueEvents.waitUntilReady();
    activeQueueEvents.add(queueEvents);

    activeNotifier.startWorker({ channels: ['email'] });

    const result = await activeNotifier.notify({
      to: { email: 'drain@example.com' },
      channels: ['email'],
      template: 'drain',
      data: {},
    });

    // Wait until the worker has leased the job and execution has begun
    const startTime = Date.now();
    while (!inFlightStarted && Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(inFlightStarted).toBe(true);

    // While in-flight execution is actively underway, initiate graceful shutdown
    const stopPromise = activeNotifier.stopWorker();

    // The job should not have completed yet at the exact moment stopWorker is invoked
    expect(inFlightCompleted).toBe(false);

    // Await graceful shutdown to resolve
    await stopPromise;

    // After stopWorker resolves, the in-flight job must have drained and completed
    expect(inFlightCompleted).toBe(true);

    // Job in Redis must be marked completed
    const registry = getOrCreateDefaultRegistry(redisUrl);
    const emailQueue = registry.getQueue('email');
    const job = await emailQueue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const state = await job?.getState();
    expect(state).toBe('completed');
  });
});
