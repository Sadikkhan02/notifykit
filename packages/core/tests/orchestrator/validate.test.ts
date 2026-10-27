import { describe, expect, it } from 'vitest';
import { InvalidEventError } from '../../src/orchestrator/errors.js';
import { validateEvent } from '../../src/orchestrator/validate.js';

describe('Event Validation (validateEvent)', () => {
  it('passes for a valid email event', () => {
    const event = {
      to: { email: 'alice@example.com' },
      channels: ['email'],
      template: 'welcome',
      data: { name: 'Alice' },
    };

    const validated = validateEvent(event);
    expect(validated.to.email).toBe('alice@example.com');
    expect(validated.channels).toEqual(['email']);
    expect(validated.template).toBe('welcome');
  });

  it('passes for a valid multi-channel event with all recipient details', () => {
    const event = {
      to: {
        email: 'bob@example.com',
        phone: '+14155552671',
        pushToken: 'fcm_token_abc',
      },
      channels: ['email', 'sms', 'push'],
      template: 'security-alert',
      data: { time: '12:00' },
    };

    const validated = validateEvent(event);
    expect(validated.channels).toHaveLength(3);
  });

  it('throws InvalidEventError if raw event is not an object', () => {
    expect(() => validateEvent(null)).toThrow(InvalidEventError);
    expect(() => validateEvent('invalid')).toThrow(InvalidEventError);
    expect(() => validateEvent(undefined)).toThrow(InvalidEventError);
  });

  it('throws InvalidEventError with code E_INVALID_EVENT on schema mismatch', () => {
    try {
      validateEvent({ to: {}, channels: [] });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEventError);
      const error = err as InvalidEventError;
      expect(error.code).toBe('E_INVALID_EVENT');
      expect(error.hint).toBeDefined();
    }
  });

  it('rejects empty recipient when channel email is selected', () => {
    expect(() =>
      validateEvent({
        to: {},
        channels: ['email'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects whitespace-only email', () => {
    expect(() =>
      validateEvent({
        to: { email: '   ' },
        channels: ['email'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects invalid email format', () => {
    expect(() =>
      validateEvent({
        to: { email: 'not-an-email' },
        channels: ['email'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects missing phone when channel sms is selected', () => {
    expect(() =>
      validateEvent({
        to: { email: 'alice@example.com' },
        channels: ['sms'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects whitespace-only phone', () => {
    expect(() =>
      validateEvent({
        to: { phone: '   ' },
        channels: ['sms'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects non-E.164 phone number', () => {
    expect(() =>
      validateEvent({
        to: { phone: '12345' },
        channels: ['sms'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects missing pushToken when channel push is selected', () => {
    expect(() =>
      validateEvent({
        to: { email: 'alice@example.com' },
        channels: ['push'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects whitespace-only pushToken', () => {
    expect(() =>
      validateEvent({
        to: { pushToken: '   ' },
        channels: ['push'],
        template: 'test',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('rejects missing template identifier', () => {
    expect(() =>
      validateEvent({
        to: { email: 'alice@example.com' },
        channels: ['email'],
        template: '',
        data: {},
      }),
    ).toThrow(InvalidEventError);
  });

  it('attaches provided traceId to thrown InvalidEventError', () => {
    try {
      validateEvent(
        {
          to: {},
          channels: ['email'],
          template: 'test',
          data: {},
        },
        'trace-xyz-999',
      );
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEventError);
      expect((err as InvalidEventError).traceId).toBe('trace-xyz-999');
    }
  });
});
