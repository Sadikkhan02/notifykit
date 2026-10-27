import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { getLogger, createScopedLogger } from '../../src/logging/logger.js';

describe('Structured Logger & Redaction', () => {
  it('creates a Pino logger with default info level', () => {
    const logger = getLogger();
    expect(logger.level).toBe('info');
  });

  it('respects custom log level or environment variable', () => {
    const logger = getLogger('debug');
    expect(logger.level).toBe('debug');

    const originalLogLevel = process.env.LOG_LEVEL;
    try {
      process.env.LOG_LEVEL = 'warn';
      const envLogger = getLogger();
      expect(envLogger.level).toBe('warn');
    } finally {
      if (originalLogLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = originalLogLevel;
      }
    }
  });

  it('redacts top-level sensitive fields to [REDACTED]', () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });

    const logger = getLogger('info', stream);
    logger.info(
      {
        token: 'super_secret_token_123',
        password: 'my_password_xyz',
        secret: 'top_secret',
        apiKey: 'api_key_abc',
      },
      'Test log message',
    );

    const firstLog = logs[0] ?? '{}';
    const parsed = JSON.parse(firstLog);
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.secret).toBe('[REDACTED]');
    expect(parsed.apiKey).toBe('[REDACTED]');
    expect(logs[0]).not.toContain('super_secret_token_123');
    expect(logs[0]).not.toContain('my_password_xyz');
  });

  it('redacts nested sensitive fields up to 4 levels deep', () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });

    const logger = getLogger('info', stream);
    logger.info(
      {
        data: {
          user: {
            password: 'nested_password_123',
          },
        },
        config: {
          providers: {
            email: {
              authKey: 'email_auth_key_456',
            },
          },
        },
      },
      'Nested credentials log',
    );

    const firstLog = logs[0] ?? '{}';
    const parsed = JSON.parse(firstLog);
    expect(parsed.data.user.password).toBe('[REDACTED]');
    expect(parsed.config.providers.email.authKey).toBe('[REDACTED]');
    expect(logs[0]).not.toContain('nested_password_123');
    expect(logs[0]).not.toContain('email_auth_key_456');
  });

  it('creates scoped child logger with traceId and job bindings', () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });

    const baseLogger = getLogger('info', stream);
    const scoped = createScopedLogger(
      {
        traceId: 'trace-12345',
        jobId: 'job-98765',
        channel: 'email',
        provider: 'nodemailer',
      },
      baseLogger,
    );

    scoped.info({ recipient: 'user@example.com' }, 'Job processing');

    const firstLog = logs[0] ?? '{}';
    const parsed = JSON.parse(firstLog);
    expect(parsed.traceId).toBe('trace-12345');
    expect(parsed.jobId).toBe('job-98765');
    expect(parsed.channel).toBe('email');
    expect(parsed.provider).toBe('nodemailer');
    expect(parsed.recipient).toBe('user@example.com');
  });

  it('creates scoped child logger using default base logger when parentLogger is omitted', () => {
    const scoped = createScopedLogger({ traceId: 'default-parent-trace' });
    expect(scoped).toBeDefined();
    expect(typeof scoped.info).toBe('function');
  });
});
