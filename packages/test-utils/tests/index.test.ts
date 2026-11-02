import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
  isTestUtils,
  runAdapterContractTests,
  scanForCredentialLeaks,
  createMockEmailProvider,
  createMockSmsProvider,
  createMockPushProvider,
  createTestRecipient,
  createTestNotificationJob,
  createMockProviderResult,
  isSafeLocalRedisUrl,
  getSafeLocalRedisUrl,
  cleanupTestRedis,
} from '../src/index.js';
import type {
  AnyProvider,
  AdapterContractOptions,
  MockEmailProvider,
  MockSmsProvider,
  MockPushProvider,
  Recipient,
  NotificationJob,
  ProviderResult,
  AdapterMetadata,
} from '../src/index.js';

const require = createRequire(import.meta.url);

describe('test-utils module resolution and exports', () => {
  it('validates test-utils skeleton fixture and ESM exports', () => {
    expect(isTestUtils).toBe(true);
    expect(typeof runAdapterContractTests).toBe('function');
    expect(typeof scanForCredentialLeaks).toBe('function');
    expect(typeof createMockEmailProvider).toBe('function');
    expect(typeof createMockSmsProvider).toBe('function');
    expect(typeof createMockPushProvider).toBe('function');
    expect(typeof createTestRecipient).toBe('function');
    expect(typeof createTestNotificationJob).toBe('function');
    expect(typeof createMockProviderResult).toBe('function');
    expect(typeof isSafeLocalRedisUrl).toBe('function');
    expect(typeof getSafeLocalRedisUrl).toBe('function');
    expect(typeof cleanupTestRedis).toBe('function');
  });

  it('validates TypeScript declaration types are structurally usable', () => {
    const mockEmail: MockEmailProvider = createMockEmailProvider();
    const mockSms: MockSmsProvider = createMockSmsProvider();
    const mockPush: MockPushProvider = createMockPushProvider();
    const anyEmail: AnyProvider = mockEmail;
    const anySms: AnyProvider = mockSms;
    const anyPush: AnyProvider = mockPush;
    const recipient: Recipient = createTestRecipient('email');
    const job: NotificationJob = createTestNotificationJob('email');
    const result: ProviderResult = createMockProviderResult();
    const metadata: AdapterMetadata = {
      name: 'test',
      channel: 'email',
      version: '1.0.0',
    };
    const contractOpts: AdapterContractOptions = {
      providerName: 'test',
      channel: 'email',
      metadata,
    };

    expect(mockEmail.name).toBe('mock-email');
    expect(anyEmail).toBeDefined();
    expect(anySms).toBeDefined();
    expect(anyPush).toBeDefined();
    expect(recipient.email).toBe('user@example.com');
    expect(job.channel).toBe('email');
    expect(result.success).toBe(true);
    expect(contractOpts.channel).toBe('email');
  });

  it('validates CommonJS require() resolution and execution', () => {
    const cjs = require('../dist/index.cjs');

    expect(cjs.isTestUtils).toBe(true);
    expect(typeof cjs.runAdapterContractTests).toBe('function');
    expect(typeof cjs.scanForCredentialLeaks).toBe('function');
    expect(typeof cjs.createMockEmailProvider).toBe('function');
    expect(typeof cjs.createMockSmsProvider).toBe('function');
    expect(typeof cjs.createMockPushProvider).toBe('function');
    expect(typeof cjs.createTestRecipient).toBe('function');
    expect(typeof cjs.createTestNotificationJob).toBe('function');
    expect(typeof cjs.createMockProviderResult).toBe('function');
    expect(typeof cjs.isSafeLocalRedisUrl).toBe('function');
    expect(typeof cjs.getSafeLocalRedisUrl).toBe('function');
    expect(typeof cjs.cleanupTestRedis).toBe('function');

    // Functional execution test under CommonJS
    const mockEmail = cjs.createMockEmailProvider({ name: 'custom-cjs-email' });
    expect(mockEmail.name).toBe('custom-cjs-email');

    const recipient = cjs.createTestRecipient('sms', { phone: '+1234567890' });
    expect(recipient.phone).toBe('+1234567890');

    expect(cjs.isSafeLocalRedisUrl('redis://127.0.0.1:6379')).toBe(true);
    expect(cjs.isSafeLocalRedisUrl('redis://remote-db.com:6379')).toBe(false);
  });

  it('validates package.json exports mapping contains import and require conditions', () => {
    const pkg = require('../package.json');

    expect(pkg.main).toBe('./dist/index.cjs');
    expect(pkg.module).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
    expect(pkg.exports['.'].import).toBe('./dist/index.js');
    expect(pkg.exports['.'].require).toBe('./dist/index.cjs');
  });
});
