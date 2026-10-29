import { describe, it, expect } from 'vitest';
import {
  createTestRecipient,
  createTestNotificationJob,
  createMockProviderResult,
} from '../src/index.js';

describe('test-utils fixtures', () => {
  describe('createTestRecipient', () => {
    it('creates a valid email recipient with defaults and overrides', () => {
      const defaultEmail = createTestRecipient('email');
      expect(defaultEmail.email).toBe('user@example.com');
      expect(defaultEmail.phone).toBeUndefined();
      expect(defaultEmail.pushToken).toBeUndefined();

      const customEmail = createTestRecipient('email', { email: 'custom@domain.org' });
      expect(customEmail.email).toBe('custom@domain.org');
    });

    it('creates a valid SMS recipient with defaults and overrides', () => {
      const defaultSms = createTestRecipient('sms');
      expect(defaultSms.phone).toBe('+15551234567');
      expect(defaultSms.email).toBeUndefined();

      const customSms = createTestRecipient('sms', { phone: '+919876543210' });
      expect(customSms.phone).toBe('+919876543210');
    });

    it('creates a valid push recipient with defaults and overrides', () => {
      const defaultPush = createTestRecipient('push');
      expect(defaultPush.pushToken).toBe('fcm-device-registration-token-001');

      const customPush = createTestRecipient('push', { pushToken: 'custom-token-999' });
      expect(customPush.pushToken).toBe('custom-token-999');
    });
  });

  describe('createTestNotificationJob', () => {
    it('creates a deterministic notification job for email', () => {
      const job = createTestNotificationJob('email');
      expect(job.id).toBe('0192a4b8-82df-76a0-80a5-f7163c46e3ea');
      expect(job.channel).toBe('email');
      expect(job.provider).toBe('mock-email');
      expect(job.to.email).toBe('user@example.com');
      expect(job.templateId).toBe('test-template');
      expect(job.renderedBody).toBe('<p>Test notification body</p>');
      expect(job.metadata.traceId).toBe('0192a4b8-82df-76a0-80a5-f7163c46e3ea');
    });

    it('applies overrides cleanly', () => {
      const job = createTestNotificationJob('sms', {
        templateId: 'custom-otp',
        variables: { otp: '123456' },
      });
      expect(job.channel).toBe('sms');
      expect(job.templateId).toBe('custom-otp');
      expect(job.variables).toEqual({ otp: '123456' });
      expect(job.to.phone).toBe('+15551234567');
    });
  });

  describe('createMockProviderResult', () => {
    it('returns standard success result by default', () => {
      const res = createMockProviderResult();
      expect(res.success).toBe(true);
      expect(res.messageId).toBe('mock-msg-001');
      expect(res.error).toBeUndefined();
    });

    it('allows overriding properties for failure scenarios', () => {
      const failure = createMockProviderResult({
        success: false,
        error: 'Rate limit',
        retryable: true,
        retryAfterMs: 5000,
      });
      expect(failure.success).toBe(false);
      expect(failure.error).toBe('Rate limit');
      expect(failure.retryable).toBe(true);
      expect(failure.retryAfterMs).toBe(5000);
    });
  });
});
