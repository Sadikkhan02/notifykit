import type { NotifierConfig } from '../interfaces/config.js';
import { enqueueJob } from '../queue/enqueue.js';
import type { NotificationJob } from '../queue/payload.js';
import type { QueueRegistry } from '../queue/registry.js';
import type { TemplateStore } from '../templates/store.js';
import { createScopedLogger, type Logger } from '../logging/logger.js';
import { resolveChannelAdapters, type QueueChannel } from './resolve.js';
import { generateUuidV7 } from './uuid.js';
import { validateEvent } from './validate.js';

export interface NotifyContext {
  config: NotifierConfig;
  registry?: QueueRegistry;
  templateStore: TemplateStore;
  logger: Logger;
}

export interface NotifyResult {
  jobId: string;
}

/**
 * Orchestrates the full lifecycle of a notification request:
 * 1. Generates a correlation traceId (UUID v7).
 * 2. Validates the event against schema and channel requirements.
 * 3. Resolves channels to configured provider adapters.
 * 4. Pre-renders the template fail-fast before contacting Redis (ADR-004).
 * 5. Assembles NotificationJob payload(s) and enqueues to BullMQ queues.
 * 6. Emits structured logs correlated with traceId.
 * 7. Returns immediately with { jobId: string }.
 *
 * Atomicity Boundary: Pre-enqueue validation is atomic in-memory. Cross-queue
 * Redis enqueues execute sequentially without distributed 2PC rollback.
 */
export async function notify(rawEvent: unknown, ctx: NotifyContext): Promise<NotifyResult> {
  const traceId = generateUuidV7();
  const scopedLogger = createScopedLogger({ traceId }, ctx.logger);

  // 1. Validate incoming event
  const event = validateEvent(rawEvent, traceId);

  // 2. Resolve target channels to provider adapters
  const resolvedAdapters = resolveChannelAdapters(
    event.channels as QueueChannel[],
    ctx.config.providers,
    traceId,
  );

  // 3. Pre-render template fail-fast (ADR-004)
  const renderedBody = ctx.templateStore.render(event.template, event.data);

  let primaryJobId: string | null = null;

  // 4. Enqueue jobs sequentially across BullMQ queues
  for (const [channel, resolvedAdapter] of resolvedAdapters.entries()) {
    const jobId = generateUuidV7();
    if (!primaryJobId) {
      primaryJobId = jobId;
    }

    const job: NotificationJob = {
      id: jobId,
      channel,
      provider: resolvedAdapter.providerName,
      to: event.to,
      templateId: event.template,
      renderedBody,
      metadata: {
        enqueuedAt: Date.now(),
        traceId,
      },
    };

    await enqueueJob(job, {
      registry: ctx.registry,
      redisUrl: ctx.config.redis,
    });

    scopedLogger.info(
      {
        traceId,
        jobId,
        channel,
        provider: resolvedAdapter.providerName,
      },
      'Notification job enqueued',
    );
  }

  return {
    jobId: primaryJobId ?? '',
  };
}
