import { describe, expect, it, vi } from 'vitest';
import type { EmailProvider, PushProvider, SmsProvider } from '../../src/interfaces/providers.js';
import { MissingAdapterError } from '../../src/orchestrator/errors.js';
import { dispatchJob } from '../../src/queue/dispatch.js';
import type { NotificationJob } from '../../src/queue/payload.js';

describe('Queue Dispatcher — dispatchJob()', () => {
  it('dispatches email notification to EmailProvider.sendEmail', async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({
      success: true,
      messageId: 'smtp_msg_123',
    });

    const mockEmailAdapter: EmailProvider = {
      name: 'mock-smtp',
      sendEmail: mockSendEmail,
    };

    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'mock-smtp',
      to: { email: 'alice@example.com' },
      templateId: 'welcome',
      renderedBody: '<h1>Welcome, Alice!</h1>',
      variables: { subject: 'Welcome to NotifyKit', text: 'Welcome plain' },
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        email: {
          type: 'mock-smtp',
          from: 'hello@notifykit.dev',
          adapter: mockEmailAdapter,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp_msg_123');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'alice@example.com',
      from: 'hello@notifykit.dev',
      subject: 'Welcome to NotifyKit',
      html: '<h1>Welcome, Alice!</h1>',
      text: 'Welcome plain',
    });
  });

  it('uses default fallback from and subject if not provided in config or variables', async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
    const mockEmailAdapter: EmailProvider = {
      name: 'mock-smtp',
      sendEmail: mockSendEmail,
    };

    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'mock-smtp',
      to: { email: 'bob@example.com' },
      templateId: 'order-confirmed',
      renderedBody: 'Order confirmation',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        email: {
          type: 'mock-smtp',
          adapter: mockEmailAdapter,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'bob@example.com',
      from: 'noreply@notifykit.dev',
      subject: 'Notification: order-confirmed',
      html: 'Order confirmation',
      text: undefined,
    });
  });

  it('uses config.user as fallback from and job.subject as fallback subject', async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
    const mockEmailAdapter: EmailProvider = {
      name: 'mock-smtp',
      sendEmail: mockSendEmail,
    };

    const job = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'mock-smtp',
      to: { email: 'bob@example.com' },
      templateId: 'order-confirmed',
      subject: 'Direct Job Subject',
      renderedBody: 'Order confirmation',
      variables: {},
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    } as unknown as NotificationJob;

    const result = await dispatchJob(job, {
      providers: {
        email: {
          type: 'mock-smtp',
          user: 'user@example.com',
          adapter: mockEmailAdapter,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'bob@example.com',
      from: 'user@example.com',
      subject: 'Direct Job Subject',
      html: 'Order confirmation',
      text: undefined,
    });
  });

  it('fails fast if recipient email is missing', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'mock-smtp',
      to: {},
      templateId: 'welcome',
      renderedBody: 'Welcome',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        email: { type: 'mock-smtp', adapter: { name: 'mock-smtp', sendEmail: vi.fn() } },
      },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('Recipient email address is missing');
  });

  it('throws MissingAdapterError if email adapter has no sendEmail method', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'mock-smtp',
      to: { email: 'bob@example.com' },
      templateId: 'test',
      renderedBody: 'test',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    await expect(
      dispatchJob(job, {
        providers: {
          email: { type: 'mock-smtp', adapter: { name: 'invalid-adapter' } },
        },
      }),
    ).rejects.toThrow(MissingAdapterError);
  });

  it('dispatches SMS notification to SmsProvider.sendSms', async () => {
    const mockSendSms = vi.fn().mockResolvedValue({
      success: true,
      messageId: 'sms_msg_987',
    });

    const mockSmsAdapter: SmsProvider = {
      name: 'mock-twilio',
      sendSms: mockSendSms,
    };

    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'sms',
      provider: 'mock-twilio',
      to: { phone: '+14155552671' },
      templateId: 'otp-code',
      renderedBody: 'Your code is 123456',
      variables: { code: '123456' },
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        sms: {
          type: 'twilio',
          from: '+14155550100',
          adapter: mockSmsAdapter,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('sms_msg_987');
    expect(mockSendSms).toHaveBeenCalledWith({
      to: '+14155552671',
      from: '+14155550100',
      body: 'Your code is 123456',
      templateId: 'otp-code',
      variables: { code: '123456' },
    });
  });

  it('fails fast if recipient phone number is missing', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'sms',
      provider: 'mock-twilio',
      to: {},
      templateId: 'otp-code',
      renderedBody: 'Code: 123456',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        sms: { type: 'twilio', adapter: { name: 'twilio', sendSms: vi.fn() } },
      },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('Recipient phone number is missing');
  });

  it('throws MissingAdapterError if sms adapter has no sendSms method', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'sms',
      provider: 'mock-twilio',
      to: { phone: '+14155552671' },
      templateId: 'otp-code',
      renderedBody: 'Code: 123456',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    await expect(
      dispatchJob(job, {
        providers: {
          sms: { type: 'twilio', adapter: { name: 'twilio' } },
        },
      }),
    ).rejects.toThrow(MissingAdapterError);
  });

  it('dispatches Push notification to PushProvider.sendPush', async () => {
    const mockSendPush = vi.fn().mockResolvedValue({
      success: true,
      messageId: 'fcm_msg_555',
    });

    const mockPushAdapter: PushProvider = {
      name: 'mock-fcm',
      sendPush: mockSendPush,
    };

    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'push',
      provider: 'mock-fcm',
      to: { pushToken: 'device_token_xyz_123' },
      templateId: 'app-update',
      renderedBody: 'Version 2.0 is out!',
      variables: { title: 'New Update Available', version: '2.0' },
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        push: {
          type: 'fcm',
          adapter: mockPushAdapter,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('fcm_msg_555');
    expect(mockSendPush).toHaveBeenCalledWith({
      token: 'device_token_xyz_123',
      title: 'New Update Available',
      body: 'Version 2.0 is out!',
      data: { title: 'New Update Available', version: '2.0' },
    });
  });

  it('fails fast if recipient pushToken is missing', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'push',
      provider: 'mock-fcm',
      to: {},
      templateId: 'test',
      renderedBody: 'Test Push',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    const result = await dispatchJob(job, {
      providers: {
        push: { type: 'fcm', adapter: { name: 'fcm', sendPush: vi.fn() } },
      },
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('Recipient pushToken is missing');
  });

  it('throws MissingAdapterError if push adapter has no sendPush method', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'push',
      provider: 'mock-fcm',
      to: { pushToken: 'token_123' },
      templateId: 'test',
      renderedBody: 'Test Push',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    await expect(
      dispatchJob(job, {
        providers: {
          push: { type: 'fcm', adapter: { name: 'fcm' } },
        },
      }),
    ).rejects.toThrow(MissingAdapterError);
  });

  it('throws MissingAdapterError if channel provider is not configured at all', async () => {
    const job: NotificationJob = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'email',
      provider: 'nodemailer',
      to: { email: 'test@example.com' },
      templateId: 'test',
      renderedBody: 'test',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    };

    await expect(dispatchJob(job, { providers: {} })).rejects.toThrow(MissingAdapterError);
  });

  it('throws error for unsupported channel', async () => {
    const job = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'carrier-pigeon',
      provider: 'bird',
      to: {},
      templateId: 'test',
      renderedBody: 'test',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    } as unknown as NotificationJob;

    await expect(dispatchJob(job, { providers: {} })).rejects.toThrow(MissingAdapterError);
  });

  it('throws error for unsupported channel in dispatch switch when provider is configured', async () => {
    const job = {
      id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
      channel: 'carrier-pigeon',
      provider: 'bird',
      to: {},
      templateId: 'test',
      renderedBody: 'test',
      metadata: { enqueuedAt: Date.now(), traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea' },
    } as unknown as NotificationJob;

    await expect(
      dispatchJob(job, {
        providers: {
          ['carrier-pigeon']: {
            type: 'bird',
            adapter: { name: 'bird' },
          },
        } as unknown as Record<string, { type: string; adapter?: unknown }>,
      }),
    ).rejects.toThrow(MissingAdapterError);
  });
});
