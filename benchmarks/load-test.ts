/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
/**
 * NotifyKit Phase 13 Load Test & Performance Benchmark
 *
 * Measures:
 * 1. notify() enqueue latency: p50, p95, p99.
 * 2. notify() enqueue throughput (notifications/second).
 * 3. Worker processing throughput with a zero-latency mock provider (messages/second).
 * 4. Memory footprint: Heap usage before and after workload.
 *
 * Specification Targets:
 * - notify() p99 latency < 10 ms.
 * - Worker throughput >= 50 msgs/sec.
 */

import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import {
  createNotifier,
  resetDefaultRegistry,
  closeRedisConnection,
  type Notifier,
} from '../packages/core/src/index.js';

interface BenchmarkResults {
  totalNotifications: number;
  enqueueDurationMs: number;
  enqueueThroughput: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  workerDurationMs: number;
  workerThroughput: number;
  heapBeforeMB: number;
  heapAfterMB: number;
  heapDeltaMB: number;
  targets: {
    enqueueP99TargetPassed: boolean;
    workerThroughputTargetPassed: boolean;
  };
}

async function runBenchmark(): Promise<BenchmarkResults> {
  const TOTAL_NOTIFICATIONS = 1000;
  const ENQUEUE_CONCURRENCY = 1;
  const WORKER_CONCURRENCY = 20;

  console.log('='.repeat(70));
  console.log('  NotifyKit Phase 13 — Performance & Load Test Suite');
  console.log('='.repeat(70));

  // 1. Hardware & Runtime Context
  const cpus = os.cpus();
  console.log('\n[Environment & Hardware Context]');
  console.log(`- Node.js Version: ${process.version}`);
  console.log(`- Architecture:    ${process.arch} (${process.platform})`);
  console.log(`- CPU Model:       ${cpus[0]?.model ?? 'Unknown'} (${cpus.length} cores)`);
  console.log(`- Total RAM:       ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // 2. Redis Setup
  let redisUrl = process.env.REDIS_URL;
  let redisContainer: StartedRedisContainer | undefined;

  if (redisUrl) {
    console.log(`- Redis Setup:     External Redis at ${redisUrl}`);
  } else {
    console.log('- Redis Setup:     Starting ephemeral Testcontainer (redis:7-alpine)...');
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    redisUrl = redisContainer.getConnectionUrl();
    console.log(`- Redis Container: Started on ${redisUrl}`);
  }

  // 3. Initial Heap Baseline
  if (global.gc) {
    global.gc();
  }
  const heapBefore = process.memoryUsage().heapUsed;
  const heapBeforeMB = Number((heapBefore / 1024 / 1024).toFixed(2));

  // 4. Zero-Latency Mock Provider & Completion Tracking
  let processedCount = 0;
  let resolveProcessing: () => void;
  const processingPromise = new Promise<void>((resolve) => {
    resolveProcessing = resolve;
  });

  const zeroLatencyAdapter = {
    name: 'mock-zero-latency',
    sendEmail: async () => {
      processedCount++;
      if (processedCount >= TOTAL_NOTIFICATIONS) {
        resolveProcessing();
      }
      return {
        success: true,
        messageId: `bench-${processedCount}`,
      };
    },
  };

  const notifier: Notifier = createNotifier({
    redis: redisUrl,
    logLevel: 'error',
    providers: {
      email: {
        type: 'mock',
        adapter: zeroLatencyAdapter,
        from: 'bench@notifykit.dev',
      },
    },
  });

  notifier.registerTemplate(
    'bench-alert',
    'Benchmark notification for user {{userId}}: status is {{status}}.',
  );

  // Warmup phase (50 notifications to load BullMQ scripts and warm JIT)
  console.log('\n[Warmup Phase]');
  for (let i = 0; i < 50; i++) {
    await notifier.notify({
      channels: ['email'],
      to: { email: `warmup${i}@bench.notifykit.dev` },
      template: 'bench-alert',
      data: { userId: `warmup-${i}`, status: 'warm' },
    });
  }
  // Reset processedCount from warmup
  processedCount = 0;
  console.log('✓ Warmup complete (50 notifications).');

  console.log('\n[Phase 1: Enqueue Latency & Throughput Benchmark]');
  console.log(`- Target workload: ${TOTAL_NOTIFICATIONS} notifications`);
  console.log(`- Concurrency:     ${ENQUEUE_CONCURRENCY} parallel pipelines`);

  const latenciesMs: number[] = new Array(TOTAL_NOTIFICATIONS);
  let currentIndex = 0;

  async function enqueueWorker(): Promise<void> {
    while (true) {
      const idx = currentIndex++;
      if (idx >= TOTAL_NOTIFICATIONS) break;

      const start = performance.now();
      await notifier.notify({
        channels: ['email'],
        to: { email: `user${idx}@bench.notifykit.dev` },
        template: 'bench-alert',
        data: { userId: `user-${idx}`, status: 'active' },
      });
      latenciesMs[idx] = performance.now() - start;
    }
  }

  const enqueueStartTime = performance.now();
  const enqueueWorkers = Array.from({ length: ENQUEUE_CONCURRENCY }, () => enqueueWorker());
  await Promise.all(enqueueWorkers);
  const enqueueEndTime = performance.now();

  const enqueueDurationMs = enqueueEndTime - enqueueStartTime;
  const enqueueThroughput = TOTAL_NOTIFICATIONS / (enqueueDurationMs / 1000);

  latenciesMs.sort((a, b) => a - b);
  const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.5)]!;
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)]!;
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)]!;

  console.log(`✓ Enqueued ${TOTAL_NOTIFICATIONS} jobs in ${enqueueDurationMs.toFixed(2)} ms`);
  console.log(`- Throughput: ${enqueueThroughput.toFixed(1)} notifications/sec`);
  console.log(`- Latency p50: ${p50.toFixed(2)} ms`);
  console.log(`- Latency p95: ${p95.toFixed(2)} ms`);
  console.log(`- Latency p99: ${p99.toFixed(2)} ms (Specification Target: < 10 ms)`);

  console.log('\n[Phase 2: Worker Processing Throughput Benchmark]');
  console.log(`- Worker Concurrency: ${WORKER_CONCURRENCY}`);

  const workerStartTime = performance.now();
  notifier.startWorker({
    channels: ['email'],
    concurrency: WORKER_CONCURRENCY,
  });

  await processingPromise;
  const workerEndTime = performance.now();

  const workerDurationMs = workerEndTime - workerStartTime;
  const workerThroughput = TOTAL_NOTIFICATIONS / (workerDurationMs / 1000);

  console.log(`✓ Processed ${TOTAL_NOTIFICATIONS} jobs in ${workerDurationMs.toFixed(2)} ms`);
  console.log(
    `- Worker Throughput: ${workerThroughput.toFixed(1)} msgs/sec (Specification Target: >= 50 msgs/sec)`,
  );

  // 5. Heap Memory After Workload
  if (global.gc) {
    global.gc();
  }
  const heapAfter = process.memoryUsage().heapUsed;
  const heapAfterMB = Number((heapAfter / 1024 / 1024).toFixed(2));
  const heapDeltaMB = Number((heapAfterMB - heapBeforeMB).toFixed(2));

  console.log('\n[Phase 3: Heap Memory Profile]');
  console.log(`- Heap Before: ${heapBeforeMB} MB`);
  console.log(`- Heap After:  ${heapAfterMB} MB`);
  console.log(`- Heap Delta:  ${heapDeltaMB >= 0 ? '+' : ''}${heapDeltaMB} MB`);

  // 6. Graceful Cleanup
  console.log('\n[Cleanup]');
  await notifier.stopWorker();
  await resetDefaultRegistry();
  await closeRedisConnection();

  if (redisContainer) {
    await redisContainer.stop();
  }
  console.log('✓ Teardown complete.');

  const results: BenchmarkResults = {
    totalNotifications: TOTAL_NOTIFICATIONS,
    enqueueDurationMs: Number(enqueueDurationMs.toFixed(2)),
    enqueueThroughput: Number(enqueueThroughput.toFixed(1)),
    p50LatencyMs: Number(p50.toFixed(2)),
    p95LatencyMs: Number(p95.toFixed(2)),
    p99LatencyMs: Number(p99.toFixed(2)),
    workerDurationMs: Number(workerDurationMs.toFixed(2)),
    workerThroughput: Number(workerThroughput.toFixed(1)),
    heapBeforeMB,
    heapAfterMB,
    heapDeltaMB,
    targets: {
      enqueueP99TargetPassed: p99 < 10.0,
      workerThroughputTargetPassed: workerThroughput >= 50.0,
    },
  };

  console.log('\n' + '='.repeat(70));
  console.log('  Benchmark Summary & Acceptance Target Verification');
  console.log('='.repeat(70));
  console.log(
    `- notify() p99 Latency:    ${results.p99LatencyMs} ms   [${results.targets.enqueueP99TargetPassed ? 'PASS' : 'FAIL'} (target < 10 ms)]`,
  );
  console.log(
    `- Worker Throughput:        ${results.workerThroughput} msg/s [${results.targets.workerThroughputTargetPassed ? 'PASS' : 'FAIL'} (target >= 50 msg/s)]`,
  );
  console.log('='.repeat(70));

  return results;
}

runBenchmark()
  .then((results) => {
    if (!results.targets.enqueueP99TargetPassed || !results.targets.workerThroughputTargetPassed) {
      console.error('Benchmark failed one or more specification targets.');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
