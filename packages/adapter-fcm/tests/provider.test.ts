import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AdapterMetadata } from 'notifykit/interfaces';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as adapterExports from '../src/index.js';
import {
  FcmPushProvider,
  metadata,
  mapFcmError,
  sanitizeErrorMessage,
  type MessagingLike,
  type FcmMessagePayload,
  type AppLike,
} from '../src/index.js';

const mockGlobalSend = vi.fn().mockResolvedValue('msg-global-123');
const mockGlobalMessaging: MessagingLike = { send: mockGlobalSend };

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'notifykit-fcm' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: 'notifykit-fcm' })),
  cert: vi.fn((val: unknown) => val),
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => mockGlobalMessaging),
}));

describe('FCM Push Adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    vi.mocked(getApps).mockReturnValue([]);
    vi.mocked(getMessaging).mockReturnValue(
      mockGlobalMessaging as unknown as import('firebase-admin/messaging').Messaging,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('metadata & contract conformance', () => {
    it('exports all expected symbols from package index', () => {
      expect(adapterExports.FcmPushProvider).toBeDefined();
      expect(adapterExports.metadata).toBeDefined();
      expect(adapterExports.mapFcmError).toBeDefined();
      expect(adapterExports.sanitizeErrorMessage).toBeDefined();
    });

    it('exports metadata satisfying the core AdapterMetadata contract', () => {
      const coreMetadata: AdapterMetadata = metadata;
      expect(coreMetadata.name).toBe('fcm');
      expect(coreMetadata.channel).toBe('push');
      expect(coreMetadata.requiredEnv).toEqual(['FCM_SERVICE_ACCOUNT_JSON']);
      expect(metadata.version).toBe('0.0.1');
      expect(metadata.peerDependencies).toEqual({
        notifykit: '>=0.0.1',
        'firebase-admin': '>=11.0.0',
      });
    });

    it('instantiates FcmPushProvider with name "fcm"', () => {
      const provider = new FcmPushProvider();
      expect(provider.name).toBe('fcm');
    });
  });

  describe('delivery success & payload mapping', () => {
    it('successfully sends a push notification and maps message ID', async () => {
      let capturedPayload: FcmMessagePayload | undefined;
      const mockMessaging: MessagingLike = {
        send: vi.fn().mockImplementation(async (payload: FcmMessagePayload) => {
          capturedPayload = payload;
          return 'projects/test-proj/messages/msg-abc-123';
        }),
      };

      const provider = new FcmPushProvider({ messaging: mockMessaging });

      const result = await provider.sendPush({
        token: 'fcm_device_token_xyz',
        title: 'New Notification',
        body: 'You have a message waiting',
        data: {
          key1: 'val1',
          key2: 'val2',
        },
      });

      expect(result).toEqual({
        success: true,
        messageId: 'projects/test-proj/messages/msg-abc-123',
      });

      expect(capturedPayload).toEqual({
        token: 'fcm_device_token_xyz',
        notification: {
          title: 'New Notification',
          body: 'You have a message waiting',
        },
        data: {
          key1: 'val1',
          key2: 'val2',
        },
      });
    });

    it('handles push notification without optional data payload', async () => {
      let capturedPayload: FcmMessagePayload | undefined;
      const mockMessaging: MessagingLike = {
        send: vi.fn().mockImplementation(async (payload: FcmMessagePayload) => {
          capturedPayload = payload;
          return 'projects/test-proj/messages/msg-no-data';
        }),
      };

      const provider = new FcmPushProvider({ messaging: mockMessaging });

      const result = await provider.sendPush({
        token: 'fcm_device_token_xyz',
        title: 'Simple Alert',
        body: 'Alert body text',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('projects/test-proj/messages/msg-no-data');
      expect(capturedPayload?.data).toBeUndefined();
    });

    it('stringifies data values if numbers or booleans are passed', async () => {
      let capturedPayload: FcmMessagePayload | undefined;
      const mockMessaging: MessagingLike = {
        send: vi.fn().mockImplementation(async (payload: FcmMessagePayload) => {
          capturedPayload = payload;
          return 'msg-stringified';
        }),
      };

      const provider = new FcmPushProvider({ messaging: mockMessaging });

      await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
        data: {
          count: '42',
          active: 'true',
        },
      });

      expect(capturedPayload?.data).toEqual({
        count: '42',
        active: 'true',
      });
    });
  });

  describe('token validation', () => {
    it('returns non-retryable error when token is empty or whitespace', async () => {
      const provider = new FcmPushProvider();

      const resEmpty = await provider.sendPush({
        token: '',
        title: 'Title',
        body: 'Body',
      });
      expect(resEmpty).toEqual({
        success: false,
        error: 'Recipient push token is required',
        retryable: false,
      });

      const resWhitespace = await provider.sendPush({
        token: '   ',
        title: 'Title',
        body: 'Body',
      });
      expect(resWhitespace.retryable).toBe(false);
    });
  });

  describe('credential resolution & app lifecycle', () => {
    it('returns non-retryable error when credentials are not configured', async () => {
      const provider = new FcmPushProvider();

      const result = await provider.sendPush({
        token: 'valid_token_123',
        title: 'Title',
        body: 'Body',
      });

      expect(result).toEqual({
        success: false,
        error:
          'FCM credentials not configured. Set FCM_SERVICE_ACCOUNT_JSON in environment or pass serviceAccount in config.',
        retryable: false,
      });
    });

    it('supports injected custom app instance without messaging client', async () => {
      const mockApp: AppLike = { name: 'custom-injected-app' };
      const provider = new FcmPushProvider({
        app: mockApp as unknown as import('firebase-admin/app').App,
      });

      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-global-123');
      expect(getMessaging).toHaveBeenCalledWith(mockApp);
    });

    it('reuses existing notifykit-fcm app instance when already created', async () => {
      const existing = { name: 'notifykit-fcm' };
      vi.mocked(getApps).mockReturnValueOnce([
        existing,
      ] as unknown as import('firebase-admin/app').App[]);

      const provider = new FcmPushProvider();
      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(getMessaging).toHaveBeenCalledWith(existing);
    });

    it('resolves service account object from config.serviceAccount and initializes app', async () => {
      const provider = new FcmPushProvider({
        serviceAccount: {
          projectId: 'test-project',
          clientEmail: 'service@test-project.iam.gserviceaccount.com',
          privateKey: 'dummy-key',
        },
      });

      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-global-123');
      expect(initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: undefined }),
        'notifykit-fcm',
      );
    });

    it('resolves raw JSON string from FCM_SERVICE_ACCOUNT_JSON', async () => {
      process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({
        projectId: 'env-project',
        clientEmail: 'env@env-project.iam.gserviceaccount.com',
        privateKey: 'dummy-env-key',
      });

      const provider = new FcmPushProvider();
      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-global-123');
    });

    it('handles malformed service account JSON string gracefully', async () => {
      process.env.FCM_SERVICE_ACCOUNT_JSON = '{ invalid json string';

      const provider = new FcmPushProvider();
      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(false);
      expect(res.retryable).toBe(false);
    });

    it('resolves credentials from file path and reads JSON', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json';
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(
        JSON.stringify({
          projectId: 'file-project',
          clientEmail: 'file@project.iam.gserviceaccount.com',
          privateKey: 'file-key',
        }),
      );

      const provider = new FcmPushProvider();
      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-global-123');
    });

    it('falls back to path string when readFileSync throws', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json';
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      const provider = new FcmPushProvider();
      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-global-123');
    });

    it('handles initializeApp exception gracefully', async () => {
      vi.mocked(initializeApp).mockImplementationOnce(() => {
        throw new Error('Crash in initializeApp');
      });

      const provider = new FcmPushProvider({
        serviceAccount: {
          projectId: 'test-project',
          clientEmail: 'service@test-project.iam.gserviceaccount.com',
          privateKey: 'dummy-key',
        },
      });

      const res = await provider.sendPush({
        token: 'tok_1',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('FCM credentials not configured');
      expect(res.retryable).toBe(false);
    });
  });

  describe('permanent error classification (strictly non-retryable)', () => {
    it('classifies registration-token-not-registered as non-retryable', () => {
      const err = Object.assign(new Error('Requested entity was not found'), {
        code: 'messaging/registration-token-not-registered',
      });
      const res = mapFcmError(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies invalid-registration-token and invalid-recipient as non-retryable', () => {
      expect(
        mapFcmError(
          Object.assign(new Error('Invalid token'), {
            code: 'messaging/invalid-registration-token',
          }),
        ).retryable,
      ).toBe(false);

      expect(
        mapFcmError(
          Object.assign(new Error('Invalid recipient'), {
            code: 'messaging/invalid-recipient',
          }),
        ).retryable,
      ).toBe(false);
    });

    it('classifies mismatched-credential as non-retryable', () => {
      const res = mapFcmError(
        Object.assign(new Error('Mismatched sender/token'), {
          code: 'messaging/mismatched-credential',
        }),
      );
      expect(res.retryable).toBe(false);
    });

    it('classifies payload format and size errors as non-retryable', () => {
      const formatCodes = [
        'messaging/invalid-argument',
        'messaging/invalid-payload',
        'messaging/payload-size-limit-exceeded',
      ];
      for (const code of formatCodes) {
        const res = mapFcmError(Object.assign(new Error(`Payload error: ${code}`), { code }));
        expect(res.retryable).toBe(false);
      }
    });

    it('classifies authentication and credential errors as non-retryable', () => {
      const authCodes = [
        'messaging/authentication-error',
        'messaging/third-party-auth-error',
        'messaging/project-not-found',
        'app/invalid-credential',
      ];
      for (const code of authCodes) {
        const res = mapFcmError(Object.assign(new Error(`Auth error: ${code}`), { code }));
        expect(res.retryable).toBe(false);
      }
    });

    it('classifies HTTP 400, 401, 403, 404, 422 as non-retryable', () => {
      for (const status of [400, 401, 403, 404, 422]) {
        expect(
          mapFcmError(Object.assign(new Error(`HTTP ${status} client error`), { status }))
            .retryable,
        ).toBe(false);
      }
    });

    it('extracts nested error code from errorInfo object', () => {
      const err = Object.assign(new Error('Firebase wrapper error'), {
        errorInfo: {
          code: 'messaging/registration-token-not-registered',
          message: 'The token has unregistered',
        },
      });
      const res = mapFcmError(err);
      expect(res.retryable).toBe(false);
    });
  });

  describe('rate limits & quota (retryable: true)', () => {
    it('classifies messaging/quota-exceeded as retryable with retryAfterMs = 5000', () => {
      const err = Object.assign(new Error('Exceeded message rate limit'), {
        code: 'messaging/quota-exceeded',
      });
      const res = mapFcmError(err);
      expect(res.retryable).toBe(true);
      expect(res.retryAfterMs).toBe(5000);
    });

    it('classifies HTTP 429 and code 20429 as retryable with retryAfterMs = 1000', () => {
      const http429 = Object.assign(new Error('Too Many Requests'), { status: 429 });
      const res429 = mapFcmError(http429);
      expect(res429.retryable).toBe(true);
      expect(res429.retryAfterMs).toBe(1000);

      const code429 = Object.assign(new Error('Rate limited'), { code: '20429' });
      expect(mapFcmError(code429).retryAfterMs).toBe(1000);
    });
  });

  describe('transient server errors and network errors (retryable: true)', () => {
    it('classifies messaging/internal-error, server-unavailable, unknown-error as retryable', () => {
      const transientCodes = [
        'messaging/internal-error',
        'messaging/server-unavailable',
        'messaging/unknown-error',
      ];
      for (const code of transientCodes) {
        const res = mapFcmError(Object.assign(new Error(`Server error: ${code}`), { code }));
        expect(res.retryable).toBe(true);
      }
    });

    it('classifies HTTP 500, 502, 503, 504 statuses as retryable', () => {
      expect(
        mapFcmError(Object.assign(new Error('500 Internal Server Error'), { status: 500 }))
          .retryable,
      ).toBe(true);
      expect(
        mapFcmError(Object.assign(new Error('502 Bad Gateway'), { status: 502 })).retryable,
      ).toBe(true);
      expect(
        mapFcmError(Object.assign(new Error('503 Service Unavailable'), { status: 503 })).retryable,
      ).toBe(true);
      expect(
        mapFcmError(Object.assign(new Error('504 Gateway Timeout'), { status: 504 })).retryable,
      ).toBe(true);
    });

    it('classifies network timeouts and fetch errors as retryable', () => {
      const netCodes = [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNRESET',
        'ESOCKET',
        'EAI_AGAIN',
        'UND_ERR_CONNECT_TIMEOUT',
      ];
      for (const code of netCodes) {
        expect(mapFcmError(Object.assign(new Error(`Timeout: ${code}`), { code })).retryable).toBe(
          true,
        );
      }

      expect(mapFcmError(new TypeError('fetch failed')).retryable).toBe(true);
    });

    it('defaults unknown errors to retryable: true', () => {
      expect(mapFcmError(new Error('Something unusual happened')).retryable).toBe(true);
      expect(mapFcmError('A plain string error').retryable).toBe(true);
      expect(mapFcmError(null)).toEqual({
        success: false,
        error: 'Unknown FCM push delivery error',
        retryable: true,
      });
      expect(mapFcmError(undefined).retryable).toBe(true);
      expect(mapFcmError(12345).retryable).toBe(true);
      expect(mapFcmError({}).retryable).toBe(true);
      expect(mapFcmError({ message: 'Object error' }).retryable).toBe(true);
    });

    it('extracts embedded code or status via regex fallback', () => {
      expect(
        mapFcmError(
          new Error('Error encountered messaging/registration-token-not-registered in worker'),
        ).retryable,
      ).toBe(false);
      expect(mapFcmError(new Error('Gateway HTTP 503 error')).retryable).toBe(true);
      expect(mapFcmError('messaging/quota-exceeded: rate limit').retryAfterMs).toBe(5000);
      expect(mapFcmError('HTTP 401 Unauthorized').retryable).toBe(false);
      expect(mapFcmError('HTTP 502 Bad Gateway').retryable).toBe(true);
    });

    it('handles status and statusCode string properties on Error and objects', () => {
      expect(
        mapFcmError(Object.assign(new Error('String status'), { status: '401' })).retryable,
      ).toBe(false);
      expect(
        mapFcmError(Object.assign(new Error('Numeric statusCode'), { statusCode: 500 })).retryable,
      ).toBe(true);
      expect(
        mapFcmError(Object.assign(new Error('String statusCode'), { statusCode: '503' })).retryable,
      ).toBe(true);
      expect(mapFcmError({ message: 'Obj status', status: 403 }).retryable).toBe(false);
      expect(mapFcmError({ message: 'Obj statusCode', statusCode: 502 }).retryable).toBe(true);
      expect(mapFcmError({ status: '429', message: 'Rate limited' }).retryAfterMs).toBe(1000);
      expect(mapFcmError({ statusCode: '400', message: 'Bad req' }).retryable).toBe(false);
    });

    it('handles plain objects with errorInfo and embedded codes', () => {
      expect(
        mapFcmError({
          errorInfo: { code: 'messaging/quota-exceeded' },
          message: 'Quota exceeded',
        }).retryAfterMs,
      ).toBe(5000);

      expect(
        mapFcmError({
          errorInfo: { code: 'messaging/invalid-recipient' },
          message: 'Invalid recipient',
        }).retryable,
      ).toBe(false);

      expect(
        mapFcmError({
          message: 'Embedded messaging/server-unavailable in object',
        }).retryable,
      ).toBe(true);

      expect(
        mapFcmError({
          message: 'Embedded HTTP 504 Gateway Timeout in object',
        }).retryable,
      ).toBe(true);
    });
  });

  describe('sanitization', () => {
    it('masks long device registration tokens keeping only first 6 and last 6 chars', () => {
      const longToken =
        'bk3RNwTe3H0CI2k_HHwgIpoDKCIZvvDMExUdFQ3P1really_long_device_token_sample_12345';
      const msg = `Failed to deliver to device token ${longToken}: invalid token`;
      const sanitized = sanitizeErrorMessage(msg);

      expect(sanitized).not.toContain(longToken);
      expect(sanitized).toMatch(/bk3RNw\.\.\._12345/);
    });

    it('redacts private keys and service account credential assignments', () => {
      const pemKey =
        '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5\n-----END PRIVATE KEY-----';
      const msg = `Config error: private_key=${pemKey} client_email=svc@proj.iam.gserviceaccount.com auth=secret_tok`;
      const sanitized = sanitizeErrorMessage(msg);

      expect(sanitized).toContain('[REDACTED_PRIVATE_KEY]');
      expect(sanitized).toContain('client_email=[REDACTED]');
      expect(sanitized).toContain('auth=[REDACTED]');
      expect(sanitized).not.toContain('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5');
    });

    it('redacts colon-separated sensitive credentials', () => {
      const msg = 'Error details: private_key: my_private_key_123, token: secret_bearer_token';
      const sanitized = sanitizeErrorMessage(msg);

      expect(sanitized).toBe('Error details: private_key: [REDACTED], token: [REDACTED]');
    });

    it('sanitizes error messages through sendPush and mapFcmError', async () => {
      const mockMessaging: MessagingLike = {
        send: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'Delivery failed for token eX1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t: privateKey=secretKey123',
            ),
          ),
      };

      const provider = new FcmPushProvider({ messaging: mockMessaging });
      const res = await provider.sendPush({
        token: 'eX1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t',
        title: 'Title',
        body: 'Body',
      });

      expect(res.error).not.toContain('secretKey123');
      expect(res.error).not.toContain('eX1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t');
      expect(res.error).toContain('privateKey=[REDACTED]');
      expect(res.error).toContain('eX1a2b...8r9s0t');
    });
  });
});
