import type {
  SmsProvider,
  EmailProvider,
  PushProvider,
  Recipient,
  NotificationEvent,
  ProviderResult,
  AdapterMetadata,
} from 'notifykit/interfaces';

export class ExternalConsumerSmsAdapter implements SmsProvider {
  readonly name = 'external-consumer-sms';

  async sendSms(opts: { to: string; from?: string; body: string }): Promise<ProviderResult> {
    return {
      success: true,
      messageId: `msg_${opts.to}`,
    };
  }
}

export const testRecipient: Recipient = {
  phone: '+14155552671',
};

export const testEvent: NotificationEvent = {
  to: testRecipient,
  channels: ['sms'],
  template: 'otp',
  data: { code: '1234' },
};

export const testMetadata: AdapterMetadata = {
  name: 'external-consumer-sms',
  channel: 'sms',
  requiredEnv: ['TEST_SMS_KEY'],
};
