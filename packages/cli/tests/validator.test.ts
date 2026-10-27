import { describe, it, expect } from 'vitest';
import {
  validateChannels,
  validateProvider,
  getMissingRequiredCredentials,
  parseAndValidateNonInteractive,
} from '../src/validator.js';

describe('CLI Validator', () => {
  describe('validateChannels', () => {
    it('rejects empty, non-array, or invalid channels', () => {
      expect(validateChannels([]).valid).toBe(false);
      expect(validateChannels(null).valid).toBe(false);
      expect(validateChannels(['invalid_channel']).valid).toBe(false);
    });

    it('accepts valid single and multiple channels', () => {
      expect(validateChannels(['email']).valid).toBe(true);
      expect(validateChannels(['email', 'sms']).valid).toBe(true);
      expect(validateChannels(['email', 'sms', 'push']).valid).toBe(true);
    });
  });

  describe('validateProvider', () => {
    it('validates provider per channel correctly', () => {
      expect(validateProvider('email', 'nodemailer').valid).toBe(true);
      expect(validateProvider('email', 'other').valid).toBe(false);

      expect(validateProvider('sms', 'twilio').valid).toBe(true);
      expect(validateProvider('sms', 'msg91').valid).toBe(true);
      expect(validateProvider('sms', 'other').valid).toBe(false);

      expect(validateProvider('push', 'fcm').valid).toBe(true);
      expect(validateProvider('push', 'apns').valid).toBe(false);
    });
  });

  describe('getMissingRequiredCredentials', () => {
    it('detects missing credentials for Nodemailer', () => {
      expect(getMissingRequiredCredentials('nodemailer', {})).toEqual([
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASSWORD',
      ]);
      expect(
        getMissingRequiredCredentials('nodemailer', {
          SMTP_HOST: 'smtp.mail.com',
          SMTP_PORT: '587',
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'pw',
        }),
      ).toEqual([]);
    });

    it('detects missing credentials for Twilio', () => {
      expect(getMissingRequiredCredentials('twilio', {})).toEqual([
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
      ]);
      expect(
        getMissingRequiredCredentials('twilio', {
          TWILIO_ACCOUNT_SID: 'AC123',
          TWILIO_AUTH_TOKEN: 'secret',
        }),
      ).toEqual([]);
    });

    it('detects missing credentials for MSG91', () => {
      expect(getMissingRequiredCredentials('msg91', {})).toEqual([
        'MSG91_AUTH_KEY',
        'MSG91_FLOW_ID',
      ]);
      expect(
        getMissingRequiredCredentials('msg91', {
          MSG91_AUTH_KEY: 'auth_key',
          MSG91_FLOW_ID: 'flow_id',
        }),
      ).toEqual([]);
    });

    it('detects missing credentials for FCM', () => {
      expect(getMissingRequiredCredentials('fcm', {})).toEqual(['FCM_SERVICE_ACCOUNT_JSON']);
      expect(
        getMissingRequiredCredentials('fcm', {
          FCM_SERVICE_ACCOUNT_JSON: '{"project_id":"p"}',
        }),
      ).toEqual([]);
    });
  });

  describe('parseAndValidateNonInteractive', () => {
    it('throws when channels are omitted or empty', () => {
      expect(() => parseAndValidateNonInteractive({})).toThrow(/Missing required flag: --channels/);
      expect(() => parseAndValidateNonInteractive({ channels: '' })).toThrow(
        /Missing required flag: --channels/,
      );
    });

    it('throws when invalid channel is specified', () => {
      expect(() => parseAndValidateNonInteractive({ channels: 'pager' })).toThrow(
        /Invalid channel/,
      );
    });

    it('throws when SMS channel is selected without provider', () => {
      expect(() => parseAndValidateNonInteractive({ channels: 'sms' })).toThrow(
        /SMS channel selected but no provider specified/,
      );
    });

    it('validates and parses complete Twilio SMS configuration', () => {
      const config = parseAndValidateNonInteractive({
        channels: 'sms',
        sms: 'twilio',
        twilioSid: 'AC_sample_123',
        twilioToken: 'token_sample_456',
        twilioFrom: '+15551234567',
        redisUrl: 'redis://redis.my-host.internal:6379',
      });

      expect(config.channels).toEqual(['sms']);
      expect(config.providers.sms).toBe('twilio');
      expect(config.redisUrl).toBe('redis://redis.my-host.internal:6379');
      expect(config.credentials.TWILIO_ACCOUNT_SID).toBe('AC_sample_123');
      expect(config.credentials.TWILIO_AUTH_TOKEN).toBe('token_sample_456');
      expect(config.credentials.TWILIO_FROM).toBe('+15551234567');
      expect(config.credentials.NOTIFYKIT_SMS_PROVIDER).toBe('twilio');
    });

    it('validates and parses complete Nodemailer configuration with aliases', () => {
      const config = parseAndValidateNonInteractive({
        channels: 'email',
        smtpHost: 'smtp.test.com',
        smtpPort: '465',
        smtpUser: 'my_user',
        smtpPassword: 'my_password',
        smtpSecure: 'true',
      });

      expect(config.channels).toEqual(['email']);
      expect(config.providers.email).toBe('nodemailer');
      expect(config.credentials.SMTP_HOST).toBe('smtp.test.com');
      expect(config.credentials.SMTP_PORT).toBe('465');
      expect(config.credentials.SMTP_SECURE).toBe('true');
      expect(config.redisUrl).toBe('redis://localhost:6379');
    });

    it('validates and parses MSG91 configuration', () => {
      const config = parseAndValidateNonInteractive({
        channels: 'sms',
        sms: 'msg91',
        msg91AuthKey: 'my_auth_key',
        msg91FlowId: 'my_flow_id',
        msg91SenderId: 'MYOTP',
      });

      expect(config.providers.sms).toBe('msg91');
      expect(config.credentials.MSG91_AUTH_KEY).toBe('my_auth_key');
      expect(config.credentials.MSG91_FLOW_ID).toBe('my_flow_id');
      expect(config.credentials.MSG91_SENDER_ID).toBe('MYOTP');
    });

    it('validates and parses FCM configuration with alias flag', () => {
      const config = parseAndValidateNonInteractive({
        channels: 'push',
        push: 'fcm',
        fcmServiceAccountJson: '{"type":"service_account"}',
        fcmProjectId: 'my-fcm-project',
      });

      expect(config.providers.push).toBe('fcm');
      expect(config.credentials.FCM_SERVICE_ACCOUNT_JSON).toBe('{"type":"service_account"}');
      expect(config.credentials.FCM_PROJECT_ID).toBe('my-fcm-project');
    });

    it('throws when required credentials for selected provider are missing', () => {
      expect(() =>
        parseAndValidateNonInteractive({
          channels: 'email',
          email: 'nodemailer',
          smtpHost: 'smtp.test.com',
          // missing port, user, password
        }),
      ).toThrow(/Missing required credentials for email/);

      expect(() =>
        parseAndValidateNonInteractive({
          channels: 'sms',
          sms: 'twilio',
          twilioSid: 'AC123',
          // missing token
        }),
      ).toThrow(/Missing required credentials for SMS/);
    });
  });
});
