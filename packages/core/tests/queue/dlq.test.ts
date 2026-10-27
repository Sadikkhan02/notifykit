import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeRedisConnection } from '../../src/queue/connection.js';
import { generateDlqJobId, routeToDlq, type DeadLetterJob } from '../../src/queue/dlq.js';
import { resetDefaultRegistry } from '../../src/queue/enqueue.js';
import type { NotificationJob } from '../../src/queue/payload.js';
import type { QueueRegistry } from '../../src/queue/registry.js';

describe('Dead-Letter Queue (DLQ) — dlq.ts', () => {
  afterEach(async () => {
    await resetDefaultRegistry();
    await closeRedisConnection();
    vi.restoreAllMocks();
  });
  describe('generateDlqJobId()', () => {
    it('generates a collision-resistant, colon-free deterministic DLQ job ID', () => {
      const sourceId = '0192a4b8-82df-76a0-80a5-f7163c46e3ea';
      const dlqId = generateDlqJobId('email', sourceId);

      // Must be prefixed with dlq-email-
      expect(dlqId.startsWith('dlq-email-')).toBe(true);

      // Must contain ZERO colon characters
      expect(dlqId.includes(':')).toBe(false);

      // Must be deterministic
      expect(generateDlqJobId('email', sourceId)).toBe(dlqId);
    });

    it('guarantees bijective collision-resistance (different IDs never collide)', () => {
      const id1 = '0192a4b8-82df-76a0-80a5-f7163c46e3ea';
      const id2 = '0192a4b8-82df-76a0-80a5-f7163c46e3eb';

      const dlqId1 = generateDlqJobId('sms', id1);
      const dlqId2 = generateDlqJobId('sms', id2);

      expect(dlqId1).not.toBe(dlqId2);
      expect(dlqId1.includes(':')).toBe(false);
      expect(dlqId2.includes(':')).toBe(false);
    });
  });

  describe('routeToDlq()', () => {
    const sampleJob: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'nodemailer',
      to: { email: 'alice@example.com' },
      templateId: 'order-confirmed',
      renderedBody: 'Your order is confirmed!',
      variables: { orderId: 'ORD-123' },
      metadata: {
        enqueuedAt: 1700000000000,
        traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      },
    };

    it('assembles complete DeadLetterJob payload with intact original job and error diagnostics', async () => {
      let capturedPayload: DeadLetterJob | null = null;
      let capturedOptions: Record<string, unknown> | null = null;

      const mockQueue = {
        add: vi.fn().mockImplementation((_name, data, opts) => {
          capturedPayload = data;
          capturedOptions = opts;
          return Promise.resolve({ id: opts.jobId });
        }),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const error = new Error('500 Internal Server Error from upstream');
      (error as unknown as { statusCode: number }).statusCode = 500;

      const dlqJobId = await routeToDlq(
        sampleJob,
        error,
        3,
        'MAX_RETRIES_EXCEEDED',
        { registry: mockRegistry },
        { success: false, error: '500 Server Error', retryable: true },
      );

      expect(dlqJobId).toBe(generateDlqJobId('email', sampleJob.id));
      expect(mockRegistry.getQueue).toHaveBeenCalledWith('dlq');
      expect(mockQueue.add).toHaveBeenCalledTimes(1);

      // Verify permanent retention options
      expect(capturedOptions).toEqual({
        jobId: dlqJobId,
        removeOnComplete: false,
        removeOnFail: false,
      });

      // Verify DeadLetterJob payload integrity
      expect(capturedPayload).not.toBeNull();
      const payload = capturedPayload as unknown as DeadLetterJob;
      expect(payload.originalJob).toEqual(sampleJob);
      expect(payload.originalJob.id).toBe(sampleJob.id); // Original source ID preserved untouched
      expect(payload.traceId).toBe(sampleJob.metadata.traceId);
      expect(payload.attemptsMade).toBe(3);
      expect(payload.terminalReason).toBe('MAX_RETRIES_EXCEEDED');
      expect(payload.failedAt).toBeGreaterThan(0);
      expect(payload.error.message).toBe('500 Internal Server Error from upstream');
      expect(payload.error.retryable).toBe(true);
      expect(payload.error.httpStatus).toBe(500);
      expect(payload.error.stack).toBeDefined();
    });

    it('supports NON_RETRYABLE_ERROR terminal reason for immediate client failures', async () => {
      let capturedPayload: DeadLetterJob | null = null;

      const mockQueue = {
        add: vi.fn().mockImplementation((_name, data, opts) => {
          capturedPayload = data;
          return Promise.resolve({ id: opts.jobId });
        }),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const error = new Error('401 Unauthorized API key revoked');

      await routeToDlq(
        sampleJob,
        error,
        1,
        'NON_RETRYABLE_ERROR',
        { registry: mockRegistry },
        { success: false, error: 'Unauthorized', retryable: false },
      );

      const payload = capturedPayload as unknown as DeadLetterJob;
      expect(payload.terminalReason).toBe('NON_RETRYABLE_ERROR');
      expect(payload.attemptsMade).toBe(1);
      expect(payload.error.retryable).toBe(false);
      expect(payload.error.httpStatus).toBe(401);
    });

    it('failure-safety: propagates error when DLQ enqueue fails instead of swallowing it', async () => {
      const mockQueue = {
        add: vi.fn().mockRejectedValue(new Error('Redis connection refused during DLQ push')),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const error = new Error('Delivery failed');

      await expect(
        routeToDlq(sampleJob, error, 3, 'MAX_RETRIES_EXCEEDED', { registry: mockRegistry }),
      ).rejects.toThrow('Redis connection refused during DLQ push');
    });

    it('preserves bounded deduplication semantics with deterministic job ID on repeated routing', async () => {
      const addedIds: string[] = [];
      const mockQueue = {
        add: vi.fn().mockImplementation((_name, _data, opts) => {
          addedIds.push(opts.jobId);
          return Promise.resolve({ id: opts.jobId });
        }),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const id1 = await routeToDlq(sampleJob, new Error('Fail 1'), 3, 'MAX_RETRIES_EXCEEDED', {
        registry: mockRegistry,
      });

      const id2 = await routeToDlq(
        sampleJob,
        new Error('Fail 2 (replay)'),
        3,
        'MAX_RETRIES_EXCEEDED',
        {
          registry: mockRegistry,
        },
      );

      expect(id1).toBe(id2);
      expect(addedIds[0]).toBe(addedIds[1]);
      expect(id1).toBe(generateDlqJobId('email', sampleJob.id));
    });

    it('uses fallback traceId and empty error metadata gracefully', async () => {
      let capturedPayload: DeadLetterJob | null = null;
      const mockQueue = {
        add: vi.fn().mockImplementation((_name, data, opts) => {
          capturedPayload = data;
          return Promise.resolve({ id: opts.jobId });
        }),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const minimalJob = {
        ...sampleJob,
        metadata: {} as unknown as NotificationJob['metadata'],
      };

      await routeToDlq(minimalJob, undefined, 1, 'UNHANDLED_EXCEPTION', {
        registry: mockRegistry,
      });

      const payload = capturedPayload as unknown as DeadLetterJob;
      expect(payload.traceId).toBe('unknown-trace');
      expect(payload.error.message).toBe('Unknown delivery error');
    });

    it('falls back to dlqJobId when bullJob.id is undefined', async () => {
      const mockQueue = {
        add: vi.fn().mockResolvedValue({ id: undefined }),
      };

      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const id = await routeToDlq(sampleJob, new Error('Test'), 1, 'NON_RETRYABLE_ERROR', {
        registry: mockRegistry,
      });

      expect(id).toBe(generateDlqJobId('email', sampleJob.id));
    });

    it('falls back to default registry when options or registry are omitted', async () => {
      const mockQueue = {
        add: vi.fn().mockResolvedValue({ id: 'dlq-default-id' }),
      };
      const mockRegistry = {
        getQueue: vi.fn().mockReturnValue(mockQueue),
      } as unknown as QueueRegistry;

      const enqueueModule = await import('../../src/queue/enqueue.js');
      vi.spyOn(enqueueModule, 'getOrCreateDefaultRegistry').mockReturnValue(mockRegistry);

      const id = await routeToDlq(
        sampleJob,
        new Error('Default queue test'),
        1,
        'NON_RETRYABLE_ERROR',
      );
      expect(id).toBe('dlq-default-id');
      expect(mockRegistry.getQueue).toHaveBeenCalledWith('dlq');
    });
  });
});
