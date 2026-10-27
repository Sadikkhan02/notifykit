import { NotifyKitError } from '../errors/notifykit-error.js';

export interface OrchestratorErrorOptions {
  message: string;
  hint: string;
  traceId?: string;
  cause?: unknown;
}

/**
 * Thrown when a NotificationEvent fails runtime schema validation or channel-specific recipient requirements.
 */
export class InvalidEventError extends NotifyKitError {
  constructor(opts: OrchestratorErrorOptions) {
    super({
      code: 'E_INVALID_EVENT',
      message: opts.message,
      hint: opts.hint,
      traceId: opts.traceId,
      cause: opts.cause,
    });
    this.name = 'InvalidEventError';
  }
}

/**
 * Thrown when an event requests a delivery channel for which no provider adapter or configuration is present.
 */
export class MissingAdapterError extends NotifyKitError {
  constructor(opts: OrchestratorErrorOptions) {
    super({
      code: 'E_MISSING_ADAPTER',
      message: opts.message,
      hint: opts.hint,
      traceId: opts.traceId,
      cause: opts.cause,
    });
    this.name = 'MissingAdapterError';
  }
}
