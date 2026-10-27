import type { NotifierConfig, ProviderConfig } from '../interfaces/config.js';
import { MissingAdapterError } from './errors.js';

export type QueueChannel = 'email' | 'sms' | 'push';

export interface ResolvedChannelAdapter {
  providerName: string;
  adapter?: unknown;
  config: ProviderConfig;
}

/**
 * Resolves each requested delivery channel against the configured providers.
 *
 * Adheres strictly to ADR-003 and existing ProviderConfig types:
 * - Operates safely on ProviderConfig's [key: string]: unknown signature.
 * - Extracts injected adapter name via adapter.name if present, otherwise falls back to config.type.
 *
 * @throws {MissingAdapterError} If a requested channel has no provider configuration.
 */
export function resolveChannelAdapters(
  channels: QueueChannel[],
  providers?: NotifierConfig['providers'],
  traceId?: string,
): Map<QueueChannel, ResolvedChannelAdapter> {
  const resolved = new Map<QueueChannel, ResolvedChannelAdapter>();

  for (const channel of channels) {
    const providerConfig = providers?.[channel];

    if (!providerConfig) {
      throw new MissingAdapterError({
        message: `No provider adapter configured for channel "${channel}".`,
        hint: `Configure a provider for "${channel}" in createNotifier({ providers: { ${channel}: ... } }) or remove "${channel}" from event channels.`,
        traceId,
      });
    }

    const configRecord = providerConfig as Record<string, unknown>;
    const injectedAdapter = configRecord.adapter as { name?: string } | undefined;
    const providerName =
      (typeof injectedAdapter?.name === 'string' && injectedAdapter.name) ||
      (typeof providerConfig.type === 'string' && providerConfig.type) ||
      'unknown';

    resolved.set(channel, {
      providerName,
      adapter: injectedAdapter,
      config: providerConfig,
    });
  }

  return resolved;
}
