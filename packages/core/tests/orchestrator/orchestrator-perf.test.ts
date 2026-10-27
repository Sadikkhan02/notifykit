import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createNotifier } from '../../src/orchestrator/notifier.js';
import { closeRedisConnection, resetDefaultRegistry } from '../../src/queue/index.js';

describe('Orchestrator — Performance Benchmark Test (Separate Suite)', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
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
      throw new Error('CRITICAL: Redis is required for orchestrator benchmark tests in CI.');
    }
  }, 60000);

  afterAll(async () => {
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

  it('TC-ORCH-PERF: enqueuing 500 notifications via notify() achieves p99 latency < 10.0 ms', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    const notifier = createNotifier({
      redis: redisUrl,
      providers: {
        email: { type: 'nodemailer' },
      },
      logLevel: 'silent',
    });

    notifier.registerTemplate('perf-template', 'Hello {{name}}! Token: {{token}}');

    // Warm up connection and BullMQ script cache
    await notifier.notify({
      to: { email: 'warmup@example.com' },
      channels: ['email'],
      template: 'perf-template',
      data: { name: 'Warmup', token: 'tok-warmup' },
    });

    const TOTAL_RUNS = 500;
    const latencies: number[] = new Array(TOTAL_RUNS);

    for (let i = 0; i < TOTAL_RUNS; i++) {
      const start = performance.now();
      await notifier.notify({
        to: { email: `perf-${i}@example.com` },
        channels: ['email'],
        template: 'perf-template',
        data: { name: `User${i}`, token: `tok-${i}` },
      });
      latencies[i] = performance.now() - start;
    }

    // Sort to compute percentile
    latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(TOTAL_RUNS * 0.99);
    const p99 = latencies[p99Index] ?? 0;
    // Master specification DoD acceptance criteria: p99 < 10.0ms
    expect(p99).toBeLessThan(10.0);
  }, 30000);
});
