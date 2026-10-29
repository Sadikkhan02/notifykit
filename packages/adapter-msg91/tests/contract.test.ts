import { vi } from 'vitest';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { Msg91SmsProvider, metadata } from '../src/index.js';

runAdapterContractTests({
  providerName: 'msg91',
  channel: 'sms',
  metadata,
  createSuccessProvider: () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ type: 'success', message: 'msg91-req-id-contract-001' }),
    } as unknown as Response);

    return new Msg91SmsProvider({
      authKey: 'test-msg91-auth-key',
      flowId: 'test-flow-id',
      fetch: mockFetch,
    });
  },
  createAuthFailingProvider: () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ type: 'error', code: 106, message: 'Invalid authkey' }),
    } as unknown as Response);

    return new Msg91SmsProvider({
      authKey: 'test-msg91-auth-key',
      flowId: 'test-flow-id',
      fetch: mockFetch,
    });
  },
  createNetworkFailingProvider: () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed: ECONNRESET'));

    return new Msg91SmsProvider({
      authKey: 'test-msg91-auth-key',
      flowId: 'test-flow-id',
      fetch: mockFetch,
    });
  },
  createInvalidInputProvider: () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ type: 'error', code: 101, message: 'Missing mobile number' }),
    } as unknown as Response);

    return new Msg91SmsProvider({
      authKey: 'test-msg91-auth-key',
      flowId: 'test-flow-id',
      fetch: mockFetch,
    });
  },
  validOptions: {
    to: '+919876543210',
    body: 'Contract test MSG91 body',
    variables: { otp: '4321' },
  },
  invalidOptions: {
    to: '',
    body: '',
  },
  sampleSecret: 'super-secret-msg91-authkey-xyz',
});
