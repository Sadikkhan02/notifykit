import type { ProviderResult } from 'notifykit/interfaces';

/**
 * Non-retryable FCM error codes for invalid/unregistered device tokens,
 * payload format violations, and permanent authentication/project configuration errors.
 */
const NON_RETRYABLE_FCM_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-recipient',
  'messaging/mismatched-credential',
  'messaging/invalid-argument',
  'messaging/invalid-payload',
  'messaging/payload-size-limit-exceeded',
  'messaging/authentication-error',
  'messaging/third-party-auth-error',
  'messaging/project-not-found',
  'app/invalid-credential',
]);

const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

/**
 * Transient FCM server error codes suitable for queue retry.
 */
const RETRYABLE_FCM_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unknown-error',
]);

const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ESOCKET',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/**
 * Normalizes error messages by redacting private keys, service account credentials,
 * and masking complete device registration tokens.
 */
export function sanitizeErrorMessage(message: string): string {
  return (
    message
      // Redact PEM private keys
      .replace(
        /-----BEGIN (?:RSA )?PRIVATE KEY-----[^-]+-----END (?:RSA )?PRIVATE KEY-----/gs,
        '[REDACTED_PRIVATE_KEY]',
      )
      // Redact sensitive credential assignments
      .replace(
        /(private_key|privateKey|token|secret|client_email|password|auth)=([^\s;&]+)/gi,
        (_match, key, val) => {
          if (val.includes('[REDACTED_PRIVATE_KEY]')) {
            return `${key}=[REDACTED_PRIVATE_KEY]`;
          }
          return `${key}=[REDACTED]`;
        },
      )
      .replace(
        /((?:private_key|privateKey|token|secret|client_email|password|auth):\s*)([^\s,]+)/gi,
        (_match, key, val) => {
          if (val.includes('[REDACTED_PRIVATE_KEY]')) {
            return `${key}[REDACTED_PRIVATE_KEY]`;
          }
          return `${key}[REDACTED]`;
        },
      )
      // Mask long device registration tokens (keeping only first 6 and last 6 characters)
      .replace(
        /(?<!messaging\/|app\/)\b([a-zA-Z0-9_:]{6})[a-zA-Z0-9_:.]{18,}([a-zA-Z0-9_-]{6})\b/g,
        (token, first, last) => {
          // If purely alphabetic-hyphenated string without digits or colons, it's not a device token
          if (!/[\d:]/.test(token)) {
            return token;
          }
          return `${first}...${last}`;
        },
      )
  );
}

/**
 * Maps a caught Firebase Admin exception or HTTP response error into a standardized ProviderResult.
 *
 * Precedence & Classification Rules:
 * 1. Rate limits & quota:
 *    - 'messaging/quota-exceeded' -> retryable = true, retryAfterMs = 5000.
 *    - HTTP 429 or 20429 -> retryable = true, retryAfterMs = 1000.
 * 2. Permanent token, payload, or auth failures:
 *    - NON_RETRYABLE_FCM_CODES or HTTP 400/401/403/404/422 -> retryable = false.
 * 3. Transient server or network failures:
 *    - RETRYABLE_FCM_CODES, HTTP 500/502/503/504, or network error codes -> retryable = true.
 * 4. Fallback: unknown errors default to retryable = true.
 */
export function mapFcmError(error: unknown): ProviderResult {
  let message = 'Unknown FCM push delivery error';
  let code: string | undefined;
  let status: number | undefined;

  if (error instanceof Error) {
    const rawMessage = error.message;
    const rec = error as unknown as Record<string, unknown>;

    if (typeof rec.code === 'string') {
      code = rec.code;
    }

    // Firebase errors often nest detailed codes under errorInfo
    if (!code && rec.errorInfo && typeof rec.errorInfo === 'object') {
      const errInfo = rec.errorInfo as Record<string, unknown>;
      if (typeof errInfo.code === 'string') {
        code = errInfo.code;
      }
    }

    // Fallback regex parsing for embedded status or FCM code strings on raw message
    if (!code) {
      const codeMatch =
        rawMessage.match(/\b(messaging\/[a-z0-9-]+)\b/i) ||
        rawMessage.match(/\b(app\/[a-z0-9-]+)\b/i);
      if (codeMatch && codeMatch[1]) {
        code = codeMatch[1].toLowerCase();
      }
    }

    if (typeof rec.status === 'number') {
      status = rec.status;
    } else if (typeof rec.statusCode === 'number') {
      status = rec.statusCode;
    } else if (typeof rec.status === 'string' && !Number.isNaN(Number(rec.status))) {
      status = Number(rec.status);
    } else if (typeof rec.statusCode === 'string' && !Number.isNaN(Number(rec.statusCode))) {
      status = Number(rec.statusCode);
    }

    if (status === undefined) {
      const statusMatch =
        rawMessage.match(/HTTP\s*([45]\d{2})/i) || rawMessage.match(/\b([45]\d{2})\b/);
      if (statusMatch && statusMatch[1]) {
        status = Number(statusMatch[1]);
      }
    }

    message = sanitizeErrorMessage(rawMessage);
  } else if (typeof error === 'string') {
    const codeMatch =
      error.match(/\b(messaging\/[a-z0-9-]+)\b/i) || error.match(/\b(app\/[a-z0-9-]+)\b/i);
    if (codeMatch && codeMatch[1]) {
      code = codeMatch[1].toLowerCase();
    }
    const statusMatch = error.match(/HTTP\s*([45]\d{2})/i) || error.match(/\b([45]\d{2})\b/);
    if (statusMatch && statusMatch[1]) {
      status = Number(statusMatch[1]);
    }
    message = sanitizeErrorMessage(error);
  } else if (error && typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    const rawMessage = typeof rec.message === 'string' ? rec.message : '';
    if (typeof rec.code === 'string') {
      code = rec.code;
    }
    if (!code && rec.errorInfo && typeof rec.errorInfo === 'object') {
      const errInfo = rec.errorInfo as Record<string, unknown>;
      if (typeof errInfo.code === 'string') {
        code = errInfo.code;
      }
    }
    if (!code && rawMessage) {
      const codeMatch =
        rawMessage.match(/\b(messaging\/[a-z0-9-]+)\b/i) ||
        rawMessage.match(/\b(app\/[a-z0-9-]+)\b/i);
      if (codeMatch && codeMatch[1]) {
        code = codeMatch[1].toLowerCase();
      }
    }
    if (typeof rec.status === 'number') {
      status = rec.status;
    } else if (typeof rec.statusCode === 'number') {
      status = rec.statusCode;
    } else if (typeof rec.status === 'string' && !Number.isNaN(Number(rec.status))) {
      status = Number(rec.status);
    } else if (typeof rec.statusCode === 'string' && !Number.isNaN(Number(rec.statusCode))) {
      status = Number(rec.statusCode);
    }
    if (status === undefined && rawMessage) {
      const statusMatch =
        rawMessage.match(/HTTP\s*([45]\d{2})/i) || rawMessage.match(/\b([45]\d{2})\b/);
      if (statusMatch && statusMatch[1]) {
        status = Number(statusMatch[1]);
      }
    }
    if (rawMessage) {
      message = sanitizeErrorMessage(rawMessage);
    }
  }

  // 1. Rate Limit & Quota branch
  if (code === 'messaging/quota-exceeded') {
    return {
      success: false,
      error: message,
      retryable: true,
      retryAfterMs: 5000,
    };
  }

  if (status === 429 || code === '20429') {
    return {
      success: false,
      error: message,
      retryable: true,
      retryAfterMs: 1000,
    };
  }

  // 2. Permanent failure branch (strictly non-retryable)
  if (
    (code !== undefined && NON_RETRYABLE_FCM_CODES.has(code)) ||
    (status !== undefined && NON_RETRYABLE_HTTP_STATUSES.has(status))
  ) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 3. Transient server and network error branch (retryable)
  const isNetworkCode =
    (code !== undefined && RETRYABLE_NETWORK_CODES.has(code)) ||
    Array.from(RETRYABLE_NETWORK_CODES).some((netCode) => message.includes(netCode)) ||
    message.includes('fetch failed');

  if (
    (code !== undefined && RETRYABLE_FCM_CODES.has(code)) ||
    (status !== undefined && RETRYABLE_HTTP_STATUSES.has(status)) ||
    isNetworkCode
  ) {
    return {
      success: false,
      error: message,
      retryable: true,
    };
  }

  // 4. Fallback: unknown errors default to retryable per Master Spec §6 & §15
  return {
    success: false,
    error: message,
    retryable: true,
  };
}
