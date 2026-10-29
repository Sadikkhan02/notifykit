import { vi } from 'vitest';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { TwilioSmsProvider, metadata, type TwilioClientLike } from '../src/index.js';

runAdapterContractTests({
  providerName: 'twilio',
  channel: 'sms',
  metadata,
  createSuccessProvider: () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ sid: 'SM1234567890abcdef1234567890abcdef' }),
      },
    } as unknown as TwilioClientLike;
    return new TwilioSmsProvider({ client: mockClient, from: '+15551234567' });
  },
  createAuthFailingProvider: () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue({
          code: 20003,
          message: 'Authentication Error - Invalid Account SID or Auth Token',
        }),
      },
    } as unknown as TwilioClientLike;
    return new TwilioSmsProvider({ client: mockClient, from: '+15551234567' });
  },
  createNetworkFailingProvider: () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue({
          status: 503,
          message: 'Service Unavailable - Twilio API Gateway Timeout',
        }),
      },
    } as unknown as TwilioClientLike;
    return new TwilioSmsProvider({ client: mockClient, from: '+15551234567' });
  },
  createInvalidInputProvider: () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue({
          code: 21211,
          status: 400,
          message: "The 'To' number is not a valid phone number",
        }),
      },
    } as unknown as TwilioClientLike;
    return new TwilioSmsProvider({ client: mockClient, from: '+15551234567' });
  },
  validOptions: {
    to: '+15559876543',
    from: '+15551234567',
    body: 'Twilio contract test SMS body',
  },
  invalidOptions: {
    to: '',
    body: '',
  },
  sampleSecret: 'super-secret-twilio-token-xyz',
});
