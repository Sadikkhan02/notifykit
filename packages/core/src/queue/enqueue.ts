import { NotifyKitError } from '../errors/notifykit-error';
import { createRedisConnection } from './connection';
import { QueueFullError, RedisUnavailableError } from './errors';
import { notificationJobSchema, type NotificationJob, type QueueChannel } from './payload';
import { QueueRegistry } from './registry';
import { getDefaultJobOptions } from './retry-policy';

export interface EnqueueConfig {
  registry?: QueueRegistry;
  redisUrl?: string;
}

let defaultRegistry: QueueRegistry | null = null;

export function getOrCreateDefaultRegistry(redisUrl?: string): QueueRegistry {
  if (!defaultRegistry) {
    const connection = createRedisConnection(redisUrl);
    defaultRegistry = new QueueRegistry(connection);
  }
  return defaultRegistry;
}

/**
 * Resets the default registry instance (useful for test isolation).
 */
export async function resetDefaultRegistry(): Promise<void> {
  if (defaultRegistry) {
    await defaultRegistry.close();
    defaultRegistry = null;
  }
}

/**
 * Enqueues a notification job to its designated channel queue in BullMQ.
 *
 * @param job Notification job payload conforming to NotificationJob
 * @param config Optional enqueue configuration or custom registry
 * @returns Enqueued job identifier (string)
 * @throws {NotifyKitError} If job payload fails schema validation (code: 'E_INVALID_EVENT')
 * @throws {RedisUnavailableError} If Redis is unreachable or disconnected (code: 'E_REDIS_UNAVAILABLE')
 * @throws {QueueFullError} If Redis maxmemory is exceeded (code: 'E_QUEUE_FULL')
 */
export async function enqueueJob(job: NotificationJob, config?: EnqueueConfig): Promise<string> {
  // 1. Fail-fast schema validation
  const validationResult = notificationJobSchema.safeParse(job);
  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new NotifyKitError({
      code: 'E_INVALID_EVENT',
      message: `Invalid notification job payload: ${issues}`,
      hint: 'Ensure job payload contains valid channel ("email" | "sms" | "push"), recipient, templateId, and pre-rendered body',
      cause: validationResult.error,
    });
  }

  // 2. Resolve queue registry
  const registry = config?.registry ?? getOrCreateDefaultRegistry(config?.redisUrl);

  const channel: QueueChannel = job.channel;
  const queue = registry.getQueue(channel);

  // 3. Assemble job options with default retry and retention
  const defaultOptions = getDefaultJobOptions(channel);
  const jobOptions = {
    ...defaultOptions,
    jobId: job.id,
  };

  // 4. Enqueue into BullMQ with error translation
  try {
    const bullJob = await queue.add(job.channel, job, jobOptions);
    return bullJob.id ?? job.id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Check for Redis Out of Memory (OOM)
    if (message.includes('OOM') || message.includes('maxmemory')) {
      throw new QueueFullError(message, err);
    }

    // Check for Redis connection/unavailability errors
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('Connection is closed') ||
      message.includes('offline') ||
      message.includes('ClusterAllFailedError')
    ) {
      throw new RedisUnavailableError(message, err);
    }

    // Wrap unexpected queue errors in NotifyKitError with standard E_INTERNAL code
    throw new NotifyKitError({
      code: 'E_INTERNAL',
      message: `Failed to enqueue job: ${message}`,
      hint: 'Verify Redis connection and queue status',
      cause: err,
    });
  }
}
