import type { ProviderResult } from '../interfaces/result.js';

export interface ClassifiedError {
  /** Whether the error is transient and can be retried */
  retryable: boolean;
  /** Normalized human-readable error message */
  message: string;
  /** Error class name if an Error object was provided */
  name?: string;
  /** Error code if present (e.g. 'ECONNRESET', '429', 'E_INVALID_EVENT') */
  code?: string;
  /** Stack trace if available */
  stack?: string;
  /** HTTP status code if detected */
  httpStatus?: number;
}

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

/**
 * Deterministically classifies an error or provider result following the approved 3-tier hierarchy:
 * 1. Tier 1 (Highest Precedence): Explicit ProviderResult.retryable boolean flag.
 * 2. Tier 2: Recognized structured metadata (HTTP status codes, network socket error codes).
 * 3. Tier 3 (Fallback): Unknown errors default to retryable up to remaining attempt limits.
 *
 * @param error Thrown exception or error value
 * @param result Optional ProviderResult returned by provider adapter
 * @returns ClassifiedError with retry decision and structured details
 */
export function classifyError(error?: unknown, result?: ProviderResult): ClassifiedError {
  // Extract error metadata
  let message = 'Unknown delivery error';
  let name: string | undefined;
  let code: string | undefined;
  let stack: string | undefined;
  let httpStatus: number | undefined;

  if (error instanceof Error) {
    message = error.message;
    name = error.name;
    stack = error.stack;

    const errorRecord = error as unknown as Record<string, unknown>;
    if (typeof errorRecord.code === 'string') {
      code = errorRecord.code;
    }

    const rawStatus = errorRecord.status ?? errorRecord.statusCode ?? errorRecord.httpStatus;
    if (typeof rawStatus === 'number') {
      httpStatus = rawStatus;
    } else if (typeof rawStatus === 'string' && !Number.isNaN(Number(rawStatus))) {
      httpStatus = Number(rawStatus);
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (result?.error) {
    message = result.error;
  }

  // Check if status code is embedded in message (e.g. "Status 429", "401 Unauthorized")
  if (httpStatus === undefined) {
    const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      httpStatus = Number(statusMatch[1]);
    }
  }

  // Tier 1: Explicit ProviderResult.retryable flag
  if (result?.retryable !== undefined) {
    return {
      retryable: Boolean(result.retryable),
      message,
      name,
      code,
      stack,
      httpStatus,
    };
  }

  // Tier 2: Recognized Structured Error Metadata
  if (httpStatus !== undefined) {
    if (NON_RETRYABLE_HTTP_STATUSES.has(httpStatus)) {
      return {
        retryable: false,
        message,
        name,
        code: code ?? String(httpStatus),
        stack,
        httpStatus,
      };
    }

    if (RETRYABLE_HTTP_STATUSES.has(httpStatus)) {
      return {
        retryable: true,
        message,
        name,
        code: code ?? String(httpStatus),
        stack,
        httpStatus,
      };
    }
  }

  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return {
      retryable: true,
      message,
      name,
      code,
      stack,
      httpStatus,
    };
  }

  const lowerMessage = message.toLowerCase();

  // Known non-retryable message patterns
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('invalid api key') ||
    lowerMessage.includes('invalid phone number') ||
    lowerMessage.includes('invalid recipient') ||
    name === 'ZodError' ||
    name === 'ValidationError' ||
    code === 'E_INVALID_EVENT' ||
    code === 'E_MISSING_ADAPTER'
  ) {
    return {
      retryable: false,
      message,
      name,
      code,
      stack,
      httpStatus,
    };
  }

  // Known retryable network message patterns
  if (
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('socket hang up') ||
    lowerMessage.includes('rate limit')
  ) {
    return {
      retryable: true,
      message,
      name,
      code,
      stack,
      httpStatus,
    };
  }

  // Tier 3: Safe Fallback for unclassified / unknown errors
  return {
    retryable: true,
    message,
    name,
    code,
    stack,
    httpStatus,
  };
}

/**
 * Returns true if the error is classified as retryable.
 */
export function isRetryableError(error?: unknown, result?: ProviderResult): boolean {
  return classifyError(error, result).retryable;
}
