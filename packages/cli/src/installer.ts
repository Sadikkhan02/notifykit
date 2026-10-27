import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { ADAPTER_PACKAGES, PEER_DEPENDENCIES } from './constants.js';
import type { PackageManager, Provider, ProviderSelection, InstallResult } from './types.js';

/**
 * Detects the package manager used in the target directory based on lockfiles.
 */
export function detectPackageManager(targetDir: string): PackageManager {
  if (fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(targetDir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (
    fs.existsSync(path.join(targetDir, 'bun.lockb')) ||
    fs.existsSync(path.join(targetDir, 'bun.lock'))
  ) {
    return 'bun';
  }
  return 'npm';
}

/**
 * Collects all package names needed for the selected providers.
 * Includes 'notifykit' if not already installed in the target package.json.
 */
export function resolvePackagesToInstall(
  targetDir: string,
  providers: ProviderSelection,
): string[] {
  const packages: string[] = [];

  // Check if core notifykit is in package.json
  const pkgJsonPath = path.join(targetDir, 'package.json');
  let hasCore = false;
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      if (content.dependencies?.notifykit) {
        hasCore = true;
      }
    } catch {
      // Ignore JSON parse errors in target project
    }
  }

  if (!hasCore) {
    packages.push('notifykit');
  }

  const selectedProviders = Object.values(providers).filter(Boolean) as Provider[];

  for (const provider of selectedProviders) {
    const adapterPkg = ADAPTER_PACKAGES[provider];
    if (adapterPkg) {
      packages.push(adapterPkg);
    }
    const peers = PEER_DEPENDENCIES[provider] ?? [];
    packages.push(...peers);
  }

  // Deduplicate
  return Array.from(new Set(packages));
}

/**
 * Builds the command arguments for the detected package manager.
 */
export function buildInstallCommand(
  pm: PackageManager,
  packages: string[],
): { binary: string; args: string[] } {
  const binary = pm;
  let subCommand = 'install';
  if (pm === 'pnpm' || pm === 'yarn' || pm === 'bun') {
    subCommand = 'add';
  }

  return {
    binary,
    args: [subCommand, ...packages],
  };
}

/**
 * Installs the required adapter packages and vendor peer dependencies.
 * Uses discrete argument arrays with execa to prevent shell injection.
 */
export async function installPackages(
  targetDir: string,
  providers: ProviderSelection,
  pmOverride?: PackageManager,
): Promise<InstallResult> {
  const pm = pmOverride ?? detectPackageManager(targetDir);
  const packages = resolvePackagesToInstall(targetDir, providers);

  if (packages.length === 0) {
    return {
      packageManager: pm,
      packages: [],
      success: true,
    };
  }

  const { binary, args } = buildInstallCommand(pm, packages);

  try {
    await execa(binary, args, {
      cwd: targetDir,
      stdio: 'inherit',
    });

    return {
      packageManager: pm,
      packages,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      packageManager: pm,
      packages,
      success: false,
      error: `Failed to install packages using ${pm}: ${message}`,
    };
  }
}
