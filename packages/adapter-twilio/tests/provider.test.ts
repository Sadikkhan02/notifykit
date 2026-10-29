import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AdapterMetadata } from 'notifykit/interfaces';
import * as adapterExports from '../src/index.js';
import {
  TwilioSmsProvider,
  metadata,
  mapTwilioError,
  sanitizeErrorMessage,
  type TwilioClientLike,
  type TwilioMessageCreateParams,
  type TwilioMessageInstance,
} from '../src/index.js';

describe('Twilio SMS Adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('metadata & contract conformance', () => {
    it('exports all expected symbols from package index', () => {
      expect(adapterExports.TwilioSmsProvider).toBeDefined();
      expect(adapterExports.metadata).toBeDefined();
      expect(adapterExports.mapTwilioError).toBeDefined();
      expect(adapterExports.sanitizeErrorMessage).toBeDefined();
    });

    it('exports metadata satisfying the core AdapterMetadata contract', () => {
      const coreMetadata: AdapterMetadata = metadata;
      expect(coreMetadata.name).toBe('twilio');
      expect(coreMetadata.channel).toBe('sms');
      expect(coreMetadata.requiredEnv).toEqual(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']);
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.peerDependencies).toEqual({
        notifykit: '^1.0.0',
        twilio: '>=4.0.0',
      });
    });

    it('instantiates TwilioSmsProvider with name "twilio"', () => {
      const provider = new TwilioSmsProvider();
      expect(provider.name).toBe('twilio');
    });
  });

  describe('delivery success', () => {
    it('successfully sends an SMS and returns messageId', async () => {
      const createMock = vi.fn().mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'queued',
      } as TwilioMessageInstance);

      const mockClient: TwilioClientLike = {
        messages: { create: createMock },
      };

      const provider = new TwilioSmsProvider({
        client: mockClient,
        from: '+14155552671',
      });

      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'Hello from NotifyKit',
      });

      expect(result).toEqual({
        success: true,
        messageId: 'SM1234567890abcdef',
      });

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith({
        to: '+14155550000',
        from: '+14155552671',
        body: 'Hello from NotifyKit',
      });
    });

    it('returns failure when Twilio response lacks a message SID', async () => {
      const createMock = vi.fn().mockResolvedValue({
        sid: '',
        status: 'failed',
      } as TwilioMessageInstance);

      const mockClient: TwilioClientLike = {
        messages: { create: createMock },
      };

      const provider = new TwilioSmsProvider({ client: mockClient });

      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'Missing SID response',
      });

      expect(result).toEqual({
        success: false,
        error: 'Twilio response missing message SID',
        retryable: false,
      });
    });
  });

  describe('sender resolution & Messaging Service SID', () => {
    it('uses opts.from with highest precedence over config and env', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_OPTS_FROM' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      process.env.TWILIO_PHONE_NUMBER = '+14155550003';
      const provider = new TwilioSmsProvider({
        client: mockClient,
        from: '+14155550002',
      });

      await provider.sendSms({
        to: '+14155550000',
        from: '+14155550001',
        body: 'Precedence test',
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+14155550001',
          to: '+14155550000',
        }),
      );
    });

    it('uses config.from when opts.from is omitted', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_CONFIG_FROM' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      process.env.TWILIO_PHONE_NUMBER = '+14155550003';
      const provider = new TwilioSmsProvider({
        client: mockClient,
        from: '+14155550002',
      });

      await provider.sendSms({
        to: '+14155550000',
        body: 'Config precedence test',
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+14155550002',
        }),
      );
    });

    it('uses process.env.TWILIO_PHONE_NUMBER when opts and config are omitted', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_ENV_PHONE' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      process.env.TWILIO_PHONE_NUMBER = '+14155550003';
      const provider = new TwilioSmsProvider({ client: mockClient });

      await provider.sendSms({
        to: '+14155550000',
        body: 'Env phone test',
      });

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+14155550003',
        }),
      );
    });

    it('uses process.env.TWILIO_MESSAGING_SERVICE_SID when phone number is omitted', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_ENV_MG' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG99999999999999999999999999999999';
      const provider = new TwilioSmsProvider({ client: mockClient });

      await provider.sendSms({
        to: '+14155550000',
        body: 'Env MG test',
      });

      expect(createMock).toHaveBeenCalledWith({
        to: '+14155550000',
        messagingServiceSid: 'MG99999999999999999999999999999999',
        body: 'Env MG test',
      });
    });

    it('maps sender starting with "MG" to messagingServiceSid and does not pass from', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_MG_PARAM' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      const provider = new TwilioSmsProvider({
        client: mockClient,
        from: 'MG11111111111111111111111111111111',
      });

      await provider.sendSms({
        to: '+14155550000',
        body: 'MG param test',
      });

      const passedParams = createMock.mock.calls[0]?.[0] as TwilioMessageCreateParams;
      expect(passedParams.messagingServiceSid).toBe('MG11111111111111111111111111111111');
      expect(passedParams.from).toBeUndefined();
    });

    it('omits sender fields when no sender is configured anywhere', async () => {
      const createMock = vi.fn().mockResolvedValue({ sid: 'SM_NO_SENDER' });
      const mockClient: TwilioClientLike = { messages: { create: createMock } };

      const provider = new TwilioSmsProvider({ client: mockClient });

      await provider.sendSms({
        to: '+14155550000',
        body: 'No sender test',
      });

      const passedParams = createMock.mock.calls[0]?.[0] as TwilioMessageCreateParams;
      expect(passedParams.from).toBeUndefined();
      expect(passedParams.messagingServiceSid).toBeUndefined();
    });
  });

  describe('credentials & client initialization', () => {
    it('returns non-retryable error when credentials are not configured', async () => {
      const provider = new TwilioSmsProvider();

      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'No credentials test',
      });

      expect(result).toEqual({
        success: false,
        error:
          'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment or pass in config.',
        retryable: false,
      });
    });

    it('initializes real twilio client when credentials are provided in env', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACtestaccountsid00000000000000000';
      process.env.TWILIO_AUTH_TOKEN = 'testauthtoken0000000000000000000';

      const provider = new TwilioSmsProvider({
        from: '+14155552671',
      });

      // Will invoke Twilio client's messages.create, which will fail with network or auth error in tests
      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'Env init test',
      });

      // Must fail safely without crashing, returning a standardized ProviderResult
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(typeof result.retryable).toBe('boolean');
    });

    it('initializes real twilio client when credentials are provided in config', async () => {
      const provider = new TwilioSmsProvider({
        accountSid: 'ACtestaccountsid00000000000000000',
        authToken: 'testauthtoken0000000000000000000',
        from: '+14155552671',
      });

      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'Config init test',
      });

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });
  });

  describe('rate limits (20429 & HTTP 429)', () => {
    it('classifies code 20429 as retryable with retryAfterMs = 1000', async () => {
      const error = Object.assign(new Error('Too Many Requests'), {
        code: 20429,
        status: 429,
      });

      const createMock = vi.fn().mockRejectedValue(error);
      const provider = new TwilioSmsProvider({
        client: { messages: { create: createMock } },
      });

      const result = await provider.sendSms({
        to: '+14155550000',
        body: 'Rate limit test',
      });

      expect(result).toEqual({
        success: false,
        error: 'Too Many Requests',
        retryable: true,
        retryAfterMs: 1000,
      });
    });

    it('classifies HTTP 429 status as retryable with retryAfterMs = 1000', () => {
      const error = Object.assign(new Error('HTTP 429 Too Many Requests'), {
        status: 429,
      });

      const result = mapTwilioError(error);
      expect(result.retryable).toBe(true);
      expect(result.retryAfterMs).toBe(1000);
    });
  });

  describe('permanent failures (retryable: false)', () => {
    it('classifies auth error 20003 and HTTP 401 as non-retryable', () => {
      const err20003 = Object.assign(new Error('Authentication Error - invalid auth token'), {
        code: 20003,
        status: 401,
      });
      expect(mapTwilioError(err20003)).toEqual({
        success: false,
        error: 'Authentication Error - invalid auth token',
        retryable: false,
      });

      const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
      expect(mapTwilioError(err401).retryable).toBe(false);
    });

    it('classifies account inactive code 20005 as non-retryable', () => {
      const err = Object.assign(new Error('Account not active'), { code: 20005 });
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies invalid recipient code 21211 as non-retryable', () => {
      const err = Object.assign(new Error('Invalid To Phone Number'), { code: 21211, status: 400 });
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies landline code 21614 as non-retryable', () => {
      const err = Object.assign(new Error('To number is not a valid mobile number'), {
        code: 21614,
        status: 400,
      });
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies unsubscribed recipient code 21610 as non-retryable', () => {
      const err = Object.assign(new Error('Attempt to send to unsubscribed recipient'), {
        code: 21610,
        status: 400,
      });
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies unverified trial recipient code 21608 as non-retryable', () => {
      const err = Object.assign(
        new Error(
          'The number is unverified. Trial accounts cannot send messages to unverified numbers',
        ),
        { code: 21608, status: 400 },
      );
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies region permission code 21408 as non-retryable', () => {
      const err = Object.assign(
        new Error('Permission to send an SMS has not been enabled for region'),
        { code: 21408 },
      );
      expect(mapTwilioError(err).retryable).toBe(false);
    });

    it('classifies sender errors 21212, 21606, 21603 as non-retryable', () => {
      expect(
        mapTwilioError(Object.assign(new Error('Invalid From Number'), { code: 21212 })).retryable,
      ).toBe(false);
      expect(
        mapTwilioError(Object.assign(new Error('From is not SMS capable'), { code: 21606 }))
          .retryable,
      ).toBe(false);
      expect(
        mapTwilioError(
          Object.assign(new Error('From or MessagingServiceSid required'), { code: 21603 }),
        ).retryable,
      ).toBe(false);
    });

    it('classifies message policy errors 21617 and 21619 as non-retryable', () => {
      expect(
        mapTwilioError(Object.assign(new Error('Message exceeds max length'), { code: 21617 }))
          .retryable,
      ).toBe(false);
      expect(
        mapTwilioError(Object.assign(new Error('Text body not allowed'), { code: 21619 }))
          .retryable,
      ).toBe(false);
    });

    it('classifies HTTP 400, 403, 404, 422 statuses as non-retryable', () => {
      expect(
        mapTwilioError(Object.assign(new Error('Bad request'), { status: 400 })).retryable,
      ).toBe(false);
      expect(mapTwilioError(Object.assign(new Error('Forbidden'), { status: 403 })).retryable).toBe(
        false,
      );
      expect(mapTwilioError(Object.assign(new Error('Not found'), { status: 404 })).retryable).toBe(
        false,
      );
      expect(
        mapTwilioError(Object.assign(new Error('Unprocessable'), { status: 422 })).retryable,
      ).toBe(false);
    });
  });

  describe('transient failures & network errors (retryable: true)', () => {
    it('classifies Twilio server error codes 20500 and 20503 as retryable', () => {
      expect(
        mapTwilioError(Object.assign(new Error('Internal Server Error'), { code: 20500 }))
          .retryable,
      ).toBe(true);
      expect(
        mapTwilioError(Object.assign(new Error('Service Unavailable'), { code: 20503 })).retryable,
      ).toBe(true);
    });

    it('classifies HTTP 500, 502, 503, 504 statuses as retryable', () => {
      expect(
        mapTwilioError(Object.assign(new Error('500 Server Error'), { status: 500 })).retryable,
      ).toBe(true);
      expect(
        mapTwilioError(Object.assign(new Error('502 Bad Gateway'), { status: 502 })).retryable,
      ).toBe(true);
      expect(
        mapTwilioError(Object.assign(new Error('503 Service Unavailable'), { status: 503 }))
          .retryable,
      ).toBe(true);
      expect(
        mapTwilioError(Object.assign(new Error('504 Gateway Timeout'), { status: 504 })).retryable,
      ).toBe(true);
    });

    it('classifies network error codes as retryable', () => {
      const netCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'EAI_AGAIN'];
      for (const code of netCodes) {
        const err = Object.assign(new Error(`Network error ${code}`), { code });
        expect(mapTwilioError(err).retryable).toBe(true);
      }
    });

    it('falls back to retryable: true for unknown errors', () => {
      const err = new Error('Some unexpected exception from third-party client');
      expect(mapTwilioError(err)).toEqual({
        success: false,
        error: 'Some unexpected exception from third-party client',
        retryable: true,
      });

      const strErr = 'A plain string error occurred';
      expect(mapTwilioError(strErr)).toEqual({
        success: false,
        error: 'A plain string error occurred',
        retryable: true,
      });

      const nonErrorObj = { message: 'Object error', code: 'UNKNOWN_CODE' };
      expect(mapTwilioError(nonErrorObj)).toEqual({
        success: false,
        error: 'Object error',
        retryable: true,
      });

      const nonErrorWithNumCode = { message: 'Permanent object', code: 21211, status: 400 };
      expect(mapTwilioError(nonErrorWithNumCode).retryable).toBe(false);

      const nonErrorWithStatusCode = { message: 'Transient obj', statusCode: 503 };
      expect(mapTwilioError(nonErrorWithStatusCode).retryable).toBe(true);

      const nonErrorWithStringCode = { message: 'Transient obj string code', code: '20500' };
      expect(mapTwilioError(nonErrorWithStringCode).retryable).toBe(true);

      expect(mapTwilioError(null)).toEqual({
        success: false,
        error: 'Unknown Twilio SMS delivery error',
        retryable: true,
      });
    });

    it('handles string status and statusCode properties on Error instances', () => {
      const errStringStatus = Object.assign(new Error('String status'), { status: '429' });
      expect(mapTwilioError(errStringStatus).retryable).toBe(true);

      const errStatusCodeNum = Object.assign(new Error('Numeric statusCode'), { statusCode: 500 });
      expect(mapTwilioError(errStatusCodeNum).retryable).toBe(true);

      const errStatusCodeStr = Object.assign(new Error('String statusCode'), { statusCode: '401' });
      expect(mapTwilioError(errStatusCodeStr).retryable).toBe(false);
    });

    it('parses error code and status from message text regex fallback', () => {
      const errWithRegexCode = new Error('Twilio error code 21211 occurred');
      expect(mapTwilioError(errWithRegexCode).retryable).toBe(false);

      const errWithRegexStatus = new Error('Gateway responded with HTTP 502 during call');
      expect(mapTwilioError(errWithRegexStatus).retryable).toBe(true);
    });
  });

  describe('sanitization', () => {
    it('masks E.164 recipient and sender phone numbers', () => {
      const message = 'Failed sending from +14155552671 to +14155550000: Invalid number';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Failed sending from +1415***2671 to +1415***0000: Invalid number');
      expect(sanitized).not.toContain('5552671');
      expect(sanitized).not.toContain('5550000');
    });

    it('masks international phone numbers with other country codes', () => {
      const message = 'Delivery to +919876543210 failed';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Delivery to +9198***3210 failed');
    });

    it('redacts authToken, password, and secret query or assignment values', () => {
      const message =
        'Request failed with authToken=secret_auth_token_123 and password=supersecretpass and token=tok999';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe(
        'Request failed with authToken=[REDACTED] and password=[REDACTED] and token=[REDACTED]',
      );
      expect(sanitized).not.toContain('secret_auth_token_123');
      expect(sanitized).not.toContain('supersecretpass');
      expect(sanitized).not.toContain('tok999');
    });

    it('redacts colon-separated sensitive credentials', () => {
      const message = 'Twilio error authToken: secret_123456';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Twilio error authToken: [REDACTED]');
      expect(sanitized).not.toContain('secret_123456');
    });

    it('sanitizes error messages through sendSms and mapTwilioError', async () => {
      const err = new Error(
        'Failed sending to +14155552671 with authToken=secret999: internal error',
      );
      const res = mapTwilioError(err);

      expect(res.error).toBe(
        'Failed sending to +1415***2671 with authToken=[REDACTED]: internal error',
      );
    });
  });
});
