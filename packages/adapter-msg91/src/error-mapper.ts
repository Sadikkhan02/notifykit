import type { ProviderResult } from 'notifykit/interfaces';

/**
 * Structured MSG91 error codes for DLT / regulatory template and sender issues.
 * These require operator action (registration, approval, template fixes) and MUST NOT be retried.
 */
const DLT_REGULATORY_CODES = new Set([
  203, // Invalid Sender ID or DLT Entity ID missing
  400, // Template / Flow ID missing, incorrect, or archived
  401, // Flow / Template not yet approved (pending DLT or operator approval)
  402, // Message triggers hard-block keyword filter
  403, // Flow is disabled
]);

/**
 * Structured MSG91 error codes for authentication and account restrictions.
 * These are non-retryable without configuration changes.
 */
const AUTH_ACCOUNT_CODES = new Set([
  106, // Missing authkey
  207, // Invalid authkey
  208, // IP is blacklisted
  301, // Insufficient account balance
  302, // Expired user account
  303, // Banned user account
  418, // IP is not whitelisted
]);

/**
 * Structured MSG91 parameter and validation error codes.
 */
const VALIDATION_CODES = new Set([
  101, // Missing mobile number
  102, // Missing message / content
  103, // Missing sender ID
  107, // Missing route
  202, // Invalid mobile number
]);

const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ESOCKET',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const DLT_TEXT_FALLBACK_PATTERN =
  /\b(DLT|entity\s*id|sender\s*id|template|unapproved|flow|header|registered)\b/i;

/**
 * Normalizes and redacts credentials, auth keys, sensitive tokens, and masks recipient phone numbers.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(auth[_-]?key|authkey|token|password|pass|secret)=[^&;\s:]+/gi, '$1=[REDACTED]')
    .replace(/((?:auth[_-]?key|authkey|token|password|secret):\s*)[^\s,]+/gi, '$1[REDACTED]')
    .replace(/(\+\d{1,4})\d{2,6}(\d{4})\b/g, '$1***$2')
    .replace(/\b(91\d{2})\d{4}(\d{4})\b/g, '$1***$2')
    .replace(/((?:mobile|mobiles|phone|to):\s*)\+?(\d{2,4})\d{4,6}(\d{4})\b/gi, '$1$2***$3');
}

/**
 * Maps a caught MSG91 error, API error payload, or HTTP status into a standardized ProviderResult.
 *
 * Precedence & Classification Rules:
 * 1. Rate limits & duplicate throttling (Code 311 or HTTP 429) -> retryable = true.
 * 2. Structured DLT / regulatory codes (203, 400, 401, 402, 403) -> retryable = false.
 * 3. Structured Auth / Account codes (106, 207, 208, 301, 302, 303, 418) or HTTP 401/403 -> retryable = false.
 * 4. Structured Validation codes (101, 102, 103, 107, 202) or HTTP 400/404/422 -> retryable = false.
 * 5. DLT / Regulatory message text fallback matching -> retryable = false.
 * 6. Transient server (HTTP 500/502/503/504) or network codes (ETIMEDOUT, etc.) -> retryable = true.
 * 7. Fallback: unknown errors default to retryable = true.
 */
export function mapMsg91Error(error: unknown, status?: number): ProviderResult {
  let message = 'Unknown MSG91 SMS delivery error';
  let code: number | string | undefined;
  let httpStatus = status;

  if (error instanceof Error) {
    message = sanitizeErrorMessage(error.message);
    const rec = error as unknown as Record<string, unknown>;

    if (typeof rec.code === 'number') {
      code = rec.code;
    } else if (typeof rec.code === 'string') {
      const parsed = Number(rec.code);
      code = Number.isNaN(parsed) ? rec.code : parsed;
    }

    if (httpStatus === undefined) {
      if (typeof rec.status === 'number') {
        httpStatus = rec.status;
      } else if (typeof rec.statusCode === 'number') {
        httpStatus = rec.statusCode;
      } else if (typeof rec.status === 'string' && !Number.isNaN(Number(rec.status))) {
        httpStatus = Number(rec.status);
      } else if (typeof rec.statusCode === 'string' && !Number.isNaN(Number(rec.statusCode))) {
        httpStatus = Number(rec.statusCode);
      }
    }
  } else if (typeof error === 'string') {
    message = sanitizeErrorMessage(error);
  } else if (error && typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === 'string') {
      message = sanitizeErrorMessage(rec.message);
    }
    if (typeof rec.code === 'number') {
      code = rec.code;
    } else if (typeof rec.code === 'string') {
      const parsed = Number(rec.code);
      code = Number.isNaN(parsed) ? rec.code : parsed;
    }
    if (httpStatus === undefined) {
      if (typeof rec.status === 'number') {
        httpStatus = rec.status;
      } else if (typeof rec.statusCode === 'number') {
        httpStatus = rec.statusCode;
      }
    }
  }

  // Fallback regex parsing for embedded status or numeric codes
  if (code === undefined) {
    const codeMatch = message.match(/\b([1-4]\d{2})\b/);
    if (codeMatch && codeMatch[1]) {
      code = Number(codeMatch[1]);
    }
  }

  if (httpStatus === undefined) {
    const statusMatch = message.match(/HTTP\s*([45]\d{2})/i) || message.match(/\b([45]\d{2})\b/);
    if (statusMatch && statusMatch[1]) {
      httpStatus = Number(statusMatch[1]);
    }
  }

  // 1. Rate Limit & Duplicate Throttle branch
  if (code === 311) {
    return {
      success: false,
      error: message,
      retryable: true,
      retryAfterMs: 10000,
    };
  }

  if (code === 20429 || httpStatus === 429) {
    return {
      success: false,
      error: message,
      retryable: true,
      retryAfterMs: 1000,
    };
  }

  // 2. Structured DLT / Regulatory Errors branch (strictly non-retryable)
  if (typeof code === 'number' && DLT_REGULATORY_CODES.has(code)) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 3. Structured Auth & Account Errors branch (strictly non-retryable)
  if (
    (typeof code === 'number' && AUTH_ACCOUNT_CODES.has(code)) ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 4. Structured Validation branch (strictly non-retryable)
  if (
    (typeof code === 'number' && VALIDATION_CODES.has(code)) ||
    (httpStatus !== undefined && NON_RETRYABLE_HTTP_STATUSES.has(httpStatus))
  ) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 5. Tested fallback: text-based matching for DLT / regulatory phrases
  if (DLT_TEXT_FALLBACK_PATTERN.test(message)) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 6. Transient server error branch (retryable)
  const isNetworkCode =
    (typeof code === 'string' && RETRYABLE_NETWORK_CODES.has(code)) ||
    Array.from(RETRYABLE_NETWORK_CODES).some((netCode) => message.includes(netCode)) ||
    message.includes('fetch failed');

  if (
    (httpStatus !== undefined && RETRYABLE_HTTP_STATUSES.has(httpStatus)) ||
    (typeof code === 'number' && RETRYABLE_HTTP_STATUSES.has(code)) ||
    isNetworkCode
  ) {
    return {
      success: false,
      error: message,
      retryable: true,
    };
  }

  // 7. Fallback: unknown errors default to retryable per Master Spec §6 & §14
  return {
    success: false,
    error: message,
    retryable: true,
  };
}
