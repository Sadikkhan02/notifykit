import type { Recipient, ProviderResult } from 'notifykit/interfaces';
import type { NotificationJob } from 'notifykit';

/**
 * Creates a deterministic recipient fixture tailored for the specified notification channel.
 */
export function createTestRecipient(
  channel: 'email' | 'sms' | 'push',
  overrides: Partial<Recipient> = {},
): Recipient {
  if (channel === 'email') {
    return {
      email: 'user@example.com',
      ...overrides,
    };
  }

  if (channel === 'sms') {
    return {
      phone: '+15551234567',
      ...overrides,
    };
  }

  return {
    pushToken: 'fcm-device-registration-token-001',
    ...overrides,
  };
}

/**
 * Creates a deterministic NotificationJob payload suitable for orchestrator and queue testing.
 */
export function createTestNotificationJob(
  channel: 'email' | 'sms' | 'push' = 'email',
  overrides: Partial<NotificationJob> = {},
): NotificationJob {
  const recipient = overrides.to ?? createTestRecipient(channel);

  return {
    id: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
    channel,
    provider: `mock-${channel}`,
    to: recipient,
    templateId: 'test-template',
    renderedBody: '<p>Test notification body</p>',
    variables: { name: 'Test User' },
    metadata: {
      enqueuedAt: 1700000000000,
      traceId: '0192a4b8-82df-76a0-80a5-f7163c46e3ea',
    },
    ...overrides,
  };
}

/**
 * Creates a standard ProviderResult fixture with sensible defaults.
 */
export function createMockProviderResult(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    success: true,
    messageId: 'mock-msg-001',
    ...overrides,
  };
}
