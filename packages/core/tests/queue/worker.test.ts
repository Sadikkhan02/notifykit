import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotifyKitError } from '../../src/errors/notifykit-error.js';
import type { NotifierConfig } from '../../src/interfaces/config.js';
import type { EmailProvider, SmsProvider } from '../../src/interfaces/providers.js';
import type { ProviderResult } from '../../src/interfaces/result.js';
import { MissingAdapterError } from '../../src/orchestrator/errors.js';
import { closeRedisConnection, createRedisConnection } from '../../src/queue/connection.js';
import * as dlqModule from '../../src/queue/dlq.js';
import { resetDefaultRegistry } from '../../src/queue/enqueue.js';
import type { NotificationJob } from '../../src/queue/payload.js';
import { QueueRegistry } from '../../src/queue/registry.js';
import {
  createChannelWorker,
  processNotificationJob,
  resolveChannelConcurrency,
  validateConcurrency,
  WorkerManager,
} from '../../src/queue/worker.js';

describe('Worker Engine — worker.ts', () => {
  const validJobData: NotificationJob = {
    id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
    channel: 'email',
    provider: 'mock-smtp',
    to: { email: 'user@example.com' },
    templateId: 'welcome',
    renderedBody: '<h1>Welcome!</h1>',
    variables: { subject: 'Welcome subject' },
    metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
  };

  afterEach(async () => {
    await resetDefaultRegistry();
    await closeRedisConnection();
    vi.restoreAllMocks();
  });

  describe('Concurrency Validation & Resolution', () => {
    it('validates undefined, positive integer, and per-channel positive integers', () => {
      expect(() => validateConcurrency(undefined)).not.toThrow();
      expect(() => validateConcurrency(5)).not.toThrow();
      expect(() => validateConcurrency({ email: 10, sms: 2 })).not.toThrow();
    });

    it('rejects non-positive, non-integer, and invalid concurrency options', () => {
      expect(() => validateConcurrency(0)).toThrow(NotifyKitError);
      expect(() => validateConcurrency(-3)).toThrow(NotifyKitError);
      expect(() => validateConcurrency(2.5)).toThrow(NotifyKitError);
      expect(() => validateConcurrency({ email: 0 })).toThrow(NotifyKitError);
      expect(() => validateConcurrency({ sms: -1 })).toThrow(NotifyKitError);
      expect(() => validateConcurrency({ push: 3.14 })).toThrow(NotifyKitError);
      expect(() => validateConcurrency('five' as unknown as number)).toThrow(NotifyKitError);
    });

    it('resolves default concurrency (5) when unconfigured, or channel-specific override', () => {
      expect(resolveChannelConcurrency('email')).toBe(5);
      expect(resolveChannelConcurrency('email', 10)).toBe(10);
      expect(resolveChannelConcurrency('email', { email: 8, sms: 2 })).toBe(8);
      expect(resolveChannelConcurrency('sms', { email: 8 })).toBe(5);
    });
  });

  describe('processNotificationJob()', () => {
    function createMockBullJob(
      data: unknown,
      attemptsMade: number = 0,
      attemptsLimit: number = 3,
    ): Job<NotificationJob, ProviderResult, string> {
      return {
        id: 'job_123',
        queueName: 'email',
        data,
        attemptsMade,
        opts: { attempts: attemptsLimit },
      } as unknown as Job<NotificationJob, ProviderResult, string>;
    }

    it('successfully dispatches valid job and returns provider result', async () => {
      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg_ok' }),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      const job = createMockBullJob(validJobData, 0, 3);
      const result = await processNotificationJob(job, { config });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_ok');
      expect(mockEmailAdapter.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('handles malformed job payload by routing to DLQ with MALFORMED_JOB and throwing UnrecoverableError', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-mock-id');

      const malformedData = {
        // missing required fields
        channel: 'email',
      };

      const job = createMockBullJob(malformedData, 0, 3);

      await expect(processNotificationJob(job, { config: { providers: {} } })).rejects.toThrow(
        UnrecoverableError,
      );

      expect(routeToDlqSpy).toHaveBeenCalledTimes(1);
      const [dlqJob, error, attempts, reason] = routeToDlqSpy.mock.calls[0];
      expect(reason).toBe('MALFORMED_JOB');
      expect(attempts).toBe(1);
      expect(error).toBeInstanceOf(Error);
      expect(dlqJob.id).toBe('job_123'); // falls back to BullMQ job id
    });

    it('propagates DLQ enqueue rejection on malformed job without swallowing', async () => {
      vi.spyOn(dlqModule, 'routeToDlq').mockRejectedValue(
        new Error('Redis connection failed during DLQ push'),
      );

      const job = createMockBullJob({ invalid: true }, 0, 3);

      await expect(processNotificationJob(job, { config: { providers: {} } })).rejects.toThrow(
        'Redis connection failed during DLQ push',
      );
    });

    it('on Attempt 1 retryable failure: re-throws error for BullMQ backoff without DLQ routing', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockRejectedValue(new Error('ECONNRESET socket hang up')),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      // Attempt 1: attemptsMade === 0
      const job = createMockBullJob(validJobData, 0, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(
        'ECONNRESET socket hang up',
      );
      // Must NOT route to DLQ on attempt 1 of 3
      expect(routeToDlqSpy).not.toHaveBeenCalled();
    });

    it('on Attempt 2 retryable failure: re-throws error for BullMQ backoff without DLQ routing', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockResolvedValue({
          success: false,
          error: 'Rate limit exceeded (429)',
          retryable: true,
        }),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      // Attempt 2: attemptsMade === 1
      const job = createMockBullJob(validJobData, 1, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(
        'Rate limit exceeded (429)',
      );
      // Must NOT route to DLQ on attempt 2 of 3
      expect(routeToDlqSpy).not.toHaveBeenCalled();
    });

    it('on Attempt 3 terminal retryable failure: routes to DLQ with MAX_RETRIES_EXCEEDED exactly once and re-throws', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      // Attempt 3: attemptsMade === 2 (currentAttempt = 2 + 1 = 3 >= 3)
      const job = createMockBullJob(validJobData, 2, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(
        '503 Service Unavailable',
      );

      expect(routeToDlqSpy).toHaveBeenCalledTimes(1);
      const [, error, attempts, reason] = routeToDlqSpy.mock.calls[0];
      expect(reason).toBe('MAX_RETRIES_EXCEEDED');
      expect(attempts).toBe(3);
      expect((error as Error).message).toBe('503 Service Unavailable');
    });

    it('on non-retryable failure: routes to DLQ immediately with NON_RETRYABLE_ERROR and throws UnrecoverableError', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockResolvedValue({
          success: false,
          error: 'Account suspended - payment required (402)',
          retryable: false,
        }),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      // Even on attempt 1 (attemptsMade = 0), non-retryable error aborts immediately
      const job = createMockBullJob(validJobData, 0, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(UnrecoverableError);

      expect(routeToDlqSpy).toHaveBeenCalledTimes(1);
      const [, , attempts, reason] = routeToDlqSpy.mock.calls[0];
      expect(reason).toBe('NON_RETRYABLE_ERROR');
      expect(attempts).toBe(1);
    });

    it('on MissingAdapterError: routes to DLQ with MISSING_ADAPTER and throws UnrecoverableError', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      // Provider not configured in config
      const config: NotifierConfig = { providers: {} };
      const job = createMockBullJob(validJobData, 0, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(UnrecoverableError);

      expect(routeToDlqSpy).toHaveBeenCalledTimes(1);
      const [, , attempts, reason] = routeToDlqSpy.mock.calls[0];
      expect(reason).toBe('MISSING_ADAPTER');
      expect(attempts).toBe(1);
    });

    it('propagates DLQ enqueue rejection on terminal failure without swallowing', async () => {
      vi.spyOn(dlqModule, 'routeToDlq').mockRejectedValue(new Error('DLQ Redis OOM error'));

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockRejectedValue(new Error('500 Server Error')),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      const job = createMockBullJob(validJobData, 2, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow('DLQ Redis OOM error');
    });

    it('handles non-Error dispatch failure on final attempt by re-throwing Error with classified message', async () => {
      vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-id');

      const mockEmailAdapter: EmailProvider = {
        name: 'mock-smtp',
        sendEmail: vi.fn().mockResolvedValue({
          success: false,
          error: 'Explicit non-error string failure',
          retryable: true,
        }),
      };

      const config: NotifierConfig = {
        providers: {
          email: { type: 'mock-smtp', adapter: mockEmailAdapter },
        },
      };

      const job = createMockBullJob(validJobData, 2, 3);

      await expect(processNotificationJob(job, { config })).rejects.toThrow(
        'Explicit non-error string failure',
      );
    });

    it('handles malformed job payload when partial fields are present in data', async () => {
      const routeToDlqSpy = vi.spyOn(dlqModule, 'routeToDlq').mockResolvedValue('dlq-mock-id');

      const partiallyMalformedData = {
        id: 'partial-id',
        channel: 'sms',
        provider: 'twilio',
        to: { phone: '+1234567890' },
        templateId: 'tpl-1',
        renderedBody: 'Rendered text',
        metadata: { traceId: 'trace-custom' },
        // But missing required fields according to strict schema
      };

      const job = createMockBullJob(partiallyMalformedData, 0, 3);

      await expect(processNotificationJob(job, { config: { providers: {} } })).rejects.toThrow(
        UnrecoverableError,
      );

      expect(routeToDlqSpy).toHaveBeenCalledTimes(1);
      const [dlqJob] = routeToDlqSpy.mock.calls[0];
      expect(dlqJob.id).toBe('partial-id');
      expect(dlqJob.channel).toBe('sms');
    });
  });

  describe('createChannelWorker()', () => {
    it('constructs a BullMQ Worker instance with prefix bull:notifykit and specified concurrency', async () => {
      const config: NotifierConfig = {
        providers: {
          email: { type: 'nodemailer' },
        },
      };

      const worker = createChannelWorker('email', {
        config,
        concurrency: 12,
      });

      expect(worker).toBeInstanceOf(Worker);
      expect(worker.name).toBe('email');
      expect(worker.opts.prefix).toBe('bull:notifykit');
      expect(worker.opts.concurrency).toBe(12);

      await worker.close();
    });

    it('executes job processing through worker processor callback', async () => {
      const mockSend = vi.fn().mockResolvedValue({ success: true, messageId: 'm1' });
      const config: NotifierConfig = {
        providers: {
          email: {
            type: 'mock',
            adapter: { name: 'mock', sendEmail: mockSend },
          },
        },
      };
      const worker = createChannelWorker('email', { config });
      const mockJob = {
        id: 'j1',
        queueName: 'email',
        data: validJobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<NotificationJob, ProviderResult, string>;

      const processFn = (
        worker as unknown as {
          processFn: (job: Job<NotificationJob, ProviderResult, string>) => Promise<ProviderResult>;
        }
      ).processFn;

      const res = await processFn(mockJob);
      expect(res.success).toBe(true);
      await worker.close();
    });

    it('reuses connection from registry and tests QueueRegistry.getConnection()', async () => {
      const mockRedis = createRedisConnection();
      const registry = new QueueRegistry(mockRedis);
      expect(registry.getConnection()).toBe(mockRedis);

      const config: NotifierConfig = {
        providers: {
          sms: { type: 'twilio' },
        },
      };

      const worker = createChannelWorker('sms', {
        config,
        registry,
      });

      expect(worker).toBeInstanceOf(Worker);
      await worker.close();
    });
  });

  describe('WorkerManager', () => {
    it('starts workers only for configured channels when opts.channels is omitted', async () => {
      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
            sms: { type: 'twilio' },
            // push is unconfigured
          },
        },
      });

      manager.start();
      expect(manager.isRunning()).toBe(true);

      const activeWorkers = manager.getActiveWorkers();
      expect(activeWorkers.size).toBe(2);
      expect(activeWorkers.has('email')).toBe(true);
      expect(activeWorkers.has('sms')).toBe(true);
      expect(activeWorkers.has('push')).toBe(false);

      await manager.stop();
      expect(manager.isRunning()).toBe(false);
      expect(manager.getActiveWorkers().size).toBe(0);
    });

    it('logs warning and starts 0 workers when opts.channels is omitted and no providers configured', () => {
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
      };

      const manager = new WorkerManager({
        config: { providers: {} },
        logger: mockLogger as unknown as WorkerManager['logger'],
      });

      manager.start();
      expect(manager.isRunning()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no configured channels'),
      );
    });

    it('throws MissingAdapterError synchronously when explicitly requested channel lacks adapter', () => {
      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
          },
        },
      });

      expect(() =>
        manager.start({
          channels: ['email', 'push'], // push lacks adapter
        }),
      ).toThrow(MissingAdapterError);

      // No workers should have been left active
      expect(manager.isRunning()).toBe(false);
      expect(manager.getActiveWorkers().size).toBe(0);
    });

    it('throws NotifyKitError (E_INVALID_CONCURRENCY) synchronously on invalid concurrency', () => {
      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
          },
        },
      });

      expect(() => manager.start({ concurrency: 0 })).toThrow(NotifyKitError);
      expect(manager.isRunning()).toBe(false);
    });

    it('is idempotent when start() is called while workers are already running', async () => {
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
      };

      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
          },
        },
        logger: mockLogger as unknown as WorkerManager['logger'],
      });

      manager.start();
      const firstWorkers = manager.getActiveWorkers();
      expect(firstWorkers.size).toBe(1);

      // Second start call
      manager.start();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('already running'));
      expect(manager.getActiveWorkers().get('email')).toBe(firstWorkers.get('email'));

      await manager.stop();
    });

    it('initiates background teardown and re-throws when worker construction fails mid-loop', () => {
      let emailWorkerClosed = false;
      const mockEmailWorker = {
        name: 'email',
        close: vi.fn().mockImplementation(() => {
          emailWorkerClosed = true;
          return Promise.resolve();
        }),
      } as unknown as Worker<NotificationJob, ProviderResult, string>;

      const mockCreateWorker = vi.fn().mockImplementation((channel: string) => {
        if (channel === 'email') {
          return mockEmailWorker;
        }
        throw new Error('Simulated Redis failure on sms worker constructor');
      });

      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
            sms: { type: 'twilio' },
          },
        },
        createWorker: mockCreateWorker,
      });

      expect(() => manager.start({ channels: ['email', 'sms'] })).toThrow(
        'Simulated Redis failure on sms worker constructor',
      );

      expect(manager.isRunning()).toBe(false);
      expect(manager.getActiveWorkers().size).toBe(0);

      // Verify background teardown was initiated on email worker
      expect(emailWorkerClosed).toBe(true);
      expect(mockEmailWorker.close).toHaveBeenCalledTimes(1);
    });

    it('stop() drains and closes all active workers, and is safe when called repeatedly', async () => {
      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
          },
        },
      });

      manager.start();
      expect(manager.isRunning()).toBe(true);

      await expect(manager.stop()).resolves.toBeUndefined();
      expect(manager.isRunning()).toBe(false);

      // Safe repeated call
      await expect(manager.stop()).resolves.toBeUndefined();
    });

    it('handles and logs error if worker.close() rejects during partial startup teardown', async () => {
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
      };

      const mockFailingCloseWorker = {
        name: 'email',
        close: vi.fn().mockRejectedValue(new Error('Close rejection')),
      } as unknown as Worker<NotificationJob, ProviderResult, string>;

      const mockCreateWorker = vi.fn().mockImplementation((channel: string) => {
        if (channel === 'email') {
          return mockFailingCloseWorker;
        }
        throw new Error('Channel construction throw');
      });

      const manager = new WorkerManager({
        config: {
          providers: {
            email: { type: 'nodemailer' },
            sms: { type: 'twilio' },
          },
        },
        logger: mockLogger as unknown as WorkerManager['logger'],
        createWorker: mockCreateWorker,
      });

      expect(() => manager.start({ channels: ['email', 'sms'] })).toThrow(
        'Channel construction throw',
      );

      // Wait a microtask tick for .catch() callback on close() promise to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining('partial startup teardown'),
      );
    });
  });
});
