import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AdapterMetadata } from 'notifykit/interfaces';
import * as adapterExports from '../src/index.js';
import {
  Msg91SmsProvider,
  metadata,
  mapMsg91Error,
  sanitizeErrorMessage,
  type Msg91FlowPayload,
} from '../src/index.js';

describe('MSG91 SMS Adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_FLOW_ID;
    delete process.env.MSG91_SENDER_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('metadata & contract conformance', () => {
    it('exports all expected symbols from package index', () => {
      expect(adapterExports.Msg91SmsProvider).toBeDefined();
      expect(adapterExports.metadata).toBeDefined();
      expect(adapterExports.mapMsg91Error).toBeDefined();
      expect(adapterExports.sanitizeErrorMessage).toBeDefined();
    });

    it('exports metadata satisfying the core AdapterMetadata contract', () => {
      const coreMetadata: AdapterMetadata = metadata;
      expect(coreMetadata.name).toBe('msg91');
      expect(coreMetadata.channel).toBe('sms');
      expect(coreMetadata.requiredEnv).toEqual(['MSG91_AUTH_KEY', 'MSG91_FLOW_ID']);
      expect(metadata.version).toBe('0.0.1');
      expect(metadata.peerDependencies).toEqual({
        notifykit: '>=0.0.1',
      });
    });

    it('instantiates Msg91SmsProvider with name "msg91"', () => {
      const provider = new Msg91SmsProvider();
      expect(provider.name).toBe('msg91');
    });
  });

  describe('delivery success & payload construction', () => {
    it('successfully sends an SMS and maps request ID to messageId', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-msg91-abc12345' }),
        } as unknown as Response;
      });

      const provider = new Msg91SmsProvider({
        authKey: 'test_auth_key_123',
        flowId: 'flow_template_999',
        sender: 'NOTIFY',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.sendSms({
        to: '+919876543210',
        body: 'Your verification OTP is 123456',
        variables: {
          OTP: '123456',
          NAME: 'Tester',
        },
      });

      expect(result).toEqual({
        success: true,
        messageId: 'req-msg91-abc12345',
      });

      expect(capturedUrl).toBe('https://control.msg91.com/api/v5/flow');
      expect(capturedInit?.method).toBe('POST');

      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers.authkey).toBe('test_auth_key_123');
      expect(headers['content-type']).toBe('application/json');
      expect(headers.accept).toBe('application/json');

      const payload = JSON.parse(capturedInit?.body as string) as Msg91FlowPayload;
      expect(payload.template_id).toBe('flow_template_999');
      expect(payload.sender).toBe('NOTIFY');
      expect(payload.short_url).toBe('0');
      expect(payload.recipients).toEqual([
        {
          mobiles: '919876543210', // normalized without '+'
          OTP: '123456',
          NAME: 'Tester',
        },
      ]);
    });

    it('handles successful 2xx responses where message is string but type is omitted', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: 'generic-req-id-777' }),
      } as unknown as Response);

      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.sendSms({
        to: '919876543210',
        body: 'Simple body',
      });

      expect(result).toEqual({
        success: true,
        messageId: 'generic-req-id-777',
      });
    });

    it('handles successful 2xx responses with empty or non-JSON body gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      } as unknown as Response);

      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await provider.sendSms({
        to: '919876543210',
        body: 'Simple body',
      });

      expect(result).toEqual({
        success: true,
      });
    });
  });

  describe('Flow ID & Sender resolution', () => {
    it('uses opts.templateId with highest precedence over config and env', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-1' }),
        } as unknown as Response;
      });

      process.env.MSG91_FLOW_ID = 'env_flow_id';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'config_flow_id',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        templateId: 'opts_template_id',
        body: 'Body',
      });

      expect(capturedPayload?.template_id).toBe('opts_template_id');
    });

    it('uses config.flowId when opts.templateId is omitted', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-2' }),
        } as unknown as Response;
      });

      process.env.MSG91_FLOW_ID = 'env_flow_id';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'config_flow_id',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(capturedPayload?.template_id).toBe('config_flow_id');
    });

    it('uses process.env.MSG91_FLOW_ID when opts and config flow IDs are omitted', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-3' }),
        } as unknown as Response;
      });

      process.env.MSG91_FLOW_ID = 'env_flow_id';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(capturedPayload?.template_id).toBe('env_flow_id');
    });

    it('uses opts.from with highest precedence for sender', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-4' }),
        } as unknown as Response;
      });

      process.env.MSG91_SENDER_ID = 'ENV_SND';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        sender: 'CFG_SND',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        from: 'OPTS_S',
        body: 'Body',
      });

      expect(capturedPayload?.sender).toBe('OPTS_S');
    });

    it('uses config.sender when opts.from is omitted', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-5' }),
        } as unknown as Response;
      });

      process.env.MSG91_SENDER_ID = 'ENV_SND';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        sender: 'CFG_SND',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(capturedPayload?.sender).toBe('CFG_SND');
    });

    it('uses process.env.MSG91_SENDER_ID when opts and config senders are omitted', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-6' }),
        } as unknown as Response;
      });

      process.env.MSG91_SENDER_ID = 'ENV_SND';
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(capturedPayload?.sender).toBe('ENV_SND');
    });

    it('omits sender from payload when no sender is configured', async () => {
      let capturedPayload: Msg91FlowPayload | undefined;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string) as Msg91FlowPayload;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ type: 'success', message: 'req-7' }),
        } as unknown as Response;
      });

      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(capturedPayload?.sender).toBeUndefined();
    });
  });

  describe('credential & Flow ID validation', () => {
    it('returns non-retryable error when authKey is missing from config and env', async () => {
      const provider = new Msg91SmsProvider({ flowId: 'flow1' });

      const result = await provider.sendSms({
        to: '919876543210',
        body: 'No authkey',
      });

      expect(result).toEqual({
        success: false,
        error:
          'MSG91 credentials not configured. Set MSG91_AUTH_KEY in environment or pass authKey in config.',
        retryable: false,
      });
    });

    it('returns non-retryable error when Flow ID is missing from opts, config, and env', async () => {
      const provider = new Msg91SmsProvider({ authKey: 'test_key' });

      const result = await provider.sendSms({
        to: '919876543210',
        body: 'No flow id',
      });

      expect(result).toEqual({
        success: false,
        error:
          'MSG91 Flow ID (templateId) is required. Set MSG91_FLOW_ID in environment, configure flowId, or pass templateId.',
        retryable: false,
      });
    });
  });

  describe('DLT & regulatory error classification (strictly non-retryable)', () => {
    it('classifies DLT Sender ID / Entity ID missing error (code 203) as non-retryable', () => {
      const err = { message: 'Invalid Sender ID or DLT Entity ID missing', code: 203 };
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies template missing or archived error (code 400) as non-retryable', () => {
      const err = { message: 'Template ID is missing, incorrect, or archived', code: 400 };
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies unapproved DLT template error (code 401) as non-retryable', () => {
      const err = { message: 'Flow or template not approved by DLT', code: 401 };
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies keyword filter error (code 402) as non-retryable', () => {
      const err = { message: 'Message triggers keyword filter', code: 402 };
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies disabled flow error (code 403) as non-retryable', () => {
      const err = { message: 'Flow is disabled', code: 403 };
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('classifies unapproved template or DLT error from text fallback as non-retryable', () => {
      const err = new Error('Rejection: DLT registration pending for template header');
      const res = mapMsg91Error(err);
      expect(res.retryable).toBe(false);
    });

    it('handles response.ok = true with type: error and DLT code', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            type: 'error',
            code: 401,
            message: 'Template not approved on DLT platform',
          }),
      } as unknown as Response);

      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendSms({
        to: '919876543210',
        body: 'Test',
      });

      expect(res.success).toBe(false);
      expect(res.retryable).toBe(false);
      expect(res.error).toContain('Template not approved on DLT platform');
    });
  });

  describe('authentication, account, and parameter validation errors (non-retryable)', () => {
    it('classifies missing authkey error 106 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'Missing authkey', code: 106 }).retryable).toBe(false);
    });

    it('classifies invalid authkey error 207 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'Invalid authkey', code: 207 }).retryable).toBe(false);
    });

    it('classifies IP blacklisted or non-whitelisted errors 208 and 418 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'IP blacklisted', code: 208 }).retryable).toBe(false);
      expect(mapMsg91Error({ message: 'IP not whitelisted', code: 418 }).retryable).toBe(false);
    });

    it('classifies insufficient balance code 301 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'Insufficient balance', code: 301 }).retryable).toBe(false);
    });

    it('classifies expired/banned account codes 302 and 303 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'Expired account', code: 302 }).retryable).toBe(false);
      expect(mapMsg91Error({ message: 'Banned account', code: 303 }).retryable).toBe(false);
    });

    it('classifies missing mobile number 101 and invalid mobile 202 as non-retryable', () => {
      expect(mapMsg91Error({ message: 'Missing mobile', code: 101 }).retryable).toBe(false);
      expect(mapMsg91Error({ message: 'Invalid mobile', code: 202 }).retryable).toBe(false);
    });

    it('classifies HTTP 400, 401, 403, 404, 422 statuses as non-retryable', () => {
      expect(mapMsg91Error('Bad Request', 400).retryable).toBe(false);
      expect(mapMsg91Error('Unauthorized', 401).retryable).toBe(false);
      expect(mapMsg91Error('Forbidden', 403).retryable).toBe(false);
      expect(mapMsg91Error('Not Found', 404).retryable).toBe(false);
      expect(mapMsg91Error('Unprocessable', 422).retryable).toBe(false);
    });
  });

  describe('rate limiting & duplicate throttle (retryable: true)', () => {
    it('classifies duplicate throttle trigger code 311 as retryable with retryAfterMs = 10000', () => {
      const res = mapMsg91Error({
        message: 'Duplicate message sent to same mobile within 10 seconds',
        code: 311,
      });

      expect(res).toEqual({
        success: false,
        error: 'Duplicate message sent to same mobile within 10 seconds',
        retryable: true,
        retryAfterMs: 10000,
      });
    });

    it('handles non-2xx HTTP responses returning JSON error bodies', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Invalid mobile number', code: 202 }),
      } as unknown as Response);

      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendSms({
        to: '919876543210',
        body: 'Test',
      });

      expect(res.success).toBe(false);
      expect(res.retryable).toBe(false);
      expect(res.error).toBe('Invalid mobile number');
    });

    it('classifies code 20429 as retryable with retryAfterMs = 1000', () => {
      const res = mapMsg91Error({ message: 'Rate limit hit', code: 20429 });
      expect(res.retryable).toBe(true);
      expect(res.retryAfterMs).toBe(1000);
    });

    it('handles string status and statusCode properties on Error instances', () => {
      const errStringStatus = Object.assign(new Error('String status'), { status: '429' });
      expect(mapMsg91Error(errStringStatus).retryable).toBe(true);

      const errStatusCodeNum = Object.assign(new Error('Numeric statusCode'), { statusCode: 500 });
      expect(mapMsg91Error(errStatusCodeNum).retryable).toBe(true);

      const errStatusCodeStr = Object.assign(new Error('String statusCode'), { statusCode: '401' });
      expect(mapMsg91Error(errStatusCodeStr).retryable).toBe(false);
    });

    it('handles plain object errors with string codes and status/statusCode', () => {
      const plainObjStringCode = { message: 'Object error', code: '202' };
      expect(mapMsg91Error(plainObjStringCode).retryable).toBe(false);

      const plainObjWithStatus = { message: 'Obj status', status: 403 };
      expect(mapMsg91Error(plainObjWithStatus).retryable).toBe(false);

      const plainObjWithStatusCode = { message: 'Obj statusCode', statusCode: 503 };
      expect(mapMsg91Error(plainObjWithStatusCode).retryable).toBe(true);
    });

    it('extracts status and codes from message regex fallback', () => {
      const errWithRegexCode = new Error('Failure code 202 triggered');
      expect(mapMsg91Error(errWithRegexCode).retryable).toBe(false);

      const errWithRegexStatus = new Error('Proxy responded with HTTP 504 during fetch');
      expect(mapMsg91Error(errWithRegexStatus).retryable).toBe(true);
    });

    it('classifies numeric server error codes as retryable', () => {
      const res = mapMsg91Error({ message: 'Internal server error', code: 500 });
      expect(res.retryable).toBe(true);
    });
  });

  describe('transient failures and network errors (retryable: true)', () => {
    it('classifies HTTP 500, 502, 503, 504 server errors as retryable', () => {
      expect(mapMsg91Error('500 Server Error', 500).retryable).toBe(true);
      expect(mapMsg91Error('502 Bad Gateway', 502).retryable).toBe(true);
      expect(mapMsg91Error('503 Service Unavailable', 503).retryable).toBe(true);
      expect(mapMsg91Error('504 Gateway Timeout', 504).retryable).toBe(true);
    });

    it('classifies network and fetch timeout errors as retryable', () => {
      const netErrors = [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNRESET',
        'ESOCKET',
        'EAI_AGAIN',
        'UND_ERR_CONNECT_TIMEOUT',
      ];

      for (const code of netErrors) {
        const err = Object.assign(new Error(`Network timeout: ${code}`), { code });
        expect(mapMsg91Error(err).retryable).toBe(true);
      }

      const fetchFailedErr = new TypeError('fetch failed');
      expect(mapMsg91Error(fetchFailedErr).retryable).toBe(true);
    });

    it('defaults unknown errors to retryable: true', () => {
      expect(mapMsg91Error(new Error('Unknown unexpected glitch'))).toEqual({
        success: false,
        error: 'Unknown unexpected glitch',
        retryable: true,
      });

      expect(mapMsg91Error('Plain string error')).toEqual({
        success: false,
        error: 'Plain string error',
        retryable: true,
      });

      expect(mapMsg91Error(null)).toEqual({
        success: false,
        error: 'Unknown MSG91 SMS delivery error',
        retryable: true,
      });
    });

    it('handles caught fetch exception in sendSms and returns retryable result', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      const provider = new Msg91SmsProvider({
        authKey: 'key',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendSms({
        to: '919876543210',
        body: 'Body',
      });

      expect(res.success).toBe(false);
      expect(res.retryable).toBe(true);
    });
  });

  describe('sanitization', () => {
    it('masks Indian phone numbers with and without leading +', () => {
      const withPlus = 'Failed sending to +919876543210: error';
      expect(sanitizeErrorMessage(withPlus)).toBe('Failed sending to +9198***3210: error');

      const withoutPlus = 'Invalid recipient 919876543210 in request';
      expect(sanitizeErrorMessage(withoutPlus)).toBe('Invalid recipient 9198***3210 in request');

      const labeledMobile = 'Error for mobile: 919876543210 rejected';
      expect(sanitizeErrorMessage(labeledMobile)).toBe('Error for mobile: 9198***3210 rejected');
    });

    it('redacts authkey, password, and token assignments and colons', () => {
      const queryAssignment = 'Failed auth with authkey=secret_auth_123456 and password=pass999';
      expect(sanitizeErrorMessage(queryAssignment)).toBe(
        'Failed auth with authkey=[REDACTED] and password=[REDACTED]',
      );

      const colonSeparated = 'Error details: authkey: secret_auth_123456, token: tok_888';
      expect(sanitizeErrorMessage(colonSeparated)).toBe(
        'Error details: authkey: [REDACTED], token: [REDACTED]',
      );
    });

    it('sanitizes error messages through mapMsg91Error and sendSms', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Failed authkey=supersecretkey for mobile +919876543210',
      } as unknown as Response);

      const provider = new Msg91SmsProvider({
        authKey: 'supersecretkey',
        flowId: 'flow1',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendSms({
        to: '+919876543210',
        body: 'Test',
      });

      expect(res.error).toBe('Failed authkey=[REDACTED] for mobile +9198***3210');
      expect(res.error).not.toContain('supersecretkey');
      expect(res.error).not.toContain('9876543210');
    });
  });
});
