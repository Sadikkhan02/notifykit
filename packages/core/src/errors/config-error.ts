import { NotifyKitError } from './notifykit-error';

/**
 * Thrown when NotifyKit configuration or environment variable validation fails.
 */
export class ConfigError extends NotifyKitError {
  constructor(message: string, hint: string, cause?: unknown) {
    super({
      code: 'E_CONFIG_INVALID',
      message,
      hint,
      cause,
    });
    this.name = 'ConfigError';
  }
}
