import type { ProviderResult } from 'notifykit/interfaces';

const NON_RETRYABLE_CODES = new Set(['EAUTH', 'EENVELOPE', 'EMESSAGE']);
const NON_RETRYABLE_SMTP_STATUSES = new Set([535, 550, 551, 552, 553, 554]);

const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ESOCKET',
  'EAI_AGAIN',
]);
const RETRYABLE_SMTP_STATUSES = new Set([421, 450, 451, 452]);

/**
 * Normalizes and redacts credentials from error message strings.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(password|pass|secret|token|auth)=[^&;\s]+/gi, '$1=[REDACTED]')
    .replace(/(user:\s*)[^\s,]+/gi, '$1[REDACTED]');
}

/**
 * Maps a caught Nodemailer or SMTP exception into a standardized ProviderResult.
 *
 * Precedence & Classification Rules:
 * - EAUTH or SMTP 535: non-retryable (authentication failure).
 * - EENVELOPE or SMTP 550, 551, 553: non-retryable (invalid/rejected recipient).
 * - EMESSAGE or SMTP 552, 554: non-retryable (policy/size rejection).
 * - ETIMEDOUT, ECONNREFUSED, ECONNRESET, ESOCKET, EAI_AGAIN: retryable (network errors).
 * - SMTP 421, 450, 451, 452: retryable (transient server busy/rate limited).
 * - Unknown errors: fallback to retryable.
 */
export function mapNodemailerError(error: unknown): ProviderResult {
  let message = 'Unknown SMTP delivery error';
  let code: string | undefined;
  let responseCode: number | undefined;

  if (error instanceof Error) {
    message = sanitizeErrorMessage(error.message);
    const rec = error as unknown as Record<string, unknown>;
    if (typeof rec.code === 'string') {
      code = rec.code;
    }
    if (typeof rec.responseCode === 'number') {
      responseCode = rec.responseCode;
    } else if (typeof rec.responseCode === 'string' && !Number.isNaN(Number(rec.responseCode))) {
      responseCode = Number(rec.responseCode);
    }

    if (responseCode === undefined && typeof rec.response === 'string') {
      const match = (rec.response as string).match(/\b([45]\d{2})\b/);
      if (match) {
        responseCode = Number(match[1]);
      }
    }
  } else if (typeof error === 'string') {
    message = sanitizeErrorMessage(error);
  }

  if (responseCode === undefined) {
    const match = message.match(/\b([45]\d{2})\b/);
    if (match) {
      responseCode = Number(match[1]);
    }
  }

  // 1. Non-retryable branch
  if (
    (code !== undefined && NON_RETRYABLE_CODES.has(code)) ||
    (responseCode !== undefined && NON_RETRYABLE_SMTP_STATUSES.has(responseCode))
  ) {
    return {
      success: false,
      error: message,
      retryable: false,
    };
  }

  // 2. Retryable branch
  if (
    (code !== undefined && RETRYABLE_CODES.has(code)) ||
    (responseCode !== undefined && RETRYABLE_SMTP_STATUSES.has(responseCode))
  ) {
    return {
      success: false,
      error: message,
      retryable: true,
    };
  }

  // 3. Fallback branch: unknown errors default to retryable
  return {
    success: false,
    error: message,
    retryable: true,
  };
}
