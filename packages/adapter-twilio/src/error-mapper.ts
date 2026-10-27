import type { ProviderResult } from 'notifykit/interfaces';

const NON_RETRYABLE_CODES = new Set([
  20003, // Authentication Error - Account SID or Auth Token invalid
  20005, // Account not active
  21211, // Invalid 'To' Phone Number
  21212, // Invalid 'From' Phone Number
  21408, // Permission to send an SMS has not been enabled for region
  21603, // 'From' or 'MessagingServiceSid' is required
  21606, // 'From' phone number is not SMS-capable
  21608, // Twilio trial unverified 'To' number
  21610, // Attempt to send to unsubscribed recipient (STOP)
  21614, // 'To' number is not a valid mobile number / landline
  21617, // Message body exceeds maximum allowable length
  21619, // Text message body is not allowed / prohibited content
]);

const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

const RETRYABLE_CODES = new Set([
  20500, // Twilio Internal Server Error
  20503, // Twilio Service Unavailable
]);

const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ESOCKET',
  'EAI_AGAIN',
]);

/**
 * Normalizes and redacts credentials, sensitive tokens, and masks recipient/sender phone numbers.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(auth[_-]?token|authToken|token|password|pass|secret)=[^&;\s:]+/gi, '$1=[REDACTED]')
    .replace(/((?:auth[_-]?token|authToken|token|password|secret):\s*)[^\s,]+/gi, '$1[REDACTED]')
    .replace(/(\+\d{1,4})\d{2,6}(\d{4})\b/g, '$1***$2');
}

/**
 * Maps a caught Twilio or network exception into a standardized ProviderResult.
 *
 * Precedence & Classification Rules:
 * - Rate limits (code 20429 or HTTP 429): retryable = true, retryAfterMs = 1000.
 * - Permanent client/account/recipient errors (codes 20003, 20005, 21211, 21610, etc., or HTTP 400/401/403/404/422): retryable = false.
 * - Server errors (codes 20500, 20503, HTTP 500/502/503/504) or network codes (ETIMEDOUT, etc.): retryable = true.
 * - Unknown errors: fallback to retryable = true.
 */
export function mapTwilioError(error: unknown): ProviderResult {
  let message = 'Unknown Twilio SMS delivery error';
  let code: number | string | undefined;
  let status: number | undefined;

  if (error instanceof Error) {
    message = sanitizeErrorMessage(error.message);
    const rec = error as unknown as Record<string, unknown>;

    if (typeof rec.code === 'number') {
      code = rec.code;
    } else if (typeof rec.code === 'string') {
      const parsed = Number(rec.code);
      code = Number.isNaN(parsed) ? rec.code : parsed;
    }

    if (typeof rec.status === 'number') {
      status = rec.status;
    } else if (typeof rec.status === 'string' && !Number.isNaN(Number(rec.status))) {
      status = Number(rec.status);
    } else if (typeof rec.statusCode === 'number') {
      status = rec.statusCode;
    } else if (typeof rec.statusCode === 'string' && !Number.isNaN(Number(rec.statusCode))) {
      status = Number(rec.statusCode);
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
    if (typeof rec.status === 'number') {
      status = rec.status;
    } else if (typeof rec.statusCode === 'number') {
      status = rec.statusCode;
    }
  }

  // Fallback regex parsing if code or status were not directly available
  if (code === undefined) {
    const codeMatch = message.match(/\b(2\d{4})\b/);
    if (codeMatch && codeMatch[1]) {
      code = Number(codeMatch[1]);
    }
  }

  if (status === undefined) {
    const statusMatch = message.match(/HTTP\s*([45]\d{2})/i) || message.match(/\b([45]\d{2})\b/);
    if (statusMatch && statusMatch[1]) {
      status = Number(statusMatch[1]);
    }
  }

  // 1. Rate Limit branch
  if (code === 20429 || status === 429) {
    return {
      success: false,
      error: message,
      retryable: true,
      retryAfterMs: 1000,
    };
  }

  // 2. Non-retryable permanent error branch
  if (
    (typeof code === 'number' && NON_RETRYABLE_CODES.has(code)) ||
    (status !== undefined && NON_RETRYABLE_HTTP_STATUSES.has(status))
  ) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 3. Retryable transient error branch
  const isNetworkCode =
    (typeof code === 'string' && RETRYABLE_NETWORK_CODES.has(code)) ||
    Array.from(RETRYABLE_NETWORK_CODES).some((netCode) => message.includes(netCode));

  if (
    (typeof code === 'number' && RETRYABLE_CODES.has(code)) ||
    (status !== undefined && RETRYABLE_HTTP_STATUSES.has(status)) ||
    isNetworkCode
  ) {
    return {
      success: false,
      error: message,
      retryable: true,
    };
  }

  // 4. Fallback branch: default to retryable per Master Spec §6 & §13
  return {
    success: false,
    error: message,
    retryable: true,
  };
}
