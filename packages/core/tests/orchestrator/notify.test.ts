import { describe, expect, it, vi } from 'vitest';
import { MissingTemplateError, MissingVariableError } from '../../src/errors/index.js';
import { getLogger } from '../../src/logging/logger.js';
import { InvalidEventError } from '../../src/orchestrator/errors.js';
import { notify } from '../../src/orchestrator/notify.js';
import type { NotificationJob } from '../../src/queue/payload.js';
import type { QueueRegistry } from '../../src/queue/index.js';
import { TemplateStore } from '../../src/templates/store.js';

describe('notify() Orchestrator Flow', () => {
  function createTestContext(enqueuedJobs: NotificationJob[] = []) {
    const templateStore = new TemplateStore();
    templateStore.register('welcome-email', 'Hello, {{name}}! Your code is {{code}}.');
    templateStore.register('simple', 'Static text.');

    const mockRegistry = {
      getQueue: vi.fn().mockReturnValue({
        add: vi.fn().mockImplementation((name: string, data: NotificationJob) => {
          enqueuedJobs.push(data);
          return Promise.resolve({ id: data.id });
        }),
      }),
    };

    const ctx = {
      config: {
        redis: 'redis://localhost:6379',
        providers: {
          email: { type: 'nodemailer' },
          sms: { type: 'twilio' },
        },
      },
      registry: mockRegistry as unknown as QueueRegistry,
      templateStore,
      logger: getLogger('silent'),
    };

    return { ctx, enqueuedJobs, mockRegistry };
  }

  it('validates event, renders template, enqueues job, and returns { jobId }', async () => {
    const { ctx, enqueuedJobs } = createTestContext();

    const result = await notify(
      {
        to: { email: 'alice@example.com' },
        channels: ['email'],
        template: 'welcome-email',
        data: { name: 'Alice', code: '9876' },
      },
      ctx,
    );

    expect(result).toHaveProperty('jobId');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBe(36);

    // Enqueued job assertions
    expect(enqueuedJobs).toHaveLength(1);
    const job = enqueuedJobs[0];
    expect(job.id).toBe(result.jobId);
    expect(job.channel).toBe('email');
    expect(job.provider).toBe('nodemailer');
    expect(job.to.email).toBe('alice@example.com');
    expect(job.templateId).toBe('welcome-email');
    expect(job.renderedBody).toBe('Hello, Alice! Your code is 9876.');
    expect(job.metadata.traceId).toBeDefined();
    expect(job.metadata.enqueuedAt).toBeGreaterThan(0);
  });

  it('handles multi-channel events: shared traceId, distinct jobIds, returns primary jobId', async () => {
    const { ctx, enqueuedJobs } = createTestContext();

    const result = await notify(
      {
        to: { email: 'bob@example.com', phone: '+14155552671' },
        channels: ['email', 'sms'],
        template: 'welcome-email',
        data: { name: 'Bob', code: '1111' },
      },
      ctx,
    );

    expect(enqueuedJobs).toHaveLength(2);
    const emailJob = enqueuedJobs[0];
    const smsJob = enqueuedJobs[1];

    expect(emailJob.channel).toBe('email');
    expect(smsJob.channel).toBe('sms');

    // Distinct job IDs
    expect(emailJob.id).not.toBe(smsJob.id);

    // Shared traceId
    expect(emailJob.metadata.traceId).toBe(smsJob.metadata.traceId);

    // Returned jobId matches the primary (first) enqueued job
    expect(result.jobId).toBe(emailJob.id);
  });

  it('fails fast on event schema validation before calling template render or queue', async () => {
    const { ctx, enqueuedJobs } = createTestContext();

    await expect(
      notify(
        {
          to: {}, // Missing required email
          channels: ['email'],
          template: 'simple',
          data: {},
        },
        ctx,
      ),
    ).rejects.toThrow(InvalidEventError);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it('fails fast on missing template before queueing any job', async () => {
    const { ctx, enqueuedJobs } = createTestContext();

    await expect(
      notify(
        {
          to: { email: 'charlie@example.com' },
          channels: ['email'],
          template: 'non-existent-template',
          data: {},
        },
        ctx,
      ),
    ).rejects.toThrow(MissingTemplateError);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it('fails fast on missing template variable before queueing any job (ADR-004)', async () => {
    const { ctx, enqueuedJobs } = createTestContext();

    await expect(
      notify(
        {
          to: { email: 'david@example.com' },
          channels: ['email'],
          template: 'welcome-email',
          data: { name: 'David' }, // missing 'code' variable
        },
        ctx,
      ),
    ).rejects.toThrow(MissingVariableError);

    expect(enqueuedJobs).toHaveLength(0);
  });
});
