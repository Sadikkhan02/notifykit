import type { SmsProvider, ProviderResult } from 'notifykit/interfaces';
import { mapMsg91Error } from './error-mapper.js';
import type { Msg91Config, Msg91FlowPayload, Msg91Recipient, Msg91ApiResponse } from './types.js';

/**
 * MSG91 SMS provider adapter implementing the NotifyKit SmsProvider contract
 * using native Node.js fetch against MSG91's Flow API v5.
 */
export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  private readonly config: Msg91Config;

  constructor(config: Msg91Config = {}) {
    this.config = config;
  }

  /**
   * Sends an SMS notification via MSG91 Flow API v5.
   *
   * Flow ID resolution:
   * 1. opts.templateId
   * 2. config.flowId
   * 3. process.env.MSG91_FLOW_ID
   *
   * Sender resolution:
   * 1. opts.from
   * 2. config.sender
   * 3. process.env.MSG91_SENDER_ID
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
    const authKey = this.config.authKey ?? process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      return {
        success: false,
        error:
          'MSG91 credentials not configured. Set MSG91_AUTH_KEY in environment or pass authKey in config.',
        retryable: false,
      };
    }

    const flowId = opts.templateId || this.config.flowId || process.env.MSG91_FLOW_ID;
    if (!flowId) {
      return {
        success: false,
        error:
          'MSG91 Flow ID (templateId) is required. Set MSG91_FLOW_ID in environment, configure flowId, or pass templateId.',
        retryable: false,
      };
    }

    // MSG91 expects mobile numbers with country code without leading '+'
    const normalizedMobile = opts.to.replace(/^\+/, '').trim();

    const recipient: Msg91Recipient = {
      mobiles: normalizedMobile,
      ...(opts.variables || {}),
    };

    const payload: Msg91FlowPayload = {
      template_id: flowId,
      short_url: '0',
      recipients: [recipient],
    };

    const sender = opts.from || this.config.sender || process.env.MSG91_SENDER_ID;
    if (sender) {
      payload.sender = sender;
    }

    const fetchFn = this.config.fetch ?? fetch;
    const url = this.config.baseUrl ?? 'https://control.msg91.com/api/v5/flow';

    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          authkey: authKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseData: Msg91ApiResponse | null = null;
      const text = await response.text();

      try {
        responseData = JSON.parse(text) as Msg91ApiResponse;
      } catch {
        // Fall back to text if response is not JSON
      }

      if (response.ok) {
        if (responseData && responseData.type === 'success') {
          return {
            success: true,
            messageId: typeof responseData.message === 'string' ? responseData.message : undefined,
          };
        }

        if (responseData && responseData.type === 'error') {
          return mapMsg91Error(responseData.message || responseData, response.status);
        }

        // Response was 2xx but type was neither success nor explicit error
        if (responseData && typeof responseData.message === 'string') {
          return {
            success: true,
            messageId: responseData.message,
          };
        }

        return {
          success: true,
        };
      }

      // Non-2xx HTTP status
      if (responseData) {
        return mapMsg91Error(responseData.message || responseData, response.status);
      }

      return mapMsg91Error(text || response.statusText, response.status);
    } catch (err) {
      return mapMsg91Error(err);
    }
  }
}
