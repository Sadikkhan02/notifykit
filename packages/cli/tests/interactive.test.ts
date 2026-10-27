import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prompts from 'prompts';
import * as installerModule from '../src/installer.js';
import { runInteractiveWizard } from '../src/interactive.js';

vi.mock('prompts');

describe('CLI interactive wizard', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-interactive-test-'));
  });

  it('completes the full interactive flow and writes files', async () => {
    // 1. Channel selection: email
    // 2. Email provider: nodemailer
    // 3. Redis type: url
    // 4. Redis URL: redis://localhost:6379
    // 5. Credentials: host, port, user, password, from, secure
    // 6. Confirmation: true
    vi.mocked(prompts)
      .mockResolvedValueOnce({ channels: ['email'] }) // promptChannels
      .mockResolvedValueOnce({ provider: 'nodemailer' }) // promptProviders
      .mockResolvedValueOnce({ redisType: 'url' }) // promptRedis (type)
      .mockResolvedValueOnce({ redisUrl: 'redis://localhost:6379' }) // promptRedis (url)
      .mockResolvedValueOnce({
        host: 'smtp.mailtrap.io',
        port: '587',
        user: 'test_user',
        password: 'test_password',
        from: 'noreply@test.com',
        secure: false,
      }) // promptCredentials
      .mockResolvedValueOnce({ proceed: true }); // promptConfirmation

    const installSpy = vi.spyOn(installerModule, 'installPackages').mockResolvedValueOnce({
      packageManager: 'npm',
      packages: ['notifykit', '@notifykit/adapter-nodemailer', 'nodemailer'],
      success: true,
    });

    const code = await runInteractiveWizard({ cwd: tempDir });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.env.example'))).toBe(true);

    const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf8');
    expect(envContent).toContain('SMTP_HOST=smtp.mailtrap.io');
    expect(envContent).toContain('SMTP_PASSWORD=test_password');

    const exampleContent = fs.readFileSync(path.join(tempDir, '.env.example'), 'utf8');
    expect(exampleContent).not.toContain('test_password');
    expect(exampleContent).toContain('SMTP_PASSWORD=your_smtp_password');

    expect(installSpy).toHaveBeenCalled();
  });

  it('exits cleanly without changes if existing .env reconfigure is declined', async () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'PORT=3000\n');

    vi.mocked(prompts).mockResolvedValueOnce({ reconfigure: false });

    const code = await runInteractiveWizard({ cwd: tempDir });

    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(tempDir, '.env'), 'utf8')).toBe('PORT=3000\n');
  });

  it('exits cleanly when user cancels at channels prompt', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({ channels: [] }); // Cancel/empty

    const code = await runInteractiveWizard({ cwd: tempDir });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
  });

  it('exits cleanly when user cancels at summary confirmation', async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ channels: ['sms'] })
      .mockResolvedValueOnce({ provider: 'twilio' })
      .mockResolvedValueOnce({ redisType: 'url' })
      .mockResolvedValueOnce({ redisUrl: 'redis://localhost:6379' })
      .mockResolvedValueOnce({
        accountSid: 'AC123',
        authToken: 'token456',
        from: '+15551234567',
      })
      .mockResolvedValueOnce({ proceed: false }); // User declines

    const code = await runInteractiveWizard({ cwd: tempDir });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
  });

  it('supports --dry-run without modifying disk or running installer', async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ channels: ['email'] })
      .mockResolvedValueOnce({ provider: 'nodemailer' })
      .mockResolvedValueOnce({ redisType: 'url' })
      .mockResolvedValueOnce({ redisUrl: 'redis://localhost:6379' })
      .mockResolvedValueOnce({
        host: 'smtp.mailtrap.io',
        port: '587',
        user: 'u',
        password: 'p',
      });

    const installSpy = vi.spyOn(installerModule, 'installPackages');

    const code = await runInteractiveWizard({ cwd: tempDir, dryRun: true });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(false);
    expect(installSpy).not.toHaveBeenCalled();
  });

  it('supports --skip-install by writing .env but skipping package installation', async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ channels: ['email'] })
      .mockResolvedValueOnce({ provider: 'nodemailer' })
      .mockResolvedValueOnce({ redisType: 'url' })
      .mockResolvedValueOnce({ redisUrl: 'redis://localhost:6379' })
      .mockResolvedValueOnce({
        host: 'smtp.mailtrap.io',
        port: '587',
        user: 'u',
        password: 'p',
      })
      .mockResolvedValueOnce({ proceed: true });

    const installSpy = vi.spyOn(installerModule, 'installPackages');

    const code = await runInteractiveWizard({ cwd: tempDir, skipInstall: true });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.env'))).toBe(true);
    expect(installSpy).not.toHaveBeenCalled();
  });
});
