import { describe, it, expect } from 'vitest';
import type {
  EmailProvider,
  SmsProvider,
  PushProvider,
  ProviderResult,
} from 'notifykit/interfaces';
import type { AdapterContractOptions, AnyProvider } from './types.js';

/**
 * Scans a given text string for known secrets or suspicious credential patterns.
 * Returns true if a potential credential leak is detected.
 */
export function scanForCredentialLeaks(
  text: string,
  knownSecret?: string,
): { hasLeak: boolean; reason?: string } {
  if (!text || typeof text !== 'string') {
    return { hasLeak: false };
  }

  // Check 1: Explicit known secret
  if (knownSecret && knownSecret.trim().length > 0 && text.includes(knownSecret)) {
    return {
      hasLeak: true,
      reason: `Error message contains known raw secret: "${knownSecret}"`,
    };
  }

  // Check 2: Bearer token pattern
  if (/Bearer\s+[A-Za-z0-9_.-]{12,}/i.test(text)) {
    return {
      hasLeak: true,
      reason: 'Error message appears to contain an unmasked Bearer token',
    };
  }

  // Check 3: Raw private key headers
  if (/BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY/i.test(text)) {
    return {
      hasLeak: true,
      reason: 'Error message appears to contain a raw private key header',
    };
  }

  // Check 4: Explicit assignment patterns like authkey=..., password=..., secret=...
  if (/(?:password|authkey|token|secret)\s*[:=]\s*["']?[A-Za-z0-9_.-]{10,}["']?/i.test(text)) {
    return {
      hasLeak: true,
      reason: 'Error message appears to contain an unmasked credential assignment',
    };
  }

  return { hasLeak: false };
}

/**
 * Dispatches the delivery call to the provider based on its supported channel.
 */
async function dispatchSend(
  provider: AnyProvider,
  channel: 'email' | 'sms' | 'push',
  payload: Record<string, unknown>,
): Promise<ProviderResult> {
  if (channel === 'email') {
    const emailProvider = provider as EmailProvider;
    if (typeof emailProvider.sendEmail !== 'function') {
      throw new Error(`Email provider "${provider.name}" does not implement sendEmail()`);
    }
    return emailProvider.sendEmail(payload as Parameters<EmailProvider['sendEmail']>[0]);
  }

  if (channel === 'sms') {
    const smsProvider = provider as SmsProvider;
    if (typeof smsProvider.sendSms !== 'function') {
      throw new Error(`SMS provider "${provider.name}" does not implement sendSms()`);
    }
    return smsProvider.sendSms(payload as Parameters<SmsProvider['sendSms']>[0]);
  }

  if (channel === 'push') {
    const pushProvider = provider as PushProvider;
    if (typeof pushProvider.sendPush !== 'function') {
      throw new Error(`Push provider "${provider.name}" does not implement sendPush()`);
    }
    return pushProvider.sendPush(payload as Parameters<PushProvider['sendPush']>[0]);
  }

  throw new Error(`Unknown provider channel: "${channel}"`);
}

/**
 * Provides a fallback invalid delivery payload for the specified channel.
 */
function getFallbackInvalidOptions(channel: 'email' | 'sms' | 'push'): Record<string, unknown> {
  if (channel === 'email') {
    return { to: '', from: '', subject: '', html: '' };
  }
  if (channel === 'sms') {
    return { to: '', body: '' };
  }
  return { token: '', title: '', body: '' };
}

/**
 * Standardized universal contract test suite for NotifyKit adapters.
 * Validates metadata, provider naming, success shapes, message IDs,
 * error classification, malformed-input safety, and credential sanitization.
 */
export function runAdapterContractTests<TProvider extends AnyProvider>(
  options: AdapterContractOptions<TProvider>,
): void {
  const {
    providerName,
    channel,
    metadata,
    createSuccessProvider,
    createAuthFailingProvider,
    createNetworkFailingProvider,
    createInvalidInputProvider,
    validOptions,
    invalidOptions,
    sampleSecret = 'super-secret-token-xyz-123',
  } = options;

  describe(`Adapter Contract Suite: ${providerName} (${channel})`, () => {
    describe('1. Metadata & Export Conformance', () => {
      it('exports metadata satisfying the core AdapterMetadata contract', () => {
        expect(metadata).toBeDefined();
        expect(metadata.name).toBe(providerName);
        expect(metadata.channel).toBe(channel);
        expect(Array.isArray(metadata.requiredEnv)).toBe(true);
        expect(metadata.requiredEnv.length).toBeGreaterThan(0);
      });
    });

    describe('2. Provider Identity & Method Signature', () => {
      it('instantiates provider with name matching metadata', async () => {
        const provider = await createSuccessProvider();
        expect(provider).toBeDefined();
        expect(provider.name).toBe(providerName);
        expect(provider.name).toBe(metadata.name);
      });

      it('implements the canonical delivery method for its channel', async () => {
        const provider = await createSuccessProvider();
        if (channel === 'email') {
          expect(typeof (provider as EmailProvider).sendEmail).toBe('function');
        } else if (channel === 'sms') {
          expect(typeof (provider as SmsProvider).sendSms).toBe('function');
        } else if (channel === 'push') {
          expect(typeof (provider as PushProvider).sendPush).toBe('function');
        }
      });
    });

    describe('3. Successful Delivery Result', () => {
      it('returns { success: true } and a valid provider messageId', async () => {
        const provider = await createSuccessProvider();
        const result = await dispatchSend(provider, channel, validOptions);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(typeof result.messageId).toBe('string');
        expect(result.messageId?.trim().length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      });
    });

    describe('4. Permanent Failure Classification (Authentication / Credentials)', () => {
      it('classifies auth/credential errors as { success: false, retryable: false }', async () => {
        const provider = await createAuthFailingProvider();
        const result = await dispatchSend(provider, channel, validOptions);

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.retryable).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(result.error?.trim().length).toBeGreaterThan(0);
      });
    });

    describe('5. Transient Failure Classification (Network / Timeouts)', () => {
      it('classifies network/connection errors as { success: false, retryable: true }', async () => {
        const provider = await createNetworkFailingProvider();
        const result = await dispatchSend(provider, channel, validOptions);

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.retryable).toBe(true);
        expect(typeof result.error).toBe('string');
        expect(result.error?.trim().length).toBeGreaterThan(0);
      });
    });

    describe('6. Malformed Input Safety', () => {
      it('handles invalid or empty payload without throwing unhandled exceptions', async () => {
        const provider = createInvalidInputProvider
          ? await createInvalidInputProvider()
          : await createSuccessProvider();
        const badPayload = invalidOptions ?? getFallbackInvalidOptions(channel);

        let result: ProviderResult | undefined;
        try {
          result = await dispatchSend(provider, channel, badPayload);
        } catch (err) {
          throw new Error(
            `Adapter crashed on malformed input. Adapters must catch delivery errors and return ProviderResult: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.retryable).toBe(false);
      });
    });

    describe('7. Credential Sanitization & Secret Isolation', () => {
      it('never exposes raw secrets or unmasked tokens in error messages', async () => {
        const provider = await createAuthFailingProvider();
        const result = await dispatchSend(provider, channel, validOptions);

        if (result.error) {
          const leakScan = scanForCredentialLeaks(result.error, sampleSecret);
          expect(
            leakScan.hasLeak,
            `Credential leak detected in provider error message: "${result.error}". Reason: ${leakScan.reason}`,
          ).toBe(false);
        }
      });
    });
  });
}
