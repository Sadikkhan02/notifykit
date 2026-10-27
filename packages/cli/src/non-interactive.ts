import path from 'node:path';
import { parseAndValidateNonInteractive } from './validator.js';
import { writeEnvFiles } from './env-writer.js';
import { resolvePackagesToInstall, installPackages } from './installer.js';
import { displaySummary, displaySuccess } from './prompts/summary.js';
import type { CliOptions } from './types.js';

/**
 * Runs the non-interactive (headless / CI) NotifyKit setup.
 * Returns process exit code (0 on success, 1 on error).
 */
export async function runNonInteractive(options: CliOptions): Promise<number> {
  const targetDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  /* eslint-disable no-console */

  // Non-TTY enforcement: require --yes
  const isNonTty = !process.stdout.isTTY || !process.stdin.isTTY;
  if (isNonTty && !options.yes) {
    console.error(
      'Error: Non-interactive environment detected. You must specify all required flags and pass --yes.',
    );
    return 1;
  }

  if (!options.yes) {
    console.error('Error: Non-interactive flag mode requires explicit --yes confirmation.');
    return 1;
  }

  let config;
  try {
    config = parseAndValidateNonInteractive(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    return 1;
  }

  const packagesToInstall = resolvePackagesToInstall(targetDir, config.providers);

  if (options.dryRun) {
    displaySummary(config, packagesToInstall, targetDir);
    console.log(
      '[DRY-RUN] Preview complete. No files were written and no packages were installed.',
    );
    return 0;
  }

  // 1. Write environment files
  const envResult = writeEnvFiles(targetDir, config.credentials);

  // 2. Install packages
  let installedPackages: string[] = [];
  if (!options.skipInstall && packagesToInstall.length > 0) {
    console.log('\nInstalling selected packages...');
    const installResult = await installPackages(
      targetDir,
      config.providers,
      options.packageManager,
    );
    if (!installResult.success) {
      console.warn(`\n⚠️  Warning: ${installResult.error}`);
      console.warn(
        `You can manually install them using: npm install ${packagesToInstall.join(' ')}\n`,
      );
    } else {
      installedPackages = installResult.packages;
    }
  }

  // 3. Display success confirmation
  displaySuccess(envResult.writtenKeys, installedPackages);
  return 0;
  /* eslint-enable no-console */
}
