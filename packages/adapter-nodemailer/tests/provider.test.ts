import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer, { type Transporter } from 'nodemailer';
import * as adapterExports from '../src/index.js';
import {
  NodemailerEmailProvider,
  metadata,
  mapNodemailerError,
  sanitizeErrorMessage,
} from '../src/index.js';

describe('NodemailerEmailProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Metadata and Public Exports', () => {
    it('exports all expected symbols from package index', () => {
      expect(adapterExports.NodemailerEmailProvider).toBeDefined();
      expect(adapterExports.metadata).toBeDefined();
      expect(adapterExports.mapNodemailerError).toBeDefined();
      expect(adapterExports.sanitizeErrorMessage).toBeDefined();
    });

    it('exports metadata with canonical fields matching specification', () => {
      expect(metadata.name).toBe('nodemailer');
      expect(metadata.channel).toBe('email');
      expect(metadata.requiredEnv).toEqual([
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASSWORD',
      ]);
      expect(metadata.version).toBe('0.0.1');
      expect(metadata.peerDependencies).toEqual({
        notifykit: '>=0.0.1',
        nodemailer: '>=6.9.0',
      });
    });

    it('satisfies the core AdapterMetadata contract and type assignment', () => {
      const coreMeta: import('notifykit/interfaces').AdapterMetadata = metadata;
      expect(coreMeta.name).toBe('nodemailer');
      expect(coreMeta.channel).toBe('email');
      expect(coreMeta.requiredEnv).toEqual([
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASSWORD',
      ]);
    });
  });

  describe('Configuration & Port/Secure Defaults', () => {
    it('returns error when SMTP host is missing and no transporter is injected', async () => {
      const provider = new NodemailerEmailProvider();
      const result = await provider.sendEmail({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('SMTP host is not configured');
    });

    it('creates transporter using host, custom port 465, and defaults secure to true', async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({ messageId: '<msg-465>' }),
      } as unknown as Transporter;
      const createTransportSpy = vi
        .spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const provider = new NodemailerEmailProvider({
        host: 'smtp.gmail.com',
        port: 465,
      });

      const result = await provider.sendEmail({
        to: 'dest@example.com',
        from: 'src@example.com',
        subject: 'Secure',
        html: 'Content',
      });

      expect(result.success).toBe(true);
      expect(createTransportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: undefined,
        }),
      );
    });

    it('creates transporter using env variables with auth and defaults port to 587 and secure to false', async () => {
      process.env.SMTP_HOST = 'smtp.sendgrid.net';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'apikey';
      process.env.SMTP_PASSWORD = 'SG.mockPassword';

      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({ messageId: '<msg-env>' }),
      } as unknown as Transporter;
      const createTransportSpy = vi
        .spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const provider = new NodemailerEmailProvider();
      const result = await provider.sendEmail({
        to: 'dest@example.com',
        from: 'src@example.com',
        subject: 'Env test',
        html: 'Content',
      });

      expect(result.success).toBe(true);
      expect(createTransportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: { user: 'apikey', pass: 'SG.mockPassword' },
        }),
      );
    });

    it('creates transporter with explicit config.auth and handles invalid SMTP_PORT fallback', async () => {
      process.env.SMTP_HOST = 'smtp.mail.com';
      process.env.SMTP_PORT = 'invalid-port';

      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({ messageId: '<msg-auth>' }),
      } as unknown as Transporter;
      const createTransportSpy = vi
        .spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const provider = new NodemailerEmailProvider({
        auth: { user: 'directUser', pass: 'directPass' },
      });

      await provider.sendEmail({
        to: 'dest@example.com',
        from: 'src@example.com',
        subject: 'Auth test',
        html: 'Content',
      });

      expect(createTransportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.mail.com',
          port: 587,
          secure: false,
          auth: { user: 'directUser', pass: 'directPass' },
        }),
      );
    });

    it('uses fallback sender priority: opts.from > config.from > env.SMTP_FROM > noreply', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: '<msg-from>' });
      const mockTransporter = { sendMail: mockSendMail } as unknown as Transporter;

      // 1. Explicit opts.from
      const provider1 = new NodemailerEmailProvider({
        from: 'config@example.com',
        transporter: mockTransporter,
      });
      await provider1.sendEmail({
        to: 'to@example.com',
        from: 'opts@example.com',
        subject: 'Sub',
        html: 'Html',
      });
      expect(mockSendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: 'opts@example.com' }),
      );

      // 2. config.from fallback
      const provider2 = new NodemailerEmailProvider({
        from: 'config@example.com',
        transporter: mockTransporter,
      });
      await provider2.sendEmail({
        to: 'to@example.com',
        from: '',
        subject: 'Sub',
        html: 'Html',
      });
      expect(mockSendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: 'config@example.com' }),
      );

      // 3. env.SMTP_FROM fallback
      process.env.SMTP_FROM = 'env@example.com';
      const provider3 = new NodemailerEmailProvider({ transporter: mockTransporter });
      await provider3.sendEmail({
        to: 'to@example.com',
        from: '',
        subject: 'Sub',
        html: 'Html',
      });
      expect(mockSendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: 'env@example.com' }),
      );

      // 4. Default noreply fallback
      delete process.env.SMTP_FROM;
      const provider4 = new NodemailerEmailProvider({ transporter: mockTransporter });
      await provider4.sendEmail({
        to: 'to@example.com',
        from: '',
        subject: 'Sub',
        html: 'Html',
      });
      expect(mockSendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: 'noreply@notifykit.dev' }),
      );
    });
  });

  describe('Delivery Success', () => {
    it('returns success: true and messageId when transporter.sendMail succeeds', async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({
          messageId: '<20261027150000.12345@smtp.example.com>',
        }),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'customer@example.com',
        from: 'billing@example.com',
        subject: 'Invoice #1024',
        html: '<p>Your invoice is attached.</p>',
        text: 'Your invoice is attached.',
      });

      expect(result).toEqual({
        success: true,
        messageId: '<20261027150000.12345@smtp.example.com>',
      });
    });
  });

  describe('Error Classification & Retryability Mapping', () => {
    it('maps EAUTH error to non-retryable result', async () => {
      const authError = Object.assign(
        new Error('Invalid login: 535-5.7.8 Username and Password not accepted'),
        {
          code: 'EAUTH',
          responseCode: 535,
        },
      );

      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(authError),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Alert',
        html: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('Invalid login');
    });

    it('maps EENVELOPE and SMTP 550 recipient rejection to non-retryable', async () => {
      const envelopeError = Object.assign(
        new Error('550 5.1.1 Recipient address rejected: User unknown'),
        {
          code: 'EENVELOPE',
          responseCode: '550',
        },
      );

      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(envelopeError),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'nonexistent@example.com',
        from: 'noreply@example.com',
        subject: 'Hello',
        html: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('User unknown');
    });

    it('maps EMESSAGE and SMTP 552 message size/policy rejection to non-retryable', async () => {
      const messageError = Object.assign(
        new Error('552 5.3.4 Message size exceeds fixed maximum limit'),
        {
          code: 'EMESSAGE',
          responseCode: 552,
        },
      );

      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(messageError),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Large File',
        html: 'Huge content',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('Message size exceeds');
    });

    it('extracts status code from error response property if responseCode is undefined', () => {
      const responseError = Object.assign(new Error('Rejected message'), {
        response: '554 Transaction failed',
      });
      const result = mapNodemailerError(responseError);
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('Rejected message');
    });

    it('maps ETIMEDOUT to retryable result', async () => {
      const timeoutError = Object.assign(new Error('Connection timeout to smtp.example.com:587'), {
        code: 'ETIMEDOUT',
      });

      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(timeoutError),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Ping',
        html: 'Ping',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toContain('Connection timeout');
    });

    it('maps ECONNREFUSED, ECONNRESET, ESOCKET, and EAI_AGAIN to retryable result', async () => {
      const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'EAI_AGAIN'];

      for (const code of networkCodes) {
        const error = Object.assign(new Error(`Network error ${code}`), { code });
        const mockTransporter = {
          sendMail: vi.fn().mockRejectedValue(error),
        } as unknown as Transporter;

        const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
        const result = await provider.sendEmail({
          to: 'user@example.com',
          from: 'noreply@example.com',
          subject: 'Test',
          html: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.retryable).toBe(true);
      }
    });

    it('maps transient SMTP 4xx codes (421, 450, 451, 452) to retryable', async () => {
      const transientCodes = [421, 450, 451, 452];

      for (const responseCode of transientCodes) {
        const error = Object.assign(new Error(`Server busy ${responseCode}`), {
          responseCode,
          response: `${responseCode} Service temporarily unavailable`,
        });

        const mockTransporter = {
          sendMail: vi.fn().mockRejectedValue(error),
        } as unknown as Transporter;

        const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
        const result = await provider.sendEmail({
          to: 'user@example.com',
          from: 'noreply@example.com',
          subject: 'Test',
          html: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.retryable).toBe(true);
      }
    });

    it('defaults unknown errors to retryable fallback', async () => {
      const unknownError = new Error('Something completely unexpected occurred');
      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(unknownError),
      } as unknown as Transporter;

      const provider = new NodemailerEmailProvider({ transporter: mockTransporter });
      const result = await provider.sendEmail({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Test',
        html: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toBe('Something completely unexpected occurred');
    });

    it('handles thrown non-Error string values', () => {
      const result = mapNodemailerError('Simple string rejection');
      expect(result).toEqual({
        success: false,
        error: 'Simple string rejection',
        retryable: true,
      });
    });

    it('redacts credentials from error messages', () => {
      const sanitized = sanitizeErrorMessage(
        'Failed auth: password=superSecretPassword&user: admin@example.com connection lost',
      );
      expect(sanitized).not.toContain('superSecretPassword');
      expect(sanitized).toContain('password=[REDACTED]');
      expect(sanitized).toContain('user: [REDACTED]');
    });
  });
});
