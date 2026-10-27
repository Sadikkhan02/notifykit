import prompts from 'prompts';
import type { Channel } from '../types.js';

/**
 * Prompts the user to select one or more notification channels.
 * Defaults to Email selected.
 */
export async function promptChannels(): Promise<Channel[] | null> {
  const response = await prompts({
    type: 'multiselect',
    name: 'channels',
    message: 'Which notification channels would you like to configure?',
    choices: [
      { title: 'Email', value: 'email', selected: true },
      { title: 'SMS', value: 'sms', selected: false },
      { title: 'Push (Mobile / Web)', value: 'push', selected: false },
    ],
    min: 1,
    hint: '- Space to select. Return to submit',
  });

  if (!response.channels || response.channels.length === 0) {
    return null;
  }

  return response.channels as Channel[];
}
