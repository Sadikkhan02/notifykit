import { describe, expect, it } from 'vitest';
import { ConfigError, NotifyKitError } from '../../src/errors/index.js';
import { createNotifier } from '../../src/orchestrator/notifier.js';
import {
  closeRedisConnection,
  resetDefaultRegistry,
  type NotificationJob,
  type QueueRegistry,
} from '../../src/queue/index.js';

describe('createNotifier() Factory Contract', () => {
  it('initializes in < 50ms and returns { notify, registerTemplate, startWorker }', () => {
    const start = performance.now();
    const notifier = createNotifier({
      providers: {
        email: { type: 'nodemailer' },
      },
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(notifier).toBeDefined();
    expect(typeof notifier.notify).toBe('function');
    expect(typeof notifier.registerTemplate).toBe('function');
    expect(typeof notifier.startWorker).toBe('function');

    // Asserts Notifier.close is NOT exposed on public interface per constraints
    expect((notifier as unknown as Record<string, unknown>).close).toBeUndefined();
  });

  it('fails fast on invalid configuration during initialization', () => {
    expect(() =>
      createNotifier({
        redis: 'not-a-valid-redis-url',
      }),
    ).toThrow(ConfigError);
  });

  it('allows registering templates that are usable by notify()', async () => {
    const enqueued: NotificationJob[] = [];
    const mockRegistry = {
      getQueue: () => ({
        add: (_name: string, data: NotificationJob) => {
          enqueued.push(data);
          return Promise.resolve({ id: data.id });
        },
      }),
    };

    const notifier = createNotifier({
      providers: {
        email: { type: 'nodemailer' },
      },
      registry: mockRegistry as unknown as QueueRegistry,
    });

    notifier.registerTemplate('dynamic-temp', 'Dynamic: {{value}}');

    const result = await notifier.notify({
      to: { email: 'test@example.com' },
      channels: ['email'],
      template: 'dynamic-temp',
      data: { value: '42' },
    });

    expect(result).toHaveProperty('jobId');
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.renderedBody).toBe('Dynamic: 42');
  });

  it('initializes with pre-configured templates option', async () => {
    const enqueued: NotificationJob[] = [];
    const mockRegistry = {
      getQueue: () => ({
        add: (_name: string, data: NotificationJob) => {
          enqueued.push(data);
          return Promise.resolve({ id: data.id });
        },
      }),
    };

    const notifier = createNotifier({
      providers: {
        email: { type: 'nodemailer' },
      },
      templates: {
        preconfigured: 'Hello, {{name}}!',
      },
      registry: mockRegistry as unknown as QueueRegistry,
    });

    const result = await notifier.notify({
      to: { email: 'test@example.com' },
      channels: ['email'],
      template: 'preconfigured',
      data: { name: 'World' },
    });

    expect(result.jobId).toBeDefined();
    expect(enqueued[0].renderedBody).toBe('Hello, World!');
  });

  it('supports startWorker() and stopWorker() lifecycle on Notifier instance', async () => {
    const notifier = createNotifier({
      providers: {
        email: {
          type: 'nodemailer',
          adapter: { name: 'nodemailer', sendEmail: () => Promise.resolve({ success: true }) },
        },
      },
    });

    expect(typeof notifier.startWorker).toBe('function');
    expect(typeof notifier.stopWorker).toBe('function');

    expect(() => notifier.startWorker()).not.toThrow();
    await expect(notifier.stopWorker()).resolves.toBeUndefined();
  });

  it('clean shutdown is achievable via resetDefaultRegistry() and closeRedisConnection()', async () => {
    // Verifies the documented Phase 3 connection lifecycle cleans up cleanly
    await expect(resetDefaultRegistry()).resolves.toBeUndefined();
    await expect(closeRedisConnection()).resolves.toBeUndefined();
  });
});
