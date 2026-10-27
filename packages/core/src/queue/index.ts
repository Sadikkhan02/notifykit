export { createRedisConnection, closeRedisConnection } from './connection';

export { QueueRegistry, type LogicalQueueName, type QueueRegistryOptions } from './registry';

export { enqueueJob, resetDefaultRegistry, type EnqueueConfig } from './enqueue';

export {
  type NotificationJob,
  type NotificationJobMetadata,
  type QueueChannel,
  notificationJobSchema,
  recipientSchema,
} from './payload';

export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_RETENTION_POLICIES,
  getDefaultJobOptions,
} from './retry-policy';

export { RedisUnavailableError, QueueFullError } from './errors';

export { dispatchJob, type DispatchOptions } from './dispatch';

export { classifyError, isRetryableError, type ClassifiedError } from './error-classifier';

export {
  routeToDlq,
  generateDlqJobId,
  type DeadLetterJob,
  type DeadLetterErrorDetails,
  type TerminalFailureReason,
  type DlqRoutingOptions,
} from './dlq';

export {
  createChannelWorker,
  processNotificationJob,
  WorkerManager,
  type StartWorkerOptions,
  type WorkerJobContext,
  type ChannelWorkerOptions,
  type WorkerManagerOptions,
} from './worker';
