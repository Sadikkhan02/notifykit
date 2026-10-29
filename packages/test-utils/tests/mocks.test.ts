import { describe, it, expect } from 'vitest';
import {
  createMockEmailProvider,
  createMockSmsProvider,
  createMockPushProvider,
} from '../src/index.js';

describe('test-utils mock providers', () => {
  describe('createMockEmailProvider', () => {
    it('records sendEmail calls and returns success result', async () => {
      const provider = createMockEmailProvider({ name: 'custom-smtp' });
      expect(provider.name).toBe('custom-smtp');
      expect(provider.calls).toHaveLength(0);

      const res = await provider.sendEmail({
        to: 'a@example.com',
        from: 'b@example.com',
        subject: 'Subj',
        html: '<p>Body</p>',
      });

      expect(res.success).toBe(true);
      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.to).toBe('a@example.com');
      expect(provider.calls[0]?.from).toBe('b@example.com');
    });

    it('supports setResult and thrown errors', async () => {
      const provider = createMockEmailProvider();
      provider.setResult({
        success: false,
        error: 'SMTP 550 User not found',
        retryable: false,
      });

      const res = await provider.sendEmail({
        to: 'invalid@example.com',
        from: 'b@example.com',
        subject: 'Subj',
        html: '<p>Body</p>',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('SMTP 550 User not found');

      provider.setResult(new Error('Fatal socket fault'));
      await expect(
        provider.sendEmail({
          to: 'a@example.com',
          from: 'b@example.com',
          subject: 'Subj',
          html: '<p>Body</p>',
        }),
      ).rejects.toThrow('Fatal socket fault');
    });

    it('resets calls and results cleanly', async () => {
      const provider = createMockEmailProvider();
      await provider.sendEmail({
        to: 'a@example.com',
        from: 'b@example.com',
        subject: 'Subj',
        html: '<p>Body</p>',
      });
      expect(provider.calls).toHaveLength(1);

      provider.reset();
      expect(provider.calls).toHaveLength(0);
    });
  });

  describe('createMockSmsProvider', () => {
    it('records sendSms calls and returns results', async () => {
      const provider = createMockSmsProvider();
      expect(provider.name).toBe('mock-sms');

      const res = await provider.sendSms({
        to: '+15551234567',
        body: 'Your code is 1234',
        variables: { otp: '1234' },
      });

      expect(res.success).toBe(true);
      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.to).toBe('+15551234567');
      expect(provider.calls[0]?.variables).toEqual({ otp: '1234' });
    });
  });

  describe('createMockPushProvider', () => {
    it('records sendPush calls and returns results', async () => {
      const provider = createMockPushProvider();
      expect(provider.name).toBe('mock-push');

      const res = await provider.sendPush({
        token: 'dev-token-xyz',
        title: 'New Notification',
        body: 'Click here',
        data: { link: '/dashboard' },
      });

      expect(res.success).toBe(true);
      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]?.token).toBe('dev-token-xyz');
      expect(provider.calls[0]?.data).toEqual({ link: '/dashboard' });
    });
  });
});
