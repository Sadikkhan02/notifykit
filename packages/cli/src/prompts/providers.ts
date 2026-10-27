import prompts from 'prompts';
import type { Channel, ProviderSelection } from '../types.js';

/**
 * Prompts the user to select providers for each chosen channel.
 */
export async function promptProviders(channels: Channel[]): Promise<ProviderSelection | null> {
  const selection: ProviderSelection = {};

  if (channels.includes('email')) {
    const res = await prompts({
      type: 'select',
      name: 'provider',
      message: 'Select an Email provider:',
      choices: [
        {
          title: 'Nodemailer (Universal SMTP server / Gmail / SES / Mailtrap)',
          value: 'nodemailer',
        },
      ],
      initial: 0,
    });
    if (!res.provider) return null;
    selection.email = res.provider;
  }

  if (channels.includes('sms')) {
    const res = await prompts({
      type: 'select',
      name: 'provider',
      message: 'Select an SMS provider:',
      choices: [
        {
          title: 'Twilio (Global reliability & worldwide coverage)',
          value: 'twilio',
        },
        {
          title: 'MSG91 (India-optimized, lower OTP cost, DLT-compliant)',
          value: 'msg91',
        },
      ],
      initial: 0,
    });
    if (!res.provider) return null;
    selection.sms = res.provider;
  }

  if (channels.includes('push')) {
    const res = await prompts({
      type: 'select',
      name: 'provider',
      message: 'Select a Push provider:',
      choices: [
        {
          title: 'Firebase Cloud Messaging (FCM - Android, iOS, Web)',
          value: 'fcm',
        },
      ],
      initial: 0,
    });
    if (!res.provider) return null;
    selection.push = res.provider;
  }

  return selection;
}
