import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { createRedisConnection, closeRedisConnection } from '../../src/queue/connection';
import { QueueRegistry } from '../../src/queue/registry';
import { enqueueJob, resetDefaultRegistry } from '../../src/queue/enqueue';
import { NotificationJob } from '../../src/queue/payload';

describe('Queue Layer — Performance Benchmark Test (Separate Suite)', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let registry: QueueRegistry;
  let isCi = Boolean(process.env.CI);

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
      throw new Error('CRITICAL: Redis is required for benchmark tests in CI.');
    }

    const connection = createRedisConnection(redisUrl);
    registry = new QueueRegistry(connection);
  }, 60000);

  afterAll(async () => {
    if (registry) {
      await registry.close();
    }
    await resetDefaultRegistry();
    await closeRedisConnection();

    if (redisContainer) {
      await redisContainer.stop();
    }
  }, 30000);

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis benchmark test cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  it('TC-Q-PERF: enqueuing 500 jobs achieves p99 latency < 10.0 ms per job', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const N = 500;
    const latencies: number[] = [];

    // Warm up connection
    const warmupJob: NotificationJob = {
      id: 'warmup_job',
      channel: 'email',
      provider: 'test-smtp',
      to: { email: 'warmup@example.com' },
      templateId: 'benchmark-template',
      renderedBody: '<p>Warmup payload</p>',
      metadata: {
        enqueuedAt: Date.now(),
        traceId: 'trc_warmup',
      },
    };
    await enqueueJob(warmupJob, { registry });

    // Execute N sequential enqueues and record individual latency
    for (let i = 0; i < N; i++) {
      const job: NotificationJob = {
        id: `bench_job_${i}`,
        channel: 'email',
        provider: 'smtp',
        to: { email: `user_${i}@example.com` },
        templateId: 'benchmark-template',
        renderedBody: `<p>Benchmark item ${i}</p>`,
        metadata: {
          enqueuedAt: Date.now(),
          traceId: `trc_bench_${i}`,
        },
      };

      const start = performance.now();
      await enqueueJob(job, { registry });
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    // Sort latencies ascending for percentile calculation
    latencies.sort((a, b) => a - b);

    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    // Master specification DoD acceptance criteria: p99 < 10.0ms
    expect(p99).toBeLessThan(10.0);
  });
});
