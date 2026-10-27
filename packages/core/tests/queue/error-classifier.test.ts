import { describe, expect, it } from 'vitest';
import { classifyError, isRetryableError } from '../../src/queue/error-classifier.js';

describe('Error Classifier — classifyError() & isRetryableError()', () => {
  describe('Tier 1: Explicit ProviderResult.retryable Flag (Highest Precedence)', () => {
    it('honors result.retryable === false even when error code looks like transient network failure', () => {
      const error = new Error('ECONNRESET connection reset by peer');
      (error as unknown as { code: string }).code = 'ECONNRESET';

      const classified = classifyError(error, {
        success: false,
        error: 'Explicit non-retryable account suspended',
        retryable: false,
      });

      expect(classified.retryable).toBe(false);
      expect(classified.message).toBe('ECONNRESET connection reset by peer');
    });

    it('honors result.retryable === true even when status code looks like 401 Unauthorized', () => {
      const error = new Error('401 Unauthorized from upstream');
      (error as unknown as { status: number }).status = 401;

      const classified = classifyError(error, {
        success: false,
        error: 'Temporary auth token refresh required',
        retryable: true,
      });

      expect(classified.retryable).toBe(true);
      expect(classified.httpStatus).toBe(401);
    });
  });

  describe('Tier 2: Recognized Structured Error Metadata', () => {
    it('classifies transient network error codes as retryable', () => {
      const networkCodes = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EAI_AGAIN',
        'UND_ERR_CONNECT_TIMEOUT',
      ];

      for (const code of networkCodes) {
        const error = new Error(`Socket failed with ${code}`);
        (error as unknown as { code: string }).code = code;

        const classified = classifyError(error);
        expect(classified.retryable).toBe(true);
        expect(classified.code).toBe(code);
        expect(isRetryableError(error)).toBe(true);
      }
    });

    it('classifies rate limits (429) and server errors (500, 502, 503, 504) as retryable', () => {
      const statuses = [408, 429, 500, 502, 503, 504];

      for (const status of statuses) {
        const error = new Error(`HTTP Error: ${status}`);
        (error as unknown as { statusCode: number }).statusCode = status;

        const classified = classifyError(error);
        expect(classified.retryable).toBe(true);
        expect(classified.httpStatus).toBe(status);
        expect(isRetryableError(error)).toBe(true);
      }
    });

    it('parses string status codes and recognizes httpStatus field', () => {
      const stringStatusError = new Error('Rate limit exceeded');
      (stringStatusError as unknown as { status: string }).status = '429';

      const classified1 = classifyError(stringStatusError);
      expect(classified1.retryable).toBe(true);
      expect(classified1.httpStatus).toBe(429);

      const httpStatusError = new Error('Gateway Timeout');
      (httpStatusError as unknown as { httpStatus: number }).httpStatus = 504;

      const classified2 = classifyError(httpStatusError);
      expect(classified2.retryable).toBe(true);
      expect(classified2.httpStatus).toBe(504);
    });

    it('classifies client errors (400, 401, 403, 404, 422) as non-retryable', () => {
      const statuses = [400, 401, 403, 404, 422];

      for (const status of statuses) {
        const error = new Error(`HTTP ${status} client failure`);
        (error as unknown as { status: number }).status = status;

        const classified = classifyError(error);
        expect(classified.retryable).toBe(false);
        expect(classified.httpStatus).toBe(status);
        expect(isRetryableError(error)).toBe(false);
      }
    });

    it('extracts HTTP status code from error message if not explicitly set as property', () => {
      const error = new Error('Upstream API returned 429 Too Many Requests');
      const classified = classifyError(error);

      expect(classified.retryable).toBe(true);
      expect(classified.httpStatus).toBe(429);
    });

    it('classifies validation and auth keyword messages as non-retryable', () => {
      const nonRetryableMessages = [
        'Invalid API key provided',
        'Unauthorized access to resource',
        'Forbidden: insufficient permissions',
        'Invalid recipient email format',
        'Invalid phone number for region',
      ];

      for (const msg of nonRetryableMessages) {
        const error = new Error(msg);
        const classified = classifyError(error);
        expect(classified.retryable).toBe(false);
      }
    });

    it('classifies ZodError or ValidationError as non-retryable', () => {
      const error = new Error('Validation failed');
      error.name = 'ZodError';

      const classified = classifyError(error);
      expect(classified.retryable).toBe(false);
      expect(classified.name).toBe('ZodError');
    });

    it('classifies E_MISSING_ADAPTER code as non-retryable', () => {
      const error = new Error('No adapter');
      (error as unknown as { code: string }).code = 'E_MISSING_ADAPTER';

      const classified = classifyError(error);
      expect(classified.retryable).toBe(false);
      expect(classified.code).toBe('E_MISSING_ADAPTER');
    });
  });

  describe('Tier 3: Fallback for Unknown / Ambiguous Errors', () => {
    it('defaults unknown generic error to retryable: true to prevent dropped notifications', () => {
      const error = new Error('Something completely unexpected occurred in runtime');
      const classified = classifyError(error);

      expect(classified.retryable).toBe(true);
      expect(classified.message).toBe('Something completely unexpected occurred in runtime');
      expect(classified.stack).toBeDefined();
    });

    it('handles string errors cleanly', () => {
      const classified = classifyError('Generic string error');
      expect(classified.retryable).toBe(true);
      expect(classified.message).toBe('Generic string error');
    });

    it('handles undefined error with ProviderResult.error', () => {
      const classified = classifyError(undefined, {
        success: false,
        error: 'Provider failure without error object',
      });
      expect(classified.retryable).toBe(true);
      expect(classified.message).toBe('Provider failure without error object');
    });

    it('handles completely empty error input gracefully', () => {
      const classified = classifyError(undefined, undefined);
      expect(classified.retryable).toBe(true);
      expect(classified.message).toBe('Unknown delivery error');
    });
  });
});
