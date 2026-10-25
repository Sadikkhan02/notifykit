import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfig,
  validateConfig,
  REDACT_PATHS,
  ConfigError,
  NotifyKitError,
} from '../src/index';
import {
  twilioProviderSchema,
  smtpProviderSchema,
  genericProviderSchema,
  notifierConfigSchema,
} from '../src/config/index';

describe('Configuration module (src/config)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateConfig()', () => {
    it('validates an empty configuration object and provides default providers', () => {
      const config = validateConfig({});
      expect(config).toBeDefined();
      expect(config.providers).toEqual({});
      expect(config.redis).toBeUndefined();
    });

    it('throws ConfigError on null or non-object raw config', () => {
      expect(() => validateConfig(null)).toThrow(ConfigError);
      expect(() => validateConfig(undefined)).toThrow(ConfigError);
      expect(() => validateConfig('string')).toThrow(ConfigError);

      try {
        validateConfig(null);
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect(err).toBeInstanceOf(NotifyKitError);
        const cfgErr = err as ConfigError;
        expect(cfgErr.code).toBe('E_CONFIG_INVALID');
        expect(cfgErr.hint).toContain('NotifierConfig');
      }
    });

    it('throws ConfigError with generic hint when validation fails on non-redis paths', () => {
      try {
        validateConfig({
          providers: {
            sms: {
              type: '',
            },
          },
        });
      } catch (err) {
        const cfgErr = err as ConfigError;
        expect(cfgErr.code).toBe('E_CONFIG_INVALID');
        expect(cfgErr.hint).toBe('Verify configuration values against the NotifyKit specification');
      }
    });

    it('validates a valid Redis URL', () => {
      const config = validateConfig({
        redis: 'redis://localhost:6379',
      });
      expect(config.redis).toBe('redis://localhost:6379');

      const tlsConfig = validateConfig({
        redis: 'rediss://mockuser:mockpass@redis.example.com:6380',
      });
      expect(tlsConfig.redis).toBe('rediss://mockuser:mockpass@redis.example.com:6380');
    });

    it('throws ConfigError on an invalid Redis URL', () => {
      expect(() =>
        validateConfig({
          redis: 'http://localhost:6379',
        }),
      ).toThrow(ConfigError);

      try {
        validateConfig({ redis: 'invalid-url' });
      } catch (err) {
        const cfgErr = err as ConfigError;
        expect(cfgErr.code).toBe('E_CONFIG_INVALID');
        expect(cfgErr.hint).toContain('REDIS_URL');
      }
    });

    it('validates Twilio SMS provider with explicit credentials', () => {
      const config = validateConfig({
        providers: {
          sms: {
            type: 'twilio',
            accountSid: 'mock-twilio-account-sid',
            authToken: 'mock-twilio-auth-token',
          },
        },
      });

      expect(config.providers.sms?.type).toBe('twilio');
      expect(config.providers.sms?.accountSid).toBe('mock-twilio-account-sid');
      expect(config.providers.sms?.authToken).toBe('mock-twilio-auth-token');
    });

    it('falls back to environment variables for Twilio credentials', () => {
      process.env.TWILIO_ACCOUNT_SID = 'mock-env-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'mock-env-auth-token';

      const config = validateConfig({
        providers: {
          sms: {
            type: 'twilio',
          },
        },
      });

      expect(config.providers.sms?.accountSid).toBe('mock-env-account-sid');
      expect(config.providers.sms?.authToken).toBe('mock-env-auth-token');
    });

    it('throws ConfigError when Twilio is selected but TWILIO_AUTH_TOKEN is missing', () => {
      expect(() =>
        validateConfig({
          providers: {
            sms: {
              type: 'twilio',
              accountSid: 'mock-twilio-account-sid',
            },
          },
        }),
      ).toThrow(ConfigError);

      try {
        validateConfig({
          providers: {
            sms: {
              type: 'twilio',
              accountSid: 'mock-twilio-account-sid',
            },
          },
        });
      } catch (err) {
        const cfgErr = err as ConfigError;
        expect(cfgErr.code).toBe('E_CONFIG_INVALID');
        expect(cfgErr.message).toBe('Twilio selected but TWILIO_AUTH_TOKEN is missing');
        expect(cfgErr.hint).toBe('Run npx notifykit init or set it in .env');
        expect(cfgErr.traceId).toBeDefined();
      }
    });

    it('throws ConfigError when Twilio is selected but TWILIO_ACCOUNT_SID is missing', () => {
      try {
        validateConfig({
          providers: {
            sms: {
              type: 'twilio',
              authToken: 'mock-twilio-auth-token',
            },
          },
        });
      } catch (err) {
        const cfgErr = err as ConfigError;
        expect(cfgErr.code).toBe('E_CONFIG_INVALID');
        expect(cfgErr.message).toBe('Twilio selected but TWILIO_ACCOUNT_SID is missing');
        expect(cfgErr.hint).toBe('Run npx notifykit init or set it in .env');
      }
    });

    it('validates SMTP / Nodemailer email provider with valid port', () => {
      const config = validateConfig({
        providers: {
          email: {
            type: 'nodemailer',
            host: 'smtp.mailtrap.io',
            port: 2525,
            user: 'user1',
            password: 'pwd',
          },
        },
      });

      expect(config.providers.email?.type).toBe('nodemailer');
      expect(config.providers.email?.port).toBe(2525);
    });

    it('coerces string SMTP port to integer', () => {
      const config = validateConfig({
        providers: {
          email: {
            type: 'smtp',
            port: '587',
          },
        },
      });
      expect(config.providers.email?.port).toBe(587);
    });

    it('reads SMTP_PORT from process.env when not supplied on provider object', () => {
      process.env.SMTP_PORT = '2525';
      const config = validateConfig({
        providers: {
          email: {
            type: 'nodemailer',
          },
        },
      });
      expect(config.providers.email?.port).toBe(2525);
    });

    it('validates SMTP / Nodemailer email provider when port is omitted in config and env', () => {
      const config = validateConfig({
        providers: {
          email: {
            type: 'nodemailer',
            host: 'smtp.test.com',
          },
        },
      });
      expect(config.providers.email?.type).toBe('nodemailer');
      expect(config.providers.email?.port).toBeUndefined();
    });

    it('throws ConfigError on invalid SMTP port', () => {
      expect(() =>
        validateConfig({
          providers: {
            email: {
              type: 'smtp',
              port: 'invalid-port',
            },
          },
        }),
      ).toThrow(ConfigError);

      expect(() =>
        validateConfig({
          providers: {
            email: {
              type: 'smtp',
              port: 70000,
            },
          },
        }),
      ).toThrow(ConfigError);

      expect(() =>
        validateConfig({
          providers: {
            email: {
              type: 'smtp',
              port: -1,
            },
          },
        }),
      ).toThrow(ConfigError);
    });

    it('validates generic push provider', () => {
      const config = validateConfig({
        providers: {
          push: {
            type: 'fcm',
          },
        },
      });
      expect(config.providers.push?.type).toBe('fcm');
    });
  });

  describe('loadConfig()', () => {
    it('reads all relevant provider configuration from injected environment dictionary', () => {
      const mockEnv = {
        REDIS_URL: 'redis://redis-server:6379',
        NOTIFYKIT_SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'mock-test-account-sid',
        TWILIO_AUTH_TOKEN: 'mock-test-auth-token',
        NOTIFYKIT_EMAIL_PROVIDER: 'nodemailer',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_USER: 'smtp_user',
        SMTP_PASSWORD: 'smtp_password',
        NOTIFYKIT_PUSH_PROVIDER: 'fcm',
      };

      const loaded = loadConfig(mockEnv);
      expect(loaded.redis).toBe('redis://redis-server:6379');
      expect(loaded.providers.sms).toEqual({
        type: 'twilio',
        accountSid: 'mock-test-account-sid',
        authToken: 'mock-test-auth-token',
      });
      expect(loaded.providers.email).toEqual({
        type: 'nodemailer',
        host: 'smtp.example.com',
        port: '465',
        user: 'smtp_user',
        password: 'smtp_password',
      });
      expect(loaded.providers.push).toEqual({
        type: 'fcm',
      });

      const validated = validateConfig(loaded);
      expect(validated.providers.email?.port).toBe(465);
    });

    it('loads custom SMS and Email providers from environment', () => {
      const mockEnv = {
        NOTIFYKIT_SMS_PROVIDER: 'custom-sms',
        NOTIFYKIT_EMAIL_PROVIDER: 'custom-email',
      };

      const loaded = loadConfig(mockEnv);
      expect(loaded.providers.sms).toEqual({
        type: 'custom-sms',
      });
      expect(loaded.providers.email).toEqual({
        type: 'custom-email',
      });
    });

    it('loads MSG91 SMS provider from environment', () => {
      const mockEnv = {
        NOTIFYKIT_SMS_PROVIDER: 'msg91',
        MSG91_AUTH_KEY: 'msg91_auth_key_123',
      };

      const loaded = loadConfig(mockEnv);
      expect(loaded.providers.sms).toEqual({
        type: 'msg91',
        authKey: 'msg91_auth_key_123',
      });
    });

    it('loads twilio provider when only partial credentials or no credentials are in env', () => {
      const withSidOnly = loadConfig({
        NOTIFYKIT_SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'mock-account-sid-only',
      });
      expect(withSidOnly.providers.sms).toEqual({
        type: 'twilio',
        accountSid: 'mock-account-sid-only',
      });

      const withTokenOnly = loadConfig({
        NOTIFYKIT_SMS_PROVIDER: 'twilio',
        TWILIO_AUTH_TOKEN: 'mock-auth-token-only',
      });
      expect(withTokenOnly.providers.sms).toEqual({
        type: 'twilio',
        authToken: 'mock-auth-token-only',
      });

      const withNone = loadConfig({
        NOTIFYKIT_SMS_PROVIDER: 'twilio',
      });
      expect(withNone.providers.sms).toEqual({
        type: 'twilio',
      });

      const msg91NoKey = loadConfig({
        NOTIFYKIT_SMS_PROVIDER: 'msg91',
      });
      expect(msg91NoKey.providers.sms).toEqual({
        type: 'msg91',
      });

      const smtpPartial = loadConfig({
        NOTIFYKIT_EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.only.host',
      });
      expect(smtpPartial.providers.email).toEqual({
        type: 'smtp',
        host: 'smtp.only.host',
      });
    });

    it('defaults to process.env when no argument is supplied', () => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      const loaded = loadConfig();
      expect(loaded.redis).toBe('redis://127.0.0.1:6379');
    });
  });

  describe('Zod Schemas direct validation', () => {
    it('validates twilioProviderSchema with valid credentials', () => {
      const result = twilioProviderSchema.safeParse({
        type: 'twilio',
        accountSid: 'mock-twilio-account-sid',
        authToken: 'mock-twilio-auth-token',
      });
      expect(result.success).toBe(true);
    });

    it('validates smtpProviderSchema with valid options', () => {
      const result = smtpProviderSchema.safeParse({
        type: 'smtp',
        host: 'smtp.test.com',
        port: '587',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(587);
      }
    });

    it('validates genericProviderSchema with custom properties', () => {
      const result = genericProviderSchema.safeParse({
        type: 'custom',
        extraOption: true,
      });
      expect(result.success).toBe(true);
    });

    it('validates notifierConfigSchema default empty providers', () => {
      const result = notifierConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.providers).toEqual({});
      }
    });
  });

  describe('Secret redaction paths', () => {
    it('exports the mandated REDACT_PATHS constant', () => {
      expect(REDACT_PATHS).toEqual(['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*']);
      expect(Object.isFrozen(REDACT_PATHS)).toBe(true);
    });
  });

  describe('Error hierarchy', () => {
    it('instantiates NotifyKitError with custom traceId and cause', () => {
      const cause = new Error('root cause');
      const err = new NotifyKitError({
        code: 'TEST_CODE',
        message: 'Something broke',
        hint: 'Check your settings',
        traceId: 'custom-trace-id',
        cause,
      });

      expect(err.name).toBe('NotifyKitError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('Something broke');
      expect(err.hint).toBe('Check your settings');
      expect(err.traceId).toBe('custom-trace-id');
      expect(err.cause).toBe(cause);
    });

    it('generates a default traceId when none is provided to NotifyKitError', () => {
      const err = new NotifyKitError({
        code: 'DEFAULT_TRACE',
        message: 'Msg',
        hint: 'Hint',
      });
      expect(err.traceId).toMatch(/^err_/);
    });

    it('instantiates ConfigError with default E_CONFIG_INVALID code', () => {
      const err = new ConfigError('Invalid config', 'Fix it');
      expect(err.name).toBe('ConfigError');
      expect(err.code).toBe('E_CONFIG_INVALID');
      expect(err.message).toBe('Invalid config');
      expect(err.hint).toBe('Fix it');
      expect(err.traceId).toMatch(/^err_/);
    });
  });
});
