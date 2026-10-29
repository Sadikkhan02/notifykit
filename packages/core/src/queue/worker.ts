import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { NotifyKitError } from '../errors/notifykit-error.js';
import type { NotifierConfig } from '../interfaces/config.js';
import type { ProviderResult } from '../interfaces/result.js';
import { createScopedLogger, type Logger } from '../logging/logger.js';
import { MissingAdapterError } from '../orchestrator/errors.js';
import { createRedisConnection } from './connection.js';
import { dispatchJob } from './dispatch.js';
import { routeToDlq, type TerminalFailureReason } from './dlq.js';
import { classifyError } from './error-classifier.js';
import { notificationJobSchema, type NotificationJob, type QueueChannel } from './payload.js';
import type { QueueRegistry } from './registry.js';

export interface StartWorkerOptions {
  channels?: Array<'email' | 'sms' | 'push'>;
  concurrency?: number | Partial<Record<'email' | 'sms' | 'push', number>>;
}

export interface WorkerJobContext {
  config: NotifierConfig;
  registry?: QueueRegistry;
  logger?: Logger;
  redisUrl?: string;
}

export interface ChannelWorkerOptions {
  config: NotifierConfig;
  concurrency?: number;
  connection?: Redis;
  registry?: QueueRegistry;
  logger?: Logger;
}

export interface WorkerManagerOptions {
  config: NotifierConfig;
  registry?: QueueRegistry;
  logger?: Logger;
  createWorker?: (
    channel: QueueChannel,
    options: ChannelWorkerOptions,
  ) => Worker<NotificationJob, ProviderResult, string>;
}

export const ALL_CHANNELS: QueueChannel[] = ['email', 'sms', 'push'];

/**
 * Validates concurrency options for positive integer constraints.
 * Throws NotifyKitError with code E_INVALID_CONCURRENCY if invalid.
 */
export function validateConcurrency(
  concurrency?: number | Partial<Record<'email' | 'sms' | 'push', number>>,
): void {
  if (concurrency === undefined) {
    return;
  }
  if (typeof concurrency === 'number') {
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new NotifyKitError({
        code: 'E_INVALID_CONCURRENCY',
        message: `Invalid global concurrency: ${concurrency}. Must be a positive integer.`,
        hint: 'Specify a positive integer for concurrency (e.g. { concurrency: 5 }).',
      });
    }
    return;
  }
  if (typeof concurrency === 'object' && concurrency !== null) {
    for (const [ch, c] of Object.entries(concurrency)) {
      if (typeof c !== 'number' || !Number.isInteger(c) || c <= 0) {
        throw new NotifyKitError({
          code: 'E_INVALID_CONCURRENCY',
          message: `Invalid concurrency for channel "${ch}": ${c}. Must be a positive integer.`,
          hint: 'Specify positive integers for channel concurrency overrides (e.g. { concurrency: { email: 10 } }).',
        });
      }
    }
    return;
  }
  throw new NotifyKitError({
    code: 'E_INVALID_CONCURRENCY',
    message: `Invalid concurrency option type: ${typeof concurrency}. Must be a number or an object with channel overrides.`,
    hint: 'Specify a positive integer or an object mapping channels to positive integers.',
  });
}

/**
 * Resolves the concurrency limit for a specific channel.
 */
export function resolveChannelConcurrency(
  channel: QueueChannel,
  concurrency?: number | Partial<Record<'email' | 'sms' | 'push', number>>,
): number {
  const DEFAULT_CONCURRENCY = 5;
  if (typeof concurrency === 'number') {
    return concurrency;
  }
  if (typeof concurrency === 'object' && concurrency !== null) {
    const channelOverride = concurrency[channel];
    if (typeof channelOverride === 'number') {
      return channelOverride;
    }
  }
  return DEFAULT_CONCURRENCY;
}

/**
 * Core processor for notification jobs across email, sms, and push channels.
 *
 * Retry & Failure Architecture:
 * - BullMQ is the sole and authoritative retry scheduler.
 * - Enqueued jobs receive attempts: 3 and exponential backoff (1000ms, 2000ms).
 * - Retryable failures on attempts < 3 re-throw without DLQ routing.
 * - Retryable failures on final attempt (job.attemptsMade + 1 >= maxAttempts) route to DLQ once.
 * - Non-retryable failures route to DLQ immediately and throw UnrecoverableError.
 * - DLQ enqueue failures are caught, logged as fatal, and re-thrown without swallowing.
 */
export async function processNotificationJob(
  job: Job<NotificationJob, ProviderResult, string>,
  context: WorkerJobContext,
): Promise<ProviderResult> {
  // 1. Defensively validate job payload against notificationJobSchema
  const validationResult = notificationJobSchema.safeParse(job.data);
  if (!validationResult.success) {
    const rawData = job.data as unknown as Record<string, unknown> | undefined;
    const fallbackJob: NotificationJob = {
      id: (typeof rawData?.id === 'string' && rawData.id) || job.id || 'unknown-job',
      channel:
        typeof rawData?.channel === 'string' &&
        (rawData.channel === 'email' || rawData.channel === 'sms' || rawData.channel === 'push')
          ? rawData.channel
          : (job.queueName as QueueChannel) || 'email',
      provider: (typeof rawData?.provider === 'string' && rawData.provider) || 'unknown-provider',
      to:
        rawData?.to && typeof rawData.to === 'object' ? (rawData.to as NotificationJob['to']) : {},
      templateId: (typeof rawData?.templateId === 'string' && rawData.templateId) || 'malformed',
      renderedBody: (typeof rawData?.renderedBody === 'string' && rawData.renderedBody) || '',
      metadata:
        rawData?.metadata && typeof rawData.metadata === 'object'
          ? {
              enqueuedAt: Date.now(),
              traceId: 'unknown-trace',
              ...(rawData.metadata as Record<string, unknown>),
            }
          : { enqueuedAt: Date.now(), traceId: 'unknown-trace' },
    };

    const validationError = new Error(
      `Malformed job payload: ${validationResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );

    try {
      await routeToDlq(fallbackJob, validationError, job.attemptsMade + 1, 'MALFORMED_JOB', {
        registry: context.registry,
        redisUrl: context.config.redis,
        logger: context.logger,
      });
    } catch (dlqErr) {
      context.logger?.fatal(
        { err: dlqErr, jobId: job.id, channel: job.queueName },
        'Failed to route malformed job to DLQ',
      );
      throw dlqErr;
    }

    throw new UnrecoverableError(validationError.message);
  }

  const validJob = validationResult.data as NotificationJob;
  const traceId = validJob.metadata?.traceId ?? 'unknown-trace';
  const scopedLogger = createScopedLogger(
    {
      traceId,
      jobId: validJob.id,
      channel: validJob.channel,
      provider: validJob.provider,
    },
    context.logger,
  );

  let dispatchResult: ProviderResult | undefined;
  let dispatchError: unknown | undefined;

  try {
    dispatchResult = await dispatchJob(validJob, {
      providers: context.config.providers,
      logger: scopedLogger,
    });
  } catch (err) {
    dispatchError = err;
  }

  // 2. Successful dispatch
  if (!dispatchError && dispatchResult && dispatchResult.success) {
    scopedLogger.info(
      { messageId: dispatchResult.messageId },
      'Notification job dispatched successfully',
    );
    return dispatchResult;
  }

  // 3. Delivery failure: classify error with 3-tier precedence
  const classified = classifyError(dispatchError, dispatchResult);
  const currentAttempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalAttempt = currentAttempt >= maxAttempts;

  // 4A. Non-retryable error branch: route to DLQ immediately & abort retries
  if (!classified.retryable) {
    const terminalReason: TerminalFailureReason =
      classified.code === 'E_MISSING_ADAPTER' ? 'MISSING_ADAPTER' : 'NON_RETRYABLE_ERROR';

    try {
      await routeToDlq(
        validJob,
        dispatchError ?? classified.message,
        currentAttempt,
        terminalReason,
        {
          registry: context.registry,
          redisUrl: context.config.redis,
          logger: scopedLogger,
        },
        dispatchResult,
      );
    } catch (dlqErr) {
      scopedLogger.fatal(
        {
          err: dlqErr,
          jobId: validJob.id,
          channel: validJob.channel,
          terminalReason,
        },
        'Failed to route terminal non-retryable job to DLQ',
      );
      throw dlqErr;
    }

    throw new UnrecoverableError(classified.message);
  }

  // 4B. Retryable error branch
  if (isFinalAttempt) {
    // Final attempt exhausted: route to DLQ exactly once
    try {
      await routeToDlq(
        validJob,
        dispatchError ?? classified.message,
        currentAttempt,
        'MAX_RETRIES_EXCEEDED',
        {
          registry: context.registry,
          redisUrl: context.config.redis,
          logger: scopedLogger,
        },
        dispatchResult,
      );
    } catch (dlqErr) {
      scopedLogger.fatal(
        {
          err: dlqErr,
          jobId: validJob.id,
          channel: validJob.channel,
          terminalReason: 'MAX_RETRIES_EXCEEDED',
        },
        'Failed to route exhausted retryable job to DLQ',
      );
      throw dlqErr;
    }

    if (dispatchError instanceof Error) {
      throw dispatchError;
    }
    throw new Error(classified.message);
  }

  // Attempts remain (Attempt 1 or 2): re-throw error for BullMQ backoff scheduling
  const nextDelayMs = 1000 * Math.pow(2, currentAttempt - 1);
  scopedLogger.warn(
    {
      currentAttempt,
      maxAttempts,
      nextDelayMs,
      error: classified.message,
    },
    'Notification delivery failed with retryable error. BullMQ will schedule retry.',
  );

  if (dispatchError instanceof Error) {
    throw dispatchError;
  }
  throw new Error(classified.message);
}

/**
 * Creates a BullMQ Worker instance for a specific delivery channel.
 */
export function createChannelWorker(
  channel: QueueChannel,
  options: ChannelWorkerOptions,
): Worker<NotificationJob, ProviderResult, string> {
  const connection =
    options.connection ??
    (options.registry ? options.registry.getConnection() : undefined) ??
    createRedisConnection(options.config.redis);

  const concurrency = options.concurrency ?? 5;

  return new Worker<NotificationJob, ProviderResult, string>(
    channel,
    async (job: Job<NotificationJob, ProviderResult, string>) => {
      return processNotificationJob(job, {
        config: options.config,
        registry: options.registry,
        logger: options.logger,
        redisUrl: options.config.redis,
      });
    },
    {
      connection,
      prefix: 'bull:notifykit',
      concurrency,
    },
  );
}

/**
 * Manages BullMQ workers for a Notifier instance.
 */
export class WorkerManager {
  private readonly config: NotifierConfig;
  private readonly registry?: QueueRegistry;
  private readonly logger?: Logger;
  private readonly createWorker: typeof createChannelWorker;
  private readonly activeWorkers = new Map<
    QueueChannel,
    Worker<NotificationJob, ProviderResult, string>
  >();

  constructor(options: WorkerManagerOptions) {
    this.config = options.config;
    this.registry = options.registry;
    this.logger = options.logger;
    this.createWorker = options.createWorker ?? createChannelWorker;
  }

  /**
   * Synchronously starts workers for the requested channels after pre-validation.
   * If construction fails mid-loop, background teardown is initiated and the error is re-thrown.
   */
  start(opts?: StartWorkerOptions): void {
    if (this.activeWorkers.size > 0) {
      this.logger?.warn(
        'startWorker() called when workers are already running for this instance. Ignoring call.',
      );
      return;
    }

    validateConcurrency(opts?.concurrency);

    let targetChannels: QueueChannel[];

    if (!opts?.channels) {
      targetChannels = ALL_CHANNELS.filter((ch) => this.config.providers?.[ch] !== undefined);
      if (targetChannels.length === 0) {
        this.logger?.warn('startWorker() called with no configured channels. No workers started.');
        return;
      }
    } else {
      for (const ch of opts.channels) {
        if (!this.config.providers?.[ch]) {
          throw new MissingAdapterError({
            message: `No provider adapter configured for channel "${ch}".`,
            hint: `Configure a provider for "${ch}" in createNotifier({ providers: { ${ch}: ... } }) or omit "${ch}" from worker channels.`,
          });
        }
      }
      targetChannels = opts.channels;
    }

    const constructed: Array<Worker<NotificationJob, ProviderResult, string>> = [];
    try {
      for (const channel of targetChannels) {
        const channelConcurrency = resolveChannelConcurrency(channel, opts?.concurrency);
        const worker = this.createWorker(channel, {
          config: this.config,
          concurrency: channelConcurrency,
          registry: this.registry,
          logger: this.logger,
        });
        if (typeof worker?.on === 'function') {
          worker.on('error', (err) => {
            this.logger?.warn({ err, channel }, 'Worker encountered background connection error');
          });
        }
        constructed.push(worker);
        this.activeWorkers.set(channel, worker);
      }
    } catch (err) {
      for (const worker of constructed) {
        worker.close().catch((closeErr) => {
          this.logger?.error(
            { err: closeErr },
            'Error closing worker during partial startup teardown',
          );
        });
      }
      this.activeWorkers.clear();
      throw err;
    }
  }

  /**
   * Gracefully shuts down all workers owned by this manager, draining in-flight jobs.
   */
  async stop(): Promise<void> {
    if (this.activeWorkers.size === 0) {
      return;
    }
    const workersToClose = Array.from(this.activeWorkers.values());
    this.activeWorkers.clear();
    await Promise.all(workersToClose.map((w) => w.close()));
  }

  /**
   * Returns a copy of the active worker map.
   */
  getActiveWorkers(): Map<QueueChannel, Worker<NotificationJob, ProviderResult, string>> {
    return new Map(this.activeWorkers);
  }

  /**
   * Returns whether any workers are currently active.
   */
  isRunning(): boolean {
    return this.activeWorkers.size > 0;
  }
}
