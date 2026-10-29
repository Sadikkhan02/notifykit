import { vi } from 'vitest';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { FcmPushProvider, metadata, type MessagingLike } from '../src/index.js';

runAdapterContractTests({
  providerName: 'fcm',
  channel: 'push',
  metadata,
  createSuccessProvider: () => {
    const mockMessaging = {
      send: vi.fn().mockResolvedValue('projects/test-proj/messages/fcm_msg_contract_001'),
    } as unknown as MessagingLike;

    return new FcmPushProvider({ messaging: mockMessaging });
  },
  createAuthFailingProvider: () => {
    const mockMessaging = {
      send: vi.fn().mockRejectedValue({
        code: 'messaging/mismatched-credential',
        message: 'The credential used to authenticate does not match the project ID',
      }),
    } as unknown as MessagingLike;

    return new FcmPushProvider({ messaging: mockMessaging });
  },
  createNetworkFailingProvider: () => {
    const mockMessaging = {
      send: vi.fn().mockRejectedValue({
        code: 'messaging/internal-error',
        message: 'Internal server error occurred while connecting to FCM',
      }),
    } as unknown as MessagingLike;

    return new FcmPushProvider({ messaging: mockMessaging });
  },
  validOptions: {
    token: 'fcm-valid-device-token-contract-123',
    title: 'Contract Test Title',
    body: 'Contract Test Body',
    data: { link: '/contract' },
  },
  invalidOptions: {
    token: '',
    title: '',
    body: '',
  },
  sampleSecret: 'super-secret-fcm-private-key-xyz',
});
