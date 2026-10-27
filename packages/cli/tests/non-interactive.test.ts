import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as installerModule from '../src/installer.js';
import { runNonInteractive } from '../src/non-interactive.js';

describe('CLI non-interactive / headless mode', () => {
  let tempDir: string;
  let stdoutChunks: string[] = [];
  let stderrChunks: string[] = [];

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-noninteractive-test-'));
    stdoutChunks = [];
    stderrChunks = [];

    process.stdout.write = vi.fn().mockImplementation((chunk: string) => {
      stdoutChunks.push(chunk);
      return true;
    });
    process.stderr.write = vi.fn().mockImplementation((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('fails with code 1 and error message if --yes is not provided in non-TTY', async () => {
    const originalIsTTY = process.stdout.isTTY;
    // Simulate non-TTY environment
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    try {
      const code = await runNonInteractive({
        cwd: tempDir,
        channels: 'sms',
        sms: 'twilio',
        twilioSid: 'AC123',
        twilioToken: 'token456',
        // missing --yes
      });

      expect(code).toBe(1);
      expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
    }
  });

  it('fails with code 1 if required credentials are missing', async () => {
    const code = await runNonInteractive({
      cwd: tempDir,
      channels: 'sms',
      sms: 'twilio',
      twilioSid: 'AC123',
      // missing twilioToken
      yes: true,
    });

    expect(code).toBe(1);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
  });

  it('executes successfully with full flags and --yes', async () => {
    const installSpy = vi.spyOn(installerModule, 'installPackages').mockResolvedValueOnce({
      packageManager: 'npm',
      packages: ['notifykit', '@notifykit/adapter-twilio', 'twilio'],
      success: true,
    });

    const secretToken = 'super_secret_auth_token_98765';

    const code = await runNonInteractive({
      cwd: tempDir,
      channels: 'sms',
      sms: 'twilio',
      twilioSid: 'AC_test_account_sid',
      twilioToken: secretToken,
      twilioFrom: '+15559876543',
      yes: true,
    });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(true);

    const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf8');
    expect(envContent).toContain('TWILIO_ACCOUNT_SID=AC_test_account_sid');
    expect(envContent).toContain(`TWILIO_AUTH_TOKEN=${secretToken}`);

    // Verify zero secret leakage in stdout or stderr
    const allStdout = stdoutChunks.join('');
    const allStderr = stderrChunks.join('');
    expect(allStdout).not.toContain(secretToken);
    expect(allStderr).not.toContain(secretToken);

    expect(installSpy).toHaveBeenCalled();
  });

  it('supports --dry-run without modifying files', async () => {
    const installSpy = vi.spyOn(installerModule, 'installPackages');

    const code = await runNonInteractive({
      cwd: tempDir,
      channels: 'email',
      email: 'nodemailer',
      smtpHost: 'smtp.mail.io',
      smtpPort: '587',
      smtpUser: 'u',
      smtpPassword: 'p',
      dryRun: true,
      yes: true,
    });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
    expect(installSpy).not.toHaveBeenCalled();
  });

  it('supports --skip-install without calling installer', async () => {
    const installSpy = vi.spyOn(installerModule, 'installPackages');

    const code = await runNonInteractive({
      cwd: tempDir,
      channels: 'push',
      push: 'fcm',
      fcmServiceAccountJson: '{"project_id":"fcm-proj"}',
      skipInstall: true,
      yes: true,
    });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(true);
    expect(installSpy).not.toHaveBeenCalled();
  });
});
