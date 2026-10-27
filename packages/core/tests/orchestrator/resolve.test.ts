import { describe, expect, it } from 'vitest';
import { MissingAdapterError } from '../../src/orchestrator/errors.js';
import { resolveChannelAdapters } from '../../src/orchestrator/resolve.js';

describe('Adapter Resolution (resolveChannelAdapters)', () => {
  it('resolves channel from provider config type', () => {
    const providers = {
      email: { type: 'nodemailer', host: 'smtp.example.com' },
    };

    const resolved = resolveChannelAdapters(['email'], providers);
    expect(resolved.has('email')).toBe(true);
    expect(resolved.get('email')?.providerName).toBe('nodemailer');
  });

  it('resolves channel from injected runtime adapter per ADR-003', () => {
    const mockAdapter = {
      name: 'custom-smtp',
      send: () => Promise.resolve({ id: '1' }),
    };

    const providers = {
      email: { type: 'custom', adapter: mockAdapter },
    };

    const resolved = resolveChannelAdapters(['email'], providers);
    expect(resolved.get('email')?.providerName).toBe('custom-smtp');
    expect(resolved.get('email')?.adapter).toBe(mockAdapter);
  });

  it('falls back to unknown if neither adapter name nor type string is present', () => {
    const providers = {
      email: { type: '' as unknown as string },
    };

    const resolved = resolveChannelAdapters(['email'], providers);
    expect(resolved.get('email')?.providerName).toBe('unknown');
  });

  it('resolves multiple channels simultaneously', () => {
    const providers = {
      email: { type: 'nodemailer' },
      sms: { type: 'twilio' },
    };

    const resolved = resolveChannelAdapters(['email', 'sms'], providers);
    expect(resolved.get('email')?.providerName).toBe('nodemailer');
    expect(resolved.get('sms')?.providerName).toBe('twilio');
  });

  it('throws MissingAdapterError with code E_MISSING_ADAPTER when provider missing', () => {
    const providers = {
      email: { type: 'nodemailer' },
    };

    try {
      resolveChannelAdapters(['email', 'sms'], providers);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingAdapterError);
      const error = err as MissingAdapterError;
      expect(error.code).toBe('E_MISSING_ADAPTER');
      expect(error.message).toContain('sms');
      expect(error.hint).toContain('sms');
    }
  });

  it('propagates traceId to thrown MissingAdapterError', () => {
    try {
      resolveChannelAdapters(['push'], undefined, 'trace-missing-123');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingAdapterError);
      expect((err as MissingAdapterError).traceId).toBe('trace-missing-123');
    }
  });
});
