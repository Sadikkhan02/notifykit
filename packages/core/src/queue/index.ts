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
