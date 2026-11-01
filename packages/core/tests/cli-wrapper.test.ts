import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Core notifykit binary wrapper and CLI entrypoint contract', () => {
  const rootDir = resolve(__dirname, '../../..');
  const corePkgPath = resolve(__dirname, '../package.json');
  const cliPkgPath = resolve(rootDir, 'packages/cli/package.json');
  const coreBinPath = resolve(__dirname, '../bin/notifykit.js');
  const cliDistPath = resolve(rootDir, 'packages/cli/dist/index.js');

  it('declares correct package names, normalized bin paths, and scoped internal dependency', () => {
    const corePkg = JSON.parse(readFileSync(corePkgPath, 'utf8'));
    const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf8'));

    // Core package assertions
    expect(corePkg.name).toBe('@sadikkhan02/notifykit');
    expect(corePkg.bin).toEqual({
      notifykit: 'bin/notifykit.js',
    });
    // Ensure no leading ./
    expect(corePkg.bin.notifykit.startsWith('./')).toBe(false);
    expect(corePkg.dependencies['@sadikkhan02/notifykit-cli']).toBe('^1.0.0');
    expect(corePkg.dependencies['notifykit-cli']).toBeUndefined();

    // CLI package assertions
    expect(cliPkg.name).toBe('@sadikkhan02/notifykit-cli');
    expect(cliPkg.bin).toEqual({
      'notifykit-cli': 'dist/index.js',
    });
    expect(cliPkg.bin['notifykit-cli'].startsWith('./')).toBe(false);
    expect(cliPkg.bin.notifykit).toBeUndefined();
  });

  it('delegates from core bin wrapper to CLI main() on --help with exit code 0', () => {
    expect(existsSync(coreBinPath)).toBe(true);

    const result = spawnSync(process.execPath, [coreBinPath, '--help'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NotifyKit CLI - Setup Wizard');
    expect(result.stdout).toContain('Usage:');
  });

  it('delegates from core bin wrapper to CLI main() on --version with exit code 0', () => {
    const result = spawnSync(process.execPath, [coreBinPath, '--version'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('notifykit-cli v1.0.0');
  });

  it('propagates non-zero exit code on invalid command from core wrapper', () => {
    const result = spawnSync(process.execPath, [coreBinPath, 'invalid-command-name'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command');
  });

  it('runs main() exactly once when CLI is executed directly via Node', () => {
    // If CLI dist is not built yet, build it
    if (!existsSync(cliDistPath)) {
      spawnSync('npm', ['run', 'build', '--workspace=packages/cli'], {
        cwd: rootDir,
        encoding: 'utf8',
      });
    }

    const result = spawnSync(process.execPath, [cliDistPath, '--version'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('notifykit-cli v1.0.0');
  });

  it('does not auto-run main() when CLI package is imported', async () => {
    const cliModule = await import('@sadikkhan02/notifykit-cli');
    expect(typeof cliModule.main).toBe('function');
    expect(typeof cliModule.isDirectExecution).toBe('function');
    expect(cliModule.cliVersion).toBe('1.0.0');
  });
});
