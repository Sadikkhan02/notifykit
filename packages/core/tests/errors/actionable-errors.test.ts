import { describe, expect, it } from 'vitest';
import Redis from 'ioredis-mock';
import type { Redis as RedisClient } from 'ioredis';
import {
  NotifyKitError,
  ConfigError,
  MissingTemplateError,
  MissingVariableError,
  TemplateSyntaxError,
  InvalidEventError,
  MissingAdapterError,
} from '../../src/errors/index.js';
import { QueueRegistry } from '../../src/queue/registry.js';
import { RedisUnavailableError, QueueFullError } from '../../src/queue/errors.js';
import type { QueueChannel } from '../../src/queue/payload.js';

describe('Actionable Errors Audit & Regression Suite (Phase 13)', () => {
  it('TC-ERR-01: QueueRegistry.getQueue() throws NotifyKitError with E_QUEUE_NOT_REGISTERED and actionable hint', () => {
    const mockRedis = new Redis() as unknown as RedisClient;
    const registry = new QueueRegistry(mockRedis);

    try {
      registry.getQueue('nonexistent_channel' as unknown as QueueChannel);
      expect.unreachable('Should have thrown NotifyKitError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NotifyKitError);
      const notifyKitErr = err as NotifyKitError;
      expect(notifyKitErr.code).toBe('E_QUEUE_NOT_REGISTERED');
      expect(notifyKitErr.message).toContain('is not registered');
      expect(notifyKitErr.hint).toBeTruthy();
      expect(notifyKitErr.hint).toContain('valid registered channel');
      expect(notifyKitErr.traceId).toBeTruthy();
    }
  });

  it('TC-ERR-02: Every core error subclass adheres to the actionable-error contract', () => {
    const errors: NotifyKitError[] = [
      new ConfigError(
        'Invalid configuration',
        'Check your environment variables or config object.',
      ),
      new MissingTemplateError('welcome-email'),
      new MissingVariableError('userName', 'welcome-email'),
      new TemplateSyntaxError('Parse error on line 1', new Error('Syntax error')),
      new InvalidEventError({
        message: 'Invalid notification event payload',
        hint: 'Provide required recipient and channel fields.',
      }),
      new MissingAdapterError({
        message: 'No provider adapter configured for channel "sms".',
        hint: 'Configure an SMS provider adapter in createNotifier({ providers: { sms: ... } }).',
      }),
      new RedisUnavailableError('Connection refused to redis://127.0.0.1:6379'),
      new QueueFullError('Redis OOM error: maxmemory limit reached'),
      new NotifyKitError({
        code: 'E_CUSTOM_TEST',
        message: 'Custom error message',
        hint: 'Follow the test instructions to resolve.',
      }),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(NotifyKitError);
      expect(err).toBeInstanceOf(Error);

      // Verify code
      expect(typeof err.code).toBe('string');
      expect(err.code.startsWith('E_')).toBe(true);
      expect(err.code.length).toBeGreaterThan(3);

      // Verify message
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);

      // Verify actionable hint
      expect(typeof err.hint).toBe('string');
      expect(err.hint.length).toBeGreaterThan(5);

      // Verify correlation traceId
      expect(typeof err.traceId).toBe('string');
      expect(err.traceId.length).toBeGreaterThan(0);
    }
  });
});
