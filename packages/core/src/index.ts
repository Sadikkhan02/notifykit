export { loadConfig, validateConfig, REDACT_PATHS } from './config';
export {
  NotifyKitError,
  ConfigError,
  MissingTemplateError,
  MissingVariableError,
  TemplateSyntaxError,
} from './errors';
export {
  renderTemplate,
  TemplateStore,
  type HandlebarsTemplateDelegate,
  uppercase,
  formatDate,
} from './templates';
export {
  createRedisConnection,
  closeRedisConnection,
  QueueRegistry,
  type LogicalQueueName,
  type QueueRegistryOptions,
  enqueueJob,
  resetDefaultRegistry,
  type EnqueueConfig,
  type NotificationJob,
  type NotificationJobMetadata,
  type QueueChannel,
  notificationJobSchema,
  recipientSchema,
  DEFAULT_RETRY_POLICY,
  DEFAULT_RETENTION_POLICIES,
  getDefaultJobOptions,
  RedisUnavailableError,
  QueueFullError,
} from './queue';

// Temporary smoke fixture preserved from Phase 0
export const hello = (): string => 'world';
