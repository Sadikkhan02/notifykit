import process from 'node:process';
import type { NotifierConfig } from '../interfaces/config';
import { ConfigError } from '../errors/config-error';
import { notifierConfigSchema, smtpProviderSchema } from './schema';

/**
 * Validates a raw configuration object or environment configuration against
 * the NotifyKit configuration specification and provider rules.
 *
 * @param raw Unvalidated configuration object
 * @returns Fully validated and typed NotifierConfig
 * @throws {ConfigError} If configuration values are invalid or required credentials are missing
 */
export function validateConfig(raw: unknown): NotifierConfig {
  if (raw === null || typeof raw !== 'object') {
    throw new ConfigError(
      'Configuration must be a non-null object',
      'Provide a valid NotifierConfig object or call loadConfig() to read environment variables',
    );
  }

  const parseResult = notifierConfigSchema.safeParse(raw);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    const path = firstIssue?.path.join('.') || 'config';
    const issueMessage = firstIssue?.message || 'Invalid configuration';

    const hint = path.includes('redis')
      ? 'Set REDIS_URL to a valid Redis connection string (e.g., redis://localhost:6379)'
      : 'Verify configuration values against the NotifyKit specification';

    throw new ConfigError(
      `Configuration validation failed at "${path}": ${issueMessage}`,
      hint,
      parseResult.error,
    );
  }

  const config: NotifierConfig = {
    ...parseResult.data,
    providers: { ...parseResult.data.providers },
  };

  // Provider-specific validation: SMS Twilio
  const smsProvider = config.providers.sms;
  if (smsProvider && smsProvider.type === 'twilio') {
    const accountSid =
      (typeof smsProvider.accountSid === 'string' && smsProvider.accountSid.trim() !== ''
        ? smsProvider.accountSid
        : undefined) ?? process.env.TWILIO_ACCOUNT_SID;

    const authToken =
      (typeof smsProvider.authToken === 'string' && smsProvider.authToken.trim() !== ''
        ? smsProvider.authToken
        : undefined) ?? process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      throw new ConfigError(
        'Twilio selected but TWILIO_AUTH_TOKEN is missing',
        'Run npx notifykit init or set it in .env',
      );
    }

    if (!accountSid) {
      throw new ConfigError(
        'Twilio selected but TWILIO_ACCOUNT_SID is missing',
        'Run npx notifykit init or set it in .env',
      );
    }

    config.providers.sms = {
      ...smsProvider,
      accountSid,
      authToken,
    };
  }

  // Provider-specific validation: Email SMTP / Nodemailer
  const emailProvider = config.providers.email;
  if (emailProvider && (emailProvider.type === 'nodemailer' || emailProvider.type === 'smtp')) {
    const rawPort = emailProvider.port ?? process.env.SMTP_PORT;
    const smtpToValidate = {
      ...emailProvider,
      ...(rawPort !== undefined ? { port: rawPort } : {}),
    };
    const smtpParse = smtpProviderSchema.safeParse(smtpToValidate);
    if (!smtpParse.success) {
      throw new ConfigError(
        'SMTP_PORT must be an integer between 1 and 65535',
        'Specify a valid SMTP port number (e.g. 587 or 465) in .env or configuration',
        smtpParse.error,
      );
    }
    config.providers.email = {
      ...emailProvider,
      ...smtpParse.data,
    };
  }

  return config;
}
