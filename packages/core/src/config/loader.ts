import process from 'node:process';
import type { NotifierConfig, ProviderConfig } from '../interfaces/config';

/**
 * Loads configuration from environment variables into a raw NotifierConfig structure.
 * Defaults to process.env, with optional injection for test isolation.
 *
 * @param env Environment variables dictionary (defaults to process.env)
 * @returns Raw NotifierConfig loaded from environment variables
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): NotifierConfig {
  const providers: NotifierConfig['providers'] = {};

  if (env.NOTIFYKIT_SMS_PROVIDER) {
    const smsConfig: ProviderConfig = {
      type: env.NOTIFYKIT_SMS_PROVIDER,
    };
    if (env.NOTIFYKIT_SMS_PROVIDER === 'twilio') {
      if (env.TWILIO_ACCOUNT_SID) smsConfig.accountSid = env.TWILIO_ACCOUNT_SID;
      if (env.TWILIO_AUTH_TOKEN) smsConfig.authToken = env.TWILIO_AUTH_TOKEN;
    } else if (env.NOTIFYKIT_SMS_PROVIDER === 'msg91') {
      if (env.MSG91_AUTH_KEY) smsConfig.authKey = env.MSG91_AUTH_KEY;
    }
    providers.sms = smsConfig;
  }

  if (env.NOTIFYKIT_EMAIL_PROVIDER) {
    const emailConfig: ProviderConfig = {
      type: env.NOTIFYKIT_EMAIL_PROVIDER,
    };
    if (env.NOTIFYKIT_EMAIL_PROVIDER === 'nodemailer' || env.NOTIFYKIT_EMAIL_PROVIDER === 'smtp') {
      if (env.SMTP_HOST) emailConfig.host = env.SMTP_HOST;
      if (env.SMTP_PORT) emailConfig.port = env.SMTP_PORT;
      if (env.SMTP_USER) emailConfig.user = env.SMTP_USER;
      if (env.SMTP_PASSWORD) emailConfig.password = env.SMTP_PASSWORD;
    }
    providers.email = emailConfig;
  }

  if (env.NOTIFYKIT_PUSH_PROVIDER) {
    providers.push = {
      type: env.NOTIFYKIT_PUSH_PROVIDER,
    };
  }

  const config: NotifierConfig = {
    providers,
  };

  if (env.REDIS_URL) {
    config.redis = env.REDIS_URL;
  }

  return config;
}
