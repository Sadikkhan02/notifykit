import twilio from 'twilio';
import type { SmsProvider, ProviderResult } from 'notifykit/interfaces';
import { mapTwilioError } from './error-mapper.js';
import type { TwilioConfig, TwilioClientLike, TwilioMessageCreateParams } from './types.js';

/**
 * Twilio SMS provider adapter implementing the NotifyKit SmsProvider contract.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly config: TwilioConfig;
  private clientInstance: TwilioClientLike | null = null;

  constructor(config: TwilioConfig = {}) {
    this.config = config;
    if (config.client) {
      this.clientInstance = config.client;
    }
  }

  /**
   * Lazily initializes and caches the Twilio client instance.
   * Returns null if required credentials (accountSid, authToken) are not provided.
   */
  private getClient(): TwilioClientLike | null {
    if (this.clientInstance) {
      return this.clientInstance;
    }

    const accountSid = this.config.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
    const authToken = this.config.authToken ?? process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return null;
    }

    this.clientInstance = twilio(accountSid, authToken) as unknown as TwilioClientLike;
    return this.clientInstance;
  }

  /**
   * Sends an SMS notification via Twilio.
   *
   * Sender resolution precedence:
   * 1. opts.from
   * 2. config.from
   * 3. process.env.TWILIO_PHONE_NUMBER
   * 4. process.env.TWILIO_MESSAGING_SERVICE_SID
   *
   * If the resolved sender begins with 'MG', it is passed as messagingServiceSid.
   * Otherwise, it is passed as from.
   *
   * @param opts SMS delivery options (to, body, optional from, templateId, variables)
   * @returns Standardized ProviderResult with retryability classification
   */
  async sendSms(opts: {
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }): Promise<ProviderResult> {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        error:
          'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment or pass in config.',
        retryable: false,
      };
    }

    const sender =
      opts.from ||
      this.config.from ||
      process.env.TWILIO_PHONE_NUMBER ||
      process.env.TWILIO_MESSAGING_SERVICE_SID;

    const createParams: TwilioMessageCreateParams = {
      to: opts.to,
      body: opts.body,
    };

    if (sender) {
      if (sender.startsWith('MG')) {
        createParams.messagingServiceSid = sender;
      } else {
        createParams.from = sender;
      }
    }

    try {
      const message = await client.messages.create(createParams);
      if (message && typeof message.sid === 'string' && message.sid.length > 0) {
        return {
          success: true,
          messageId: message.sid,
        };
      }

      return {
        success: false,
        error: 'Twilio response missing message SID',
        retryable: false,
      };
    } catch (err) {
      return mapTwilioError(err);
    }
  }
}
