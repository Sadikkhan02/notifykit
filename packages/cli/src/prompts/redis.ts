import prompts from 'prompts';
import { DEFAULT_REDIS_URL } from '../constants.js';

/**
 * Prompts the user for their Redis queue configuration.
 */
export async function promptRedis(): Promise<string | null> {
  const choice = await prompts({
    type: 'select',
    name: 'redisType',
    message: 'Where is your Redis instance?',
    choices: [
      {
        title: 'I have a Redis URL (or using local Redis)',
        value: 'url',
      },
      {
        title: 'I run Redis locally via Docker',
        value: 'docker',
      },
      {
        title: 'I use a managed cloud provider (Upstash / Redis Cloud / Railway)',
        value: 'cloud',
      },
    ],
    initial: 0,
  });

  if (!choice.redisType) {
    return null;
  }

  if (choice.redisType === 'docker') {
    // eslint-disable-next-line no-console
    console.log(
      '\n  Tip: Run Redis locally with:\n  docker run -d --name notifykit-redis -p 6379:6379 redis:alpine\n',
    );
  }

  const urlPrompt = await prompts({
    type: 'text',
    name: 'redisUrl',
    message: 'Enter your Redis connection URL:',
    initial: DEFAULT_REDIS_URL,
    validate: (val: string) =>
      val.startsWith('redis://') || val.startsWith('rediss://')
        ? true
        : 'Redis URL must start with redis:// or rediss://',
  });

  if (!urlPrompt.redisUrl) {
    return null;
  }

  return urlPrompt.redisUrl.trim();
}
