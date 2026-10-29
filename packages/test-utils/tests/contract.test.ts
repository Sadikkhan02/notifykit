import { describe, it, expect } from 'vitest';
import type { AdapterMetadata } from 'notifykit/interfaces';
import {
  runAdapterContractTests,
  scanForCredentialLeaks,
  createMockEmailProvider,
} from '../src/index.js';

describe('scanForCredentialLeaks', () => {
  it('returns hasLeak = false for clean text', () => {
    expect(scanForCredentialLeaks('Connection timeout occurred', 'my-secret')).toEqual({
      hasLeak: false,
    });
    expect(scanForCredentialLeaks('')).toEqual({ hasLeak: false });
  });

  it('detects explicit known raw secret', () => {
    const res = scanForCredentialLeaks('Failed with key: super-secret-12345', 'super-secret-12345');
    expect(res.hasLeak).toBe(true);
    expect(res.reason).toContain('super-secret-12345');
  });

  it('detects unmasked Bearer token', () => {
    const res = scanForCredentialLeaks('Request failed: Bearer eyJhbGciOiJIUzI1NiJ9.test');
    expect(res.hasLeak).toBe(true);
    expect(res.reason).toContain('Bearer');
  });

  it('detects private key headers', () => {
    const res = scanForCredentialLeaks('Error parsing: -----BEGIN RSA PRIVATE KEY-----');
    expect(res.hasLeak).toBe(true);
    expect(res.reason).toContain('private key');
  });

  it('detects unmasked credential assignments', () => {
    const res = scanForCredentialLeaks('URL error at authkey=abcdef1234567890');
    expect(res.hasLeak).toBe(true);
    expect(res.reason).toContain('credential assignment');
  });
});

// Self-test: runAdapterContractTests using mock email provider
const mockMetadata: AdapterMetadata = {
  name: 'mock-contract-email',
  channel: 'email',
  requiredEnv: ['MOCK_SMTP_HOST'],
};

runAdapterContractTests({
  providerName: 'mock-contract-email',
  channel: 'email',
  metadata: mockMetadata,
  createSuccessProvider: () => {
    const provider = createMockEmailProvider({ name: 'mock-contract-email' });
    provider.setResult({ success: true, messageId: 'self-test-msg-001' });
    return provider;
  },
  createAuthFailingProvider: () => {
    const provider = createMockEmailProvider({ name: 'mock-contract-email' });
    provider.setResult({
      success: false,
      error: 'Authentication failed (401)',
      retryable: false,
    });
    return provider;
  },
  createNetworkFailingProvider: () => {
    const provider = createMockEmailProvider({ name: 'mock-contract-email' });
    provider.setResult({
      success: false,
      error: 'Connection timeout (ECONNRESET)',
      retryable: true,
    });
    return provider;
  },
  createInvalidInputProvider: () => {
    const provider = createMockEmailProvider({ name: 'mock-contract-email' });
    provider.setResult({
      success: false,
      error: 'Invalid recipient: email address required',
      retryable: false,
    });
    return provider;
  },
  validOptions: {
    to: 'user@example.com',
    from: 'app@example.com',
    subject: 'Contract Self Test',
    html: '<p>Contract self test body</p>',
  },
  invalidOptions: {
    to: '',
    from: '',
    subject: '',
    html: '',
  },
  sampleSecret: 'sample-raw-secret-to-mask',
});
