import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prompts from 'prompts';
import { promptChannels } from '../src/prompts/channels.js';
import { promptProviders } from '../src/prompts/providers.js';
import { promptRedis } from '../src/prompts/redis.js';
import { promptCredentials } from '../src/prompts/credentials.js';
import { displaySummary, promptConfirmation, displaySuccess } from '../src/prompts/summary.js';

vi.mock('prompts');

type ValidatorCallback = (val: string) => boolean | string;

describe('CLI Prompts Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptChannels', () => {
    it('returns selected channels', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({ channels: ['email', 'sms'] });
      const res = await promptChannels();
      expect(res).toEqual(['email', 'sms']);
    });

    it('returns null when user cancels', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({});
      const res = await promptChannels();
      expect(res).toBeNull();
    });
  });

  describe('promptProviders', () => {
    it('prompts and returns selection for all channels', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ provider: 'nodemailer' })
        .mockResolvedValueOnce({ provider: 'msg91' })
        .mockResolvedValueOnce({ provider: 'fcm' });

      const res = await promptProviders(['email', 'sms', 'push']);
      expect(res).toEqual({
        email: 'nodemailer',
        sms: 'msg91',
        push: 'fcm',
      });
    });

    it('returns null on cancellation at any provider prompt', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({});
      const res = await promptProviders(['email']);
      expect(res).toBeNull();

      vi.mocked(prompts)
        .mockResolvedValueOnce({ provider: 'nodemailer' })
        .mockResolvedValueOnce({});
      const res2 = await promptProviders(['email', 'sms']);
      expect(res2).toBeNull();

      vi.mocked(prompts).mockResolvedValueOnce({});
      const res3 = await promptProviders(['push']);
      expect(res3).toBeNull();
    });
  });

  describe('promptRedis', () => {
    it('supports docker choice and custom URL', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(prompts)
        .mockResolvedValueOnce({ redisType: 'docker' })
        .mockResolvedValueOnce({ redisUrl: 'redis://localhost:6379' });

      const res = await promptRedis();
      expect(res).toBe('redis://localhost:6379');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('docker run'));

      logSpy.mockRestore();
    });

    it('tests redis URL validator callback', async () => {
      let validatorFn: ValidatorCallback | undefined;
      vi.mocked(prompts)
        .mockResolvedValueOnce({ redisType: 'url' })
        .mockImplementationOnce((config) => {
          const promptObj = config as prompts.PromptObject;
          validatorFn = promptObj.validate as ValidatorCallback;
          return Promise.resolve({ redisUrl: 'redis://127.0.0.1:6379' });
        });

      const res = await promptRedis();
      expect(res).toBe('redis://127.0.0.1:6379');
      if (typeof validatorFn === 'function') {
        expect(validatorFn('redis://localhost:6379')).toBe(true);
        expect(validatorFn('rediss://secure-host:6379')).toBe(true);
        expect(validatorFn('http://invalid')).toContain('Redis URL must start with');
      } else {
        expect.unreachable('validatorFn was not captured');
      }
    });

    it('returns null on cancel', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({});
      expect(await promptRedis()).toBeNull();

      vi.mocked(prompts).mockResolvedValueOnce({ redisType: 'url' }).mockResolvedValueOnce({});
      expect(await promptRedis()).toBeNull();
    });
  });

  describe('promptCredentials', () => {
    it('prompts MSG91 credentials and validates fields', async () => {
      let authKeyVal: ValidatorCallback | undefined;
      let flowIdVal: ValidatorCallback | undefined;

      vi.mocked(prompts).mockImplementationOnce((questions) => {
        const qList = questions as prompts.PromptObject[];
        authKeyVal = qList[0].validate as ValidatorCallback;
        flowIdVal = qList[1].validate as ValidatorCallback;
        return Promise.resolve({
          authKey: 'my_auth_key',
          flowId: 'my_flow_id',
          senderId: 'OTPHDR',
        });
      });

      const res = await promptCredentials({ sms: 'msg91' });
      expect(res).toEqual({
        NOTIFYKIT_SMS_PROVIDER: 'msg91',
        MSG91_AUTH_KEY: 'my_auth_key',
        MSG91_FLOW_ID: 'my_flow_id',
        MSG91_SENDER_ID: 'OTPHDR',
      });

      if (typeof authKeyVal === 'function' && typeof flowIdVal === 'function') {
        expect(authKeyVal('test')).toBe(true);
        expect(authKeyVal('')).toContain('required');
        expect(flowIdVal('test')).toBe(true);
        expect(flowIdVal('')).toContain('required');
      } else {
        expect.unreachable('validator callbacks were not captured');
      }
    });

    it('prompts FCM credentials via file path and validates existing file', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-fcm-prompt-'));
      const fakeSaPath = path.join(tempDir, 'sa.json');
      fs.writeFileSync(fakeSaPath, '{"type":"service_account"}');

      try {
        let pathVal: ValidatorCallback | undefined;

        vi.mocked(prompts)
          .mockResolvedValueOnce({ format: 'path' })
          .mockImplementationOnce((config) => {
            const promptObj = config as prompts.PromptObject;
            pathVal = promptObj.validate as ValidatorCallback;
            return Promise.resolve({ filePath: fakeSaPath });
          })
          .mockResolvedValueOnce({ projectId: 'my-proj-id' });

        const res = await promptCredentials({ push: 'fcm' });
        expect(res).toEqual({
          NOTIFYKIT_PUSH_PROVIDER: 'fcm',
          FCM_SERVICE_ACCOUNT_JSON: fakeSaPath,
          FCM_PROJECT_ID: 'my-proj-id',
        });

        if (typeof pathVal === 'function') {
          expect(pathVal(fakeSaPath)).toBe(true);
          expect(pathVal('')).toContain('Path is required');
          expect(pathVal('/non/existent/file.json')).toContain('File not found');
        } else {
          expect.unreachable('pathVal was not captured');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('prompts FCM credentials via raw JSON string and validates json format', async () => {
      let jsonVal: ValidatorCallback | undefined;

      vi.mocked(prompts)
        .mockResolvedValueOnce({ format: 'raw' })
        .mockImplementationOnce((config) => {
          const promptObj = config as prompts.PromptObject;
          jsonVal = promptObj.validate as ValidatorCallback;
          return Promise.resolve({ rawJson: '{"project_id":"fcm-proj"}' });
        })
        .mockResolvedValueOnce({ projectId: '' });

      const res = await promptCredentials({ push: 'fcm' });
      expect(res).toEqual({
        NOTIFYKIT_PUSH_PROVIDER: 'fcm',
        FCM_SERVICE_ACCOUNT_JSON: '{"project_id":"fcm-proj"}',
      });

      if (typeof jsonVal === 'function') {
        expect(jsonVal('{"valid":"json"}')).toBe(true);
        expect(jsonVal('invalid-json')).toContain('Invalid JSON string');
      } else {
        expect.unreachable('jsonVal was not captured');
      }
    });

    it('returns null on cancel during credentials', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({});
      expect(await promptCredentials({ email: 'nodemailer' })).toBeNull();

      vi.mocked(prompts).mockResolvedValueOnce({});
      expect(await promptCredentials({ sms: 'twilio' })).toBeNull();

      vi.mocked(prompts).mockResolvedValueOnce({});
      expect(await promptCredentials({ sms: 'msg91' })).toBeNull();

      vi.mocked(prompts).mockResolvedValueOnce({});
      expect(await promptCredentials({ push: 'fcm' })).toBeNull();
    });
  });

  describe('displaySummary & displaySuccess & promptConfirmation', () => {
    it('displays summary and redacts sensitive credentials', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displaySummary(
        {
          channels: ['email', 'sms'],
          providers: { email: 'nodemailer', sms: 'twilio' },
          redisUrl: 'redis://localhost:6379',
          credentials: {
            SMTP_HOST: 'smtp.mail.com',
            SMTP_PASSWORD: 'plain_secret_password',
            TWILIO_AUTH_TOKEN: 'plain_secret_token',
          },
        },
        ['notifykit', '@notifykit/adapter-nodemailer'],
        '/test/dir',
      );

      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allLogs).toContain('[REDACTED]');
      expect(allLogs).not.toContain('plain_secret_password');
      expect(allLogs).not.toContain('plain_secret_token');
      expect(allLogs).toContain('SMTP_HOST = smtp.mail.com');

      logSpy.mockRestore();
    });

    it('promptConfirmation returns user choice', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({ proceed: true });
      expect(await promptConfirmation()).toBe(true);

      vi.mocked(prompts).mockResolvedValueOnce({ proceed: false });
      expect(await promptConfirmation()).toBe(false);
    });

    it('displaySuccess prints success message and starter snippet', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displaySuccess(['SMTP_HOST', 'REDIS_URL'], ['@notifykit/adapter-nodemailer']);
      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allLogs).toContain('NotifyKit setup complete');
      expect(allLogs).toContain('@notifykit/adapter-nodemailer');

      logSpy.mockRestore();
    });
  });
});
