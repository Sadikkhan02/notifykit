import { CHANNELS, DEFAULT_REDIS_URL } from './constants.js';
import type { Channel, Provider, ProviderSelection, WizardConfig, CliOptions } from './types.js';

/**
 * Validates that at least one valid notification channel is selected.
 */
export function validateChannels(channels: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(channels) || channels.length === 0) {
    return { valid: false, error: 'At least one notification channel must be selected.' };
  }

  const invalid = channels.filter((c) => !CHANNELS.includes(c as Channel));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid channel(s): ${invalid.join(', ')}. Supported channels are: ${CHANNELS.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates that a provider matches the specified channel.
 */
export function validateProvider(
  channel: Channel,
  provider: string,
): { valid: boolean; error?: string } {
  if (channel === 'email' && provider !== 'nodemailer') {
    return { valid: false, error: `Invalid email provider "${provider}". Supported: nodemailer.` };
  }
  if (channel === 'sms' && provider !== 'twilio' && provider !== 'msg91') {
    return { valid: false, error: `Invalid SMS provider "${provider}". Supported: twilio, msg91.` };
  }
  if (channel === 'push' && provider !== 'fcm') {
    return { valid: false, error: `Invalid push provider "${provider}". Supported: fcm.` };
  }
  return { valid: true };
}

/**
 * Returns required environment variable names missing from the provided credentials.
 */
export function getMissingRequiredCredentials(
  provider: Provider,
  credentials: Record<string, string | undefined>,
): string[] {
  const missing: string[] = [];

  switch (provider) {
    case 'nodemailer': {
      if (!credentials.SMTP_HOST?.trim()) missing.push('SMTP_HOST');
      if (!credentials.SMTP_PORT?.trim()) missing.push('SMTP_PORT');
      if (!credentials.SMTP_USER?.trim()) missing.push('SMTP_USER');
      if (!credentials.SMTP_PASSWORD?.trim()) missing.push('SMTP_PASSWORD');
      break;
    }
    case 'twilio': {
      if (!credentials.TWILIO_ACCOUNT_SID?.trim()) missing.push('TWILIO_ACCOUNT_SID');
      if (!credentials.TWILIO_AUTH_TOKEN?.trim()) missing.push('TWILIO_AUTH_TOKEN');
      break;
    }
    case 'msg91': {
      if (!credentials.MSG91_AUTH_KEY?.trim()) missing.push('MSG91_AUTH_KEY');
      if (!credentials.MSG91_FLOW_ID?.trim()) missing.push('MSG91_FLOW_ID');
      break;
    }
    case 'fcm': {
      if (!credentials.FCM_SERVICE_ACCOUNT_JSON?.trim()) missing.push('FCM_SERVICE_ACCOUNT_JSON');
      break;
    }
  }

  return missing;
}

/**
 * Validates non-interactive CLI flags and constructs a WizardConfig.
 * Throws an Error with a descriptive, secret-free message if validation fails.
 */
export function parseAndValidateNonInteractive(options: CliOptions): WizardConfig {
  if (!options.channels || typeof options.channels !== 'string') {
    throw new Error(
      'Missing required flag: --channels=<email,sms,push>. At least one channel must be specified.',
    );
  }

  const rawChannels = options.channels
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const channelVal = validateChannels(rawChannels);
  if (!channelVal.valid) {
    throw new Error(channelVal.error);
  }

  const channels = rawChannels as Channel[];
  const providers: ProviderSelection = {};
  const credentials: Record<string, string> = {};

  // Email validation
  if (channels.includes('email')) {
    const emailProvider = (options.email?.trim().toLowerCase() || 'nodemailer') as 'nodemailer';
    const val = validateProvider('email', emailProvider);
    if (!val.valid) throw new Error(val.error);
    providers.email = emailProvider;
    credentials.NOTIFYKIT_EMAIL_PROVIDER = emailProvider;

    if (options.smtpHost) credentials.SMTP_HOST = options.smtpHost.trim();
    if (options.smtpPort) credentials.SMTP_PORT = options.smtpPort.trim();
    if (options.smtpUser) credentials.SMTP_USER = options.smtpUser.trim();
    if (options.smtpPassword) credentials.SMTP_PASSWORD = options.smtpPassword;
    if (options.smtpFrom) credentials.SMTP_FROM = options.smtpFrom.trim();
    if (options.smtpSecure) credentials.SMTP_SECURE = options.smtpSecure.trim();

    const missing = getMissingRequiredCredentials('nodemailer', credentials);
    if (missing.length > 0) {
      throw new Error(`Missing required credentials for email (Nodemailer): ${missing.join(', ')}`);
    }
  }

  // SMS validation
  if (channels.includes('sms')) {
    if (!options.sms || !options.sms.trim()) {
      throw new Error(
        'SMS channel selected but no provider specified. Use --sms=twilio or --sms=msg91.',
      );
    }
    const smsProvider = options.sms.trim().toLowerCase() as 'twilio' | 'msg91';
    const val = validateProvider('sms', smsProvider);
    if (!val.valid) throw new Error(val.error);
    providers.sms = smsProvider;
    credentials.NOTIFYKIT_SMS_PROVIDER = smsProvider;

    if (smsProvider === 'twilio') {
      const sid = options.twilioSid || options.twilioAccountSid;
      const token = options.twilioToken || options.twilioAuthToken;
      if (sid) credentials.TWILIO_ACCOUNT_SID = sid.trim();
      if (token) credentials.TWILIO_AUTH_TOKEN = token;
      if (options.twilioFrom) credentials.TWILIO_FROM = options.twilioFrom.trim();
      if (options.twilioMessagingServiceSid) {
        credentials.TWILIO_MESSAGING_SERVICE_SID = options.twilioMessagingServiceSid.trim();
      }

      const missing = getMissingRequiredCredentials('twilio', credentials);
      if (missing.length > 0) {
        throw new Error(`Missing required credentials for SMS (Twilio): ${missing.join(', ')}`);
      }
    } else if (smsProvider === 'msg91') {
      if (options.msg91AuthKey) credentials.MSG91_AUTH_KEY = options.msg91AuthKey;
      if (options.msg91FlowId) credentials.MSG91_FLOW_ID = options.msg91FlowId.trim();
      if (options.msg91SenderId) credentials.MSG91_SENDER_ID = options.msg91SenderId.trim();

      const missing = getMissingRequiredCredentials('msg91', credentials);
      if (missing.length > 0) {
        throw new Error(`Missing required credentials for SMS (MSG91): ${missing.join(', ')}`);
      }
    }
  }

  // Push validation
  if (channels.includes('push')) {
    const pushProvider = (options.push?.trim().toLowerCase() || 'fcm') as 'fcm';
    const val = validateProvider('push', pushProvider);
    if (!val.valid) throw new Error(val.error);
    providers.push = pushProvider;
    credentials.NOTIFYKIT_PUSH_PROVIDER = pushProvider;

    const sa = options.fcmServiceAccount || options.fcmServiceAccountJson;
    if (sa) credentials.FCM_SERVICE_ACCOUNT_JSON = sa;
    if (options.fcmProjectId) credentials.FCM_PROJECT_ID = options.fcmProjectId.trim();

    const missing = getMissingRequiredCredentials('fcm', credentials);
    if (missing.length > 0) {
      throw new Error(`Missing required credentials for Push (FCM): ${missing.join(', ')}`);
    }
  }

  const redisUrl = options.redisUrl?.trim() || DEFAULT_REDIS_URL;
  credentials.REDIS_URL = redisUrl;

  return {
    channels,
    providers,
    redisUrl,
    credentials,
  };
}
