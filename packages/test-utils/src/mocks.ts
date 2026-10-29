import type { ProviderResult } from 'notifykit/interfaces';
import type { MockEmailProvider, MockSmsProvider, MockPushProvider } from './types.js';

/**
 * Creates an in-memory mock email provider that records calls and returns configurable results.
 */
export function createMockEmailProvider(
  options: {
    name?: string;
    defaultResult?: ProviderResult | Error;
  } = {},
): MockEmailProvider {
  const name = options.name ?? 'mock-email';
  let currentResult: ProviderResult | Error = options.defaultResult ?? {
    success: true,
    messageId: 'mock-email-msg-001',
  };
  const calls: Array<{
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }> = [];

  return {
    name,
    get calls() {
      return [...calls];
    },
    setResult(result: ProviderResult | Error) {
      currentResult = result;
    },
    reset() {
      calls.length = 0;
      currentResult = options.defaultResult ?? {
        success: true,
        messageId: 'mock-email-msg-001',
      };
    },
    async sendEmail(opts) {
      calls.push({ ...opts });
      if (currentResult instanceof Error) {
        throw currentResult;
      }
      return currentResult;
    },
  };
}

/**
 * Creates an in-memory mock SMS provider that records calls and returns configurable results.
 */
export function createMockSmsProvider(
  options: {
    name?: string;
    defaultResult?: ProviderResult | Error;
  } = {},
): MockSmsProvider {
  const name = options.name ?? 'mock-sms';
  let currentResult: ProviderResult | Error = options.defaultResult ?? {
    success: true,
    messageId: 'mock-sms-msg-001',
  };
  const calls: Array<{
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }> = [];

  return {
    name,
    get calls() {
      return [...calls];
    },
    setResult(result: ProviderResult | Error) {
      currentResult = result;
    },
    reset() {
      calls.length = 0;
      currentResult = options.defaultResult ?? {
        success: true,
        messageId: 'mock-sms-msg-001',
      };
    },
    async sendSms(opts) {
      calls.push({
        to: opts.to,
        from: opts.from,
        body: opts.body,
        templateId: opts.templateId,
        variables: opts.variables ? { ...opts.variables } : undefined,
      });
      if (currentResult instanceof Error) {
        throw currentResult;
      }
      return currentResult;
    },
  };
}

/**
 * Creates an in-memory mock push provider that records calls and returns configurable results.
 */
export function createMockPushProvider(
  options: {
    name?: string;
    defaultResult?: ProviderResult | Error;
  } = {},
): MockPushProvider {
  const name = options.name ?? 'mock-push';
  let currentResult: ProviderResult | Error = options.defaultResult ?? {
    success: true,
    messageId: 'mock-push-msg-001',
  };
  const calls: Array<{
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }> = [];

  return {
    name,
    get calls() {
      return [...calls];
    },
    setResult(result: ProviderResult | Error) {
      currentResult = result;
    },
    reset() {
      calls.length = 0;
      currentResult = options.defaultResult ?? {
        success: true,
        messageId: 'mock-push-msg-001',
      };
    },
    async sendPush(opts) {
      calls.push({
        token: opts.token,
        title: opts.title,
        body: opts.body,
        data: opts.data ? { ...opts.data } : undefined,
      });
      if (currentResult instanceof Error) {
        throw currentResult;
      }
      return currentResult;
    },
  };
}
