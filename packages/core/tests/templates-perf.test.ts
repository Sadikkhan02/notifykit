import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { TemplateStore } from '../src/index';

describe('Template Engine Performance Benchmark (Phase 2)', () => {
  it('renders 1,000 pre-registered templates in < 5 seconds with p99 < 5ms', () => {
    const store = new TemplateStore();
    const templateSource =
      'Hello {{name}}! Your order #{{orderId}} of {{uppercase item}} is confirmed for {{formatDate orderDate "iso"}}.';

    store.register('order-confirmation', templateSource);

    const iterations = 1000;
    const latencies: number[] = new Array(iterations);
    const orderDate = new Date('2026-10-25T12:00:00.000Z');

    const totalStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const output = store.render('order-confirmation', {
        name: `Customer ${i}`,
        orderId: 10000 + i,
        item: 'widget',
        orderDate,
      });
      const end = performance.now();
      latencies[i] = end - start;

      // Basic sanity check to ensure template actually rendered
      expect(output).toContain(`Customer ${i}`);
    }

    const totalEnd = performance.now();
    const totalDuration = totalEnd - totalStart;

    // Sort latencies ascending to compute p99
    latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(iterations * 0.99);
    const p99Latency = latencies[p99Index];

    // Assert total duration < 5,000 ms (5s)
    expect(totalDuration).toBeLessThan(5000);

    // Assert p99 latency < 5.0 ms per template
    expect(p99Latency).toBeLessThan(5.0);
  });
});
