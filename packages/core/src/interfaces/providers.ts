import type { ProviderResult } from './result';

/**
 * Contract implemented by email provider adapters (e.g., Nodemailer).
 */
export interface EmailProvider {
  /** Unique provider name identifier (e.g., 'nodemailer') */
  readonly name: string;
  /** Sends an email message */
  sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult>;
}

/**
 * Contract implemented by SMS provider adapters (e.g., Twilio, MSG91).
 */
export interface SmsProvider {
  /** Unique provider name identifier (e.g., 'twilio', 'msg91') */
  readonly name: string;
  /** Sends an SMS message */
  sendSms(opts: {
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }): Promise<ProviderResult>;
}

/**
 * Contract implemented by Push provider adapters (e.g., FCM).
 */
export interface PushProvider {
  /** Unique provider name identifier (e.g., 'fcm') */
  readonly name: string;
  /** Sends a push notification */
  sendPush(opts: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<ProviderResult>;
}
