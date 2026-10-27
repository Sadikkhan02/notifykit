import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { promptChannels } from './prompts/channels.js';
import { promptProviders } from './prompts/providers.js';
import { promptRedis } from './prompts/redis.js';
import { promptCredentials } from './prompts/credentials.js';
import { displaySummary, promptConfirmation, displaySuccess } from './prompts/summary.js';
import { writeEnvFiles } from './env-writer.js';
import { resolvePackagesToInstall, installPackages } from './installer.js';
import type { CliOptions, WizardConfig } from './types.js';

/**
 * Runs the interactive NotifyKit setup wizard.
 * Returns process exit code (0 for success or clean abort, 1 for fatal error).
 */
export async function runInteractiveWizard(options: CliOptions): Promise<number> {
  const targetDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  /* eslint-disable no-console */

  console.log('\n⚡ Welcome to the NotifyKit Setup Wizard\n');

  // Check for existing .env and confirm reconfiguration
  const envPath = path.join(targetDir, '.env');
  if (fs.existsSync(envPath)) {
    const reconfigurePrompt = await prompts({
      type: 'confirm',
      name: 'reconfigure',
      message:
        'An existing .env file was detected. Would you like to configure/update NotifyKit settings?',
      initial: true,
    });

    if (!reconfigurePrompt.reconfigure) {
      console.log('Setup aborted. Existing .env file was not modified.');
      return 0;
    }
  }

  // 1. Channel selection
  const channels = await promptChannels();
  if (!channels) {
    console.log('\nSetup cancelled.');
    return 0;
  }

  // 2. Provider selection per channel
  const providers = await promptProviders(channels);
  if (!providers) {
    console.log('\nSetup cancelled.');
    return 0;
  }

  // 3. Redis configuration
  const redisUrl = await promptRedis();
  if (!redisUrl) {
    console.log('\nSetup cancelled.');
    return 0;
  }

  // 4. Credential collection
  const credentials = await promptCredentials(providers);
  if (!credentials) {
    console.log('\nSetup cancelled.');
    return 0;
  }

  credentials.REDIS_URL = redisUrl;

  const config: WizardConfig = {
    channels,
    providers,
    redisUrl,
    credentials,
  };

  const packagesToInstall = resolvePackagesToInstall(targetDir, providers);

  // 5. Summary screen
  displaySummary(config, packagesToInstall, targetDir);

  if (options.dryRun) {
    console.log(
      '[DRY-RUN] Preview complete. No files were written and no packages were installed.',
    );
    return 0;
  }

  // 6. Confirmation prompt
  const confirmed = await promptConfirmation();
  if (!confirmed) {
    console.log('\nSetup cancelled. No files were modified.');
    return 0;
  }

  // 7. Write .env and .env.example
  const envResult = writeEnvFiles(targetDir, config.credentials);

  // 8. Install packages
  let installedPackages: string[] = [];
  if (!options.skipInstall && packagesToInstall.length > 0) {
    console.log('\nInstalling selected packages...');
    const installResult = await installPackages(targetDir, providers, options.packageManager);
    if (!installResult.success) {
      console.warn(`\n⚠️  Warning: ${installResult.error}`);
      console.warn(
        `You can manually install them using: npm install ${packagesToInstall.join(' ')}\n`,
      );
    } else {
      installedPackages = installResult.packages;
    }
  }

  // 9. Display success
  displaySuccess(envResult.writtenKeys, installedPackages);
  return 0;
  /* eslint-enable no-console */
}
