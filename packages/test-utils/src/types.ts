import type {
  EmailProvider,
  SmsProvider,
  PushProvider,
  ProviderResult,
  AdapterMetadata,
  Recipient,
} from 'notifykit/interfaces';
import type { NotificationJob } from 'notifykit';

export type AnyProvider = EmailProvider | SmsProvider | PushProvider;

/**
 * Configuration options required to execute the universal adapter contract test suite.
 */
export interface AdapterContractOptions<TProvider extends AnyProvider = AnyProvider> {
  /**
   * Registered provider identifier (e.g. 'nodemailer', 'twilio', 'msg91', 'fcm').
   */
  providerName: string;

  /**
   * The notification channel supported by this adapter.
   */
  channel: 'email' | 'sms' | 'push';

  /**
   * The AdapterMetadata exported by the adapter package.
   */
  metadata: AdapterMetadata;

  /**
   * Factory function returning a provider instance configured to succeed.
   */
  createSuccessProvider: () => TProvider | Promise<TProvider>;

  /**
   * Factory function returning a provider instance configured to fail with an authentication error.
   */
  createAuthFailingProvider: () => TProvider | Promise<TProvider>;

  /**
   * Factory function returning a provider instance configured to fail with a transient/network error.
   */
  createNetworkFailingProvider: () => TProvider | Promise<TProvider>;

  /**
   * Optional factory function returning a provider instance configured for invalid input testing.
   * If omitted, createSuccessProvider() is used.
   */
  createInvalidInputProvider?: () => TProvider | Promise<TProvider>;

  /**
   * A valid delivery payload for this provider's channel.
   */
  validOptions: Record<string, unknown>;

  /**
   * An optional malformed or invalid delivery payload (e.g., empty recipient or missing required fields).
   */
  invalidOptions?: Record<string, unknown>;

  /**
   * A synthetic secret value used to verify that the provider never leaks secrets in error messages.
   * Defaults to 'super-secret-token-xyz-123' if omitted.
   */
  sampleSecret?: string;
}

export interface MockEmailProvider extends EmailProvider {
  readonly calls: Array<{
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }>;
  setResult(result: ProviderResult | Error): void;
  reset(): void;
}

export interface MockSmsProvider extends SmsProvider {
  readonly calls: Array<{
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }>;
  setResult(result: ProviderResult | Error): void;
  reset(): void;
}

export interface MockPushProvider extends PushProvider {
  readonly calls: Array<{
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }>;
  setResult(result: ProviderResult | Error): void;
  reset(): void;
}

export type { Recipient, NotificationJob, ProviderResult, AdapterMetadata };
