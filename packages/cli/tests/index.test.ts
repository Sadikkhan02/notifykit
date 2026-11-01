import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { cliVersion, HELP_TEXT, main } from '../src/index.js';
import * as interactiveModule from '../src/interactive.js';
import * as nonInteractiveModule from '../src/non-interactive.js';

describe('CLI main entrypoint', () => {
  it('exports valid cliVersion and HELP_TEXT', () => {
    expect(cliVersion).toBe('1.0.0');
    expect(HELP_TEXT).toContain('NotifyKit CLI - Setup Wizard');
  });

  it('handles --version and -v flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const code1 = await main(['--version']);
    expect(code1).toBe(0);
    expect(logSpy).toHaveBeenCalledWith('notifykit-cli v1.0.0');

    const code2 = await main(['-v']);
    expect(code2).toBe(0);

    logSpy.mockRestore();
  });

  it('handles --help and -h flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const code1 = await main(['--help']);
    expect(code1).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));

    const code2 = await main(['-h']);
    expect(code2).toBe(0);

    logSpy.mockRestore();
  });

  it('rejects unknown subcommands with exit code 1', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const code = await main(['invalid_cmd']);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));

    errSpy.mockRestore();
  });

  it('dispatches to runNonInteractive when flags are provided', async () => {
    const nonInteractiveSpy = vi
      .spyOn(nonInteractiveModule, 'runNonInteractive')
      .mockResolvedValueOnce(0);

    const code = await main(['init', '--channels=email', '--yes']);
    expect(code).toBe(0);
    expect(nonInteractiveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ channels: 'email', yes: true }),
    );

    nonInteractiveSpy.mockRestore();
  });

  it('dispatches to runInteractiveWizard when in TTY without headless flags', async () => {
    const originalStdinTTY = process.stdin.isTTY;
    const originalStdoutTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    const interactiveSpy = vi
      .spyOn(interactiveModule, 'runInteractiveWizard')
      .mockResolvedValueOnce(0);

    try {
      const code = await main(['init']);
      expect(code).toBe(0);
      expect(interactiveSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalStdinTTY,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalStdoutTTY,
        configurable: true,
      });
      interactiveSpy.mockRestore();
    }
  });

  describe('isDirectExecution canonical realpath detection', () => {
    it('returns false when argv1 is undefined', async () => {
      const { isDirectExecution } = await import('../src/index.js');
      expect(isDirectExecution(undefined)).toBe(false);
    });

    it('safely returns false when path resolution fails', async () => {
      const { isDirectExecution } = await import('../src/index.js');
      expect(isDirectExecution('/nonexistent/path/to/script.js')).toBe(false);
      expect(isDirectExecution('\0invalid-path')).toBe(false);
    });

    it('returns false when an external script named index.js imports the module', async () => {
      const { isDirectExecution } = await import('../src/index.js');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'external-app-'));
      const externalIndex = path.join(tempDir, 'index.js');
      fs.writeFileSync(externalIndex, '// external entrypoint');

      try {
        const isDirect = isDirectExecution(externalIndex);
        expect(isDirect).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('returns true when argv1 resolves to the same realpath as the module', async () => {
      const { isDirectExecution } = await import('../src/index.js');
      const currentModulePath = fileURLToPath(import.meta.url);
      expect(isDirectExecution(currentModulePath, import.meta.url)).toBe(true);
    });

    it('returns true when argv1 is a symlink resolving to the module realpath', async () => {
      const { isDirectExecution } = await import('../src/index.js');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-test-'));
      const targetFile = path.join(tempDir, 'target.js');
      const symlinkFile = path.join(tempDir, 'bin-symlink');

      fs.writeFileSync(targetFile, '// target');
      fs.symlinkSync(targetFile, symlinkFile);

      try {
        const targetUrl = pathToFileURL(targetFile).href;
        expect(isDirectExecution(symlinkFile, targetUrl)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('importing the CLI module does not auto-run main()', async () => {
      // If importing auto-ran main(), process.exit or wizard dispatch would occur
      const mod = await import('../src/index.js');
      expect(typeof mod.main).toBe('function');
      expect(typeof mod.isDirectExecution).toBe('function');
    });
  });
});
