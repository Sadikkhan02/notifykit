/**
 * Base error class for all NotifyKit runtime and configuration errors.
 */
export class NotifyKitError extends Error {
  /** Stable machine-readable error code (e.g., 'E_CONFIG_INVALID') */
  readonly code: string;
  /** Actionable guidance on how to resolve the error */
  readonly hint: string;
  /** Diagnostic trace ID correlating error occurrences */
  readonly traceId: string;
  /** Wrapped underlying cause, if applicable */
  readonly cause?: unknown;

  constructor(opts: {
    code: string;
    message: string;
    hint: string;
    traceId?: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'NotifyKitError';
    this.code = opts.code;
    this.hint = opts.hint;
    this.traceId = opts.traceId ?? `err_${Date.now().toString(36)}`;
    this.cause = opts.cause;
  }
}
