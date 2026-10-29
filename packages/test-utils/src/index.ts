export { runAdapterContractTests, scanForCredentialLeaks } from './contract.js';
export { createMockEmailProvider, createMockSmsProvider, createMockPushProvider } from './mocks.js';
export {
  createTestRecipient,
  createTestNotificationJob,
  createMockProviderResult,
} from './fixtures.js';
export { isSafeLocalRedisUrl, getSafeLocalRedisUrl, cleanupTestRedis } from './redis.js';
export type {
  AnyProvider,
  AdapterContractOptions,
  MockEmailProvider,
  MockSmsProvider,
  MockPushProvider,
  Recipient,
  NotificationJob,
  ProviderResult,
  AdapterMetadata,
} from './types.js';

// Preserve smoke fixture
export const isTestUtils = true;
