import prompts from 'prompts';
import { SENSITIVE_ENV_VARS, STARTER_CODE_SNIPPET, PROVIDER_NAMES } from '../constants.js';
import type { WizardConfig, Provider } from '../types.js';

/**
 * Displays a formatted summary of planned actions with sensitive credentials safely redacted.
 */
export function displaySummary(
  config: WizardConfig,
  packagesToInstall: string[],
  targetDir: string,
): void {
  /* eslint-disable no-console */
  console.log('\n========================================');
  console.log('       NotifyKit Setup Summary');
  console.log('========================================');

  console.log('\nChannels & Providers:');
  for (const channel of config.channels) {
    const prov = config.providers[channel];
    const provLabel = prov ? PROVIDER_NAMES[prov as Provider] : 'None';
    console.log(`  - ${channel.toUpperCase()}: ${provLabel}`);
  }

  console.log('\nTarget Environment:');
  console.log(`  - Location: ${targetDir}`);
  console.log('  - Variables to configure:');
  for (const [key, val] of Object.entries(config.credentials)) {
    if (SENSITIVE_ENV_VARS.has(key)) {
      console.log(`      ${key} = [REDACTED]`);
    } else {
      console.log(`      ${key} = ${val}`);
    }
  }

  console.log('\nPackages to install:');
  if (packagesToInstall.length === 0) {
    console.log('  - None (all packages already installed)');
  } else {
    for (const pkg of packagesToInstall) {
      console.log(`  - ${pkg}`);
    }
  }

  console.log('========================================\n');
  /* eslint-enable no-console */
}

/**
 * Prompts the user to confirm applying the proposed changes.
 */
export async function promptConfirmation(): Promise<boolean> {
  const res = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Proceed with writing configuration and installing packages?',
    initial: true,
  });

  return Boolean(res.proceed);
}

/**
 * Displays the success banner, files modified, and quick starter code snippet.
 */
export function displaySuccess(writtenKeys: string[], installedPackages: string[]): void {
  /* eslint-disable no-console */
  console.log('\n🎉 NotifyKit setup complete!\n');
  console.log(`  - Updated .env and .env.example (${writtenKeys.length} variables configured)`);
  if (installedPackages.length > 0) {
    console.log(`  - Installed packages: ${installedPackages.join(', ')}`);
  }
  console.log('\nNext steps:');
  console.log(STARTER_CODE_SNIPPET);
  /* eslint-enable no-console */
}
