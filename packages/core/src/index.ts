export { loadConfig, validateConfig, REDACT_PATHS } from './config/index.js';
export {
  NotifyKitError,
  ConfigError,
  MissingTemplateError,
  MissingVariableError,
  TemplateSyntaxError,
  InvalidEventError,
  MissingAdapterError,
} from './errors/index.js';
export {
  renderTemplate,
  TemplateStore,
  type HandlebarsTemplateDelegate,
  uppercase,
  formatDate,
} from './templates/index.js';
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
} from './queue/index.js';
export { getLogger, createScopedLogger, type Logger, type LogBindings } from './logging/index.js';
export {
  createNotifier,
  type Notifier,
  type CreateNotifierOptions,
  notify,
  type NotifyContext,
  type NotifyResult,
  validateEvent,
  resolveChannelAdapters,
  type ResolvedChannelAdapter,
  generateUuidV7,
  isValidUuidV7,
} from './orchestrator/index.js';

// Temporary smoke fixture preserved from Phase 0
export const hello = (): string => 'world';
