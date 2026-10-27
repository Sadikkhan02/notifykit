import type { ProviderResult } from '../interfaces/result.js';
import { createScopedLogger, type Logger } from '../logging/logger.js';
import { getOrCreateDefaultRegistry } from './enqueue.js';
import { classifyError } from './error-classifier.js';
import type { NotificationJob, QueueChannel } from './payload.js';
import type { QueueRegistry } from './registry.js';

export interface DeadLetterErrorDetails {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  retryable: boolean;
  httpStatus?: number;
}

export type TerminalFailureReason =
  | 'MAX_RETRIES_EXCEEDED'
  | 'NON_RETRYABLE_ERROR'
  | 'MALFORMED_JOB'
  | 'MISSING_ADAPTER'
  | 'UNHANDLED_EXCEPTION';

/**
 * Payload stored in the Dead-Letter Queue (notifykit:dlq).
 * Preserves the full original NotificationJob payload along with diagnostics.
 */
export interface DeadLetterJob {
  /** Copy of the complete original NotificationJob payload */
  originalJob: NotificationJob;
  /** Detailed error classification that caused dead-lettering */
  error: DeadLetterErrorDetails;
  /** Unix timestamp (milliseconds) when the job was moved to DLQ */
  failedAt: number;
  /** Total number of processing attempts executed before dead-lettering */
  attemptsMade: number;
  /** High-level categorized failure reason */
  terminalReason: TerminalFailureReason;
  /** Original correlation trace identifier */
  traceId: string;
}

export interface DlqRoutingOptions {
  registry?: QueueRegistry;
  redisUrl?: string;
  logger?: Logger;
}

/**
 * Generates a collision-resistant, colon-free deterministic DLQ job ID.
 *
 * Uses bijective Base64URL encoding (RFC 4648 §5):
 * Format: dlq-${channel}-${Buffer.from(sourceJobId, 'utf8').toString('base64url')}
 *
 * Guarantees zero character collisions and zero colon characters, ensuring Redis keys
 * conform strictly to the standard BullMQ <prefix>:<queueName>:<jobId> hierarchy.
 *
 * @param channel The delivery channel of the original job ('email', 'sms', 'push')
 * @param sourceJobId The original source job ID (UUID v7)
 * @returns Deterministic, colon-free DLQ job identifier
 */
export function generateDlqJobId(channel: QueueChannel, sourceJobId: string): string {
  const encodedSourceJobId = Buffer.from(sourceJobId, 'utf8').toString('base64url');
  return `dlq-${channel}-${encodedSourceJobId}`;
}

/**
 * Routes a terminally failed notification job to the dead-letter queue (notifykit:dlq).
 *
 * Failure Semantics:
 * - Assigns a deterministic, colon-free DLQ job ID for bounded deduplication while the record exists in Redis.
 * - Stores the intact original NotificationJob payload without re-rendering or data truncation.
 * - Enforces permanent retention (removeOnComplete: false, removeOnFail: false) for manual auditing.
 * - If enqueuing to the DLQ fails (e.g. Redis disconnect or OOM), re-throws the error to prevent silent loss.
 *
 * @param job The original notification job payload
 * @param error The error or exception that caused the failure
 * @param attemptsMade Total number of processing attempts executed
 * @param terminalReason Categorized reason for terminal routing
 * @param options Queue registry and logging options
 * @param result Optional ProviderResult if available
 * @returns The enqueued DLQ job ID
 */
export async function routeToDlq(
  job: NotificationJob,
  error: unknown,
  attemptsMade: number,
  terminalReason: TerminalFailureReason,
  options?: DlqRoutingOptions,
  result?: ProviderResult,
): Promise<string> {
  const traceId = job.metadata?.traceId ?? 'unknown-trace';
  const scopedLogger = createScopedLogger(
    { traceId, jobId: job.id, channel: job.channel, provider: job.provider },
    options?.logger,
  );

  const classified = classifyError(error, result);
  const errorDetails: DeadLetterErrorDetails = {
    message: classified.message,
    name: classified.name,
    stack: classified.stack,
    code: classified.code,
    retryable: classified.retryable,
    httpStatus: classified.httpStatus,
  };

  const deadLetterPayload: DeadLetterJob = {
    originalJob: job,
    error: errorDetails,
    failedAt: Date.now(),
    attemptsMade,
    terminalReason,
    traceId,
  };

  const dlqJobId = generateDlqJobId(job.channel, job.id);
  const registry = options?.registry ?? getOrCreateDefaultRegistry(options?.redisUrl);
  const queue = registry.getQueue('dlq');

  try {
    const bullJob = await queue.add('dlq', deadLetterPayload as unknown as NotificationJob, {
      jobId: dlqJobId,
      removeOnComplete: false,
      removeOnFail: false,
    });

    scopedLogger.error(
      {
        traceId,
        originalJobId: job.id,
        dlqJobId,
        channel: job.channel,
        terminalReason,
        attemptsMade,
        error: errorDetails.message,
      },
      'Notification job routed to DLQ',
    );

    return bullJob.id ?? dlqJobId;
  } catch (err: unknown) {
    scopedLogger.fatal(
      {
        traceId,
        originalJobId: job.id,
        dlqJobId,
        channel: job.channel,
        terminalReason,
        err,
        originalError: errorDetails.message,
      },
      'CRITICAL: Failed to enqueue terminal job to DLQ',
    );
    throw err;
  }
}
