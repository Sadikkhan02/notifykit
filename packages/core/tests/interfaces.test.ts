import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Recipient,
  NotificationEvent,
  ProviderResult,
  EmailProvider,
  SmsProvider,
  PushProvider,
  AdapterMetadata,
  NotifierConfig,
  ProviderConfig,
} from '../src/interfaces/index';

describe('Public Provider Interfaces contracts (src/interfaces)', () => {
  it('validates Recipient type structure', () => {
    const recipient: Recipient = {
      email: 'user@example.com',
      phone: '+14155552671',
      pushToken: 'fcm_token_123',
    };

    expectTypeOf(recipient).toMatchTypeOf<Recipient>();
    expect(recipient.email).toBe('user@example.com');
  });

  it('validates NotificationEvent type structure', () => {
    const event: NotificationEvent = {
      to: { email: 'test@example.com' },
      channels: ['email', 'sms'],
      template: 'welcome',
      data: { name: 'Alice' },
    };

    expectTypeOf(event).toMatchTypeOf<NotificationEvent>();
    expect(event.channels).toHaveLength(2);
  });

  it('validates ProviderResult contract', () => {
    const successResult: ProviderResult = {
      success: true,
      messageId: 'msg_123',
    };

    const retryableFailure: ProviderResult = {
      success: false,
      error: 'Rate limit exceeded',
      retryable: true,
      retryAfterMs: 2000,
    };

    expectTypeOf(successResult).toMatchTypeOf<ProviderResult>();
    expectTypeOf(retryableFailure).toMatchTypeOf<ProviderResult>();
    expect(retryableFailure.retryable).toBe(true);
  });

  it('validates EmailProvider contract with a mock implementation', async () => {
    class MockEmailProvider implements EmailProvider {
      readonly name = 'mock-email';

      async sendEmail(opts: {
        to: string;
        from: string;
        subject: string;
        html: string;
        text?: string;
      }): Promise<ProviderResult> {
        return {
          success: true,
          messageId: `email_${opts.to}`,
        };
      }
    }

    const provider = new MockEmailProvider();
    expectTypeOf(provider).toMatchTypeOf<EmailProvider>();

    const result = await provider.sendEmail({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('email_recipient@example.com');
  });

  it('validates SmsProvider contract with a mock implementation', async () => {
    class MockSmsProvider implements SmsProvider {
      readonly name = 'mock-sms';

      async sendSms(opts: {
        to: string;
        from?: string;
        body: string;
        templateId?: string;
        variables?: Record<string, string>;
      }): Promise<ProviderResult> {
        return {
          success: true,
          messageId: `sms_${opts.to}`,
        };
      }
    }

    const provider = new MockSmsProvider();
    expectTypeOf(provider).toMatchTypeOf<SmsProvider>();

    const result = await provider.sendSms({
      to: '+14155552671',
      body: 'Your code is 123456',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('sms_+14155552671');
  });

  it('validates PushProvider contract with a mock implementation', async () => {
    class MockPushProvider implements PushProvider {
      readonly name = 'mock-push';

      async sendPush(opts: {
        token: string;
        title: string;
        body: string;
        data?: Record<string, string>;
      }): Promise<ProviderResult> {
        return {
          success: true,
          messageId: `push_${opts.token}`,
        };
      }
    }

    const provider = new MockPushProvider();
    expectTypeOf(provider).toMatchTypeOf<PushProvider>();

    const result = await provider.sendPush({
      token: 'fcm_token_xyz',
      title: 'Alert',
      body: 'You have a new notification',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('push_fcm_token_xyz');
  });

  it('validates AdapterMetadata contract', () => {
    const metadata: AdapterMetadata = {
      name: 'twilio',
      channel: 'sms',
      requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    };

    expectTypeOf(metadata).toMatchTypeOf<AdapterMetadata>();
    expect(metadata.name).toBe('twilio');
    expect(metadata.channel).toBe('sms');
    expect(metadata.requiredEnv).toContain('TWILIO_AUTH_TOKEN');
  });

  it('validates NotifierConfig and ProviderConfig contracts', () => {
    const providerConfig: ProviderConfig = {
      type: 'twilio',
      accountSid: 'mock-twilio-account-sid',
    };

    const notifierConfig: NotifierConfig = {
      redis: 'redis://localhost:6379',
      providers: {
        sms: providerConfig,
      },
    };

    expectTypeOf(notifierConfig).toMatchTypeOf<NotifierConfig>();
    expect(notifierConfig.providers.sms?.type).toBe('twilio');
  });
});
