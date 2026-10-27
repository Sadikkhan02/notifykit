import fs from 'node:fs';
import prompts from 'prompts';
import type { ProviderSelection } from '../types.js';

/**
 * Prompts for provider-specific credentials with masked inputs for secrets.
 */
export async function promptCredentials(
  providers: ProviderSelection,
): Promise<Record<string, string> | null> {
  const credentials: Record<string, string> = {};

  // --- Nodemailer ---
  if (providers.email === 'nodemailer') {
    credentials.NOTIFYKIT_EMAIL_PROVIDER = 'nodemailer';
    // eslint-disable-next-line no-console
    console.log('\n--- Email Configuration (Nodemailer SMTP) ---');

    const res = await prompts([
      {
        type: 'text',
        name: 'host',
        message: 'SMTP Host (e.g. smtp.mailtrap.io, smtp.gmail.com):',
        validate: (val: string) => (val.trim() ? true : 'SMTP host is required'),
      },
      {
        type: 'text',
        name: 'port',
        message: 'SMTP Port:',
        initial: '587',
        validate: (val: string) =>
          !Number.isNaN(Number(val)) ? true : 'Port must be a valid number',
      },
      {
        type: 'text',
        name: 'user',
        message: 'SMTP Username / User:',
        validate: (val: string) => (val.trim() ? true : 'SMTP user is required'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'SMTP Password:',
        validate: (val: string) => (val.trim() ? true : 'SMTP password is required'),
      },
      {
        type: 'text',
        name: 'from',
        message: 'Default Sender Address (SMTP_FROM, optional):',
        initial: 'noreply@example.com',
      },
      {
        type: 'confirm',
        name: 'secure',
        message: 'Use TLS / SSL directly (typically true for port 465)?',
        initial: false,
      },
    ]);

    if (!res.host || !res.port || !res.user || !res.password) {
      return null;
    }

    credentials.SMTP_HOST = res.host.trim();
    credentials.SMTP_PORT = String(res.port).trim();
    credentials.SMTP_USER = res.user.trim();
    credentials.SMTP_PASSWORD = res.password;
    if (res.from?.trim()) {
      credentials.SMTP_FROM = res.from.trim();
    }
    if (res.secure !== undefined) {
      credentials.SMTP_SECURE = String(res.secure);
    }
  }

  // --- Twilio ---
  if (providers.sms === 'twilio') {
    credentials.NOTIFYKIT_SMS_PROVIDER = 'twilio';
    // eslint-disable-next-line no-console
    console.log('\n--- SMS Configuration (Twilio) ---');

    const res = await prompts([
      {
        type: 'text',
        name: 'accountSid',
        message: 'Twilio Account SID (e.g. AC...):',
        validate: (val: string) => (val.trim() ? true : 'Account SID is required'),
      },
      {
        type: 'password',
        name: 'authToken',
        message: 'Twilio Auth Token:',
        validate: (val: string) => (val.trim() ? true : 'Auth Token is required'),
      },
      {
        type: 'text',
        name: 'from',
        message: 'Default Sender Phone Number (e.g. +1234567890, optional):',
      },
      {
        type: 'text',
        name: 'messagingServiceSid',
        message: 'Twilio Messaging Service SID (e.g. MG..., optional):',
      },
    ]);

    if (!res.accountSid || !res.authToken) {
      return null;
    }

    credentials.TWILIO_ACCOUNT_SID = res.accountSid.trim();
    credentials.TWILIO_AUTH_TOKEN = res.authToken;
    if (res.from?.trim()) {
      credentials.TWILIO_FROM = res.from.trim();
    }
    if (res.messagingServiceSid?.trim()) {
      credentials.TWILIO_MESSAGING_SERVICE_SID = res.messagingServiceSid.trim();
    }
  }

  // --- MSG91 ---
  if (providers.sms === 'msg91') {
    credentials.NOTIFYKIT_SMS_PROVIDER = 'msg91';
    // eslint-disable-next-line no-console
    console.log('\n--- SMS Configuration (MSG91) ---');

    const res = await prompts([
      {
        type: 'password',
        name: 'authKey',
        message: 'MSG91 Auth Key:',
        validate: (val: string) => (val.trim() ? true : 'MSG91 Auth Key is required'),
      },
      {
        type: 'text',
        name: 'flowId',
        message: 'MSG91 Flow ID (Template ID approved in DLT):',
        validate: (val: string) => (val.trim() ? true : 'MSG91 Flow ID is required'),
      },
      {
        type: 'text',
        name: 'senderId',
        message: 'MSG91 Sender ID (6-character approved DLT header, optional):',
      },
    ]);

    if (!res.authKey || !res.flowId) {
      return null;
    }

    credentials.MSG91_AUTH_KEY = res.authKey;
    credentials.MSG91_FLOW_ID = res.flowId.trim();
    if (res.senderId?.trim()) {
      credentials.MSG91_SENDER_ID = res.senderId.trim();
    }
  }

  // --- FCM ---
  if (providers.push === 'fcm') {
    credentials.NOTIFYKIT_PUSH_PROVIDER = 'fcm';
    // eslint-disable-next-line no-console
    console.log('\n--- Push Configuration (Firebase Cloud Messaging) ---');

    const formatChoice = await prompts({
      type: 'select',
      name: 'format',
      message: 'How would you like to provide your Firebase Service Account credentials?',
      choices: [
        { title: 'Path to service account JSON file', value: 'path' },
        { title: 'Paste raw service account JSON string', value: 'raw' },
      ],
      initial: 0,
    });

    if (!formatChoice.format) return null;

    if (formatChoice.format === 'path') {
      const pathRes = await prompts({
        type: 'text',
        name: 'filePath',
        message: 'Path to service account JSON file (e.g. ./firebase-service-account.json):',
        validate: (val: string) => {
          if (!val.trim()) return 'Path is required';
          if (!fs.existsSync(val.trim())) return `File not found at ${val.trim()}`;
          return true;
        },
      });

      if (!pathRes.filePath) return null;
      credentials.FCM_SERVICE_ACCOUNT_JSON = pathRes.filePath.trim();
    } else {
      const rawRes = await prompts({
        type: 'password',
        name: 'rawJson',
        message: 'Paste your service account JSON string:',
        validate: (val: string) => {
          try {
            JSON.parse(val);
            return true;
          } catch {
            return 'Invalid JSON string';
          }
        },
      });

      if (!rawRes.rawJson) return null;
      credentials.FCM_SERVICE_ACCOUNT_JSON = rawRes.rawJson.trim();
    }

    const projRes = await prompts({
      type: 'text',
      name: 'projectId',
      message: 'Firebase Project ID (optional if included in service account JSON):',
    });

    if (projRes.projectId?.trim()) {
      credentials.FCM_PROJECT_ID = projRes.projectId.trim();
    }
  }

  return credentials;
}
