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

// Temporary smoke fixture preserved from Phase 0
export const hello = (): string => 'world';
