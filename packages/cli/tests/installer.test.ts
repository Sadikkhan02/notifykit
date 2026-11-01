import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as execaModule from 'execa';
import {
  detectPackageManager,
  resolvePackagesToInstall,
  buildInstallCommand,
  installPackages,
} from '../src/installer.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('CLI installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectPackageManager', () => {
    it('detects package managers based on lockfiles', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-pm-test-'));

      try {
        expect(detectPackageManager(tempDir)).toBe('npm');

        fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
        expect(detectPackageManager(tempDir)).toBe('pnpm');
        fs.unlinkSync(path.join(tempDir, 'pnpm-lock.yaml'));

        fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');
        expect(detectPackageManager(tempDir)).toBe('yarn');
        fs.unlinkSync(path.join(tempDir, 'yarn.lock'));

        fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
        expect(detectPackageManager(tempDir)).toBe('bun');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('resolvePackagesToInstall', () => {
    it('includes @sadikkhan02/notifykit when target package.json does not have it', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-pkg-test-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'my-app', dependencies: {} }),
        );

        const pkgs = resolvePackagesToInstall(tempDir, { email: 'nodemailer' });
        expect(pkgs).toContain('@sadikkhan02/notifykit');
        expect(pkgs).toContain('@sadikkhan02/adapter-nodemailer');
        expect(pkgs).toContain('nodemailer');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('omits @sadikkhan02/notifykit if already present in dependencies', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-pkg-test-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'my-app', dependencies: { '@sadikkhan02/notifykit': '^1.0.0' } }),
        );

        const pkgs = resolvePackagesToInstall(tempDir, { email: 'nodemailer' });
        expect(pkgs).not.toContain('@sadikkhan02/notifykit');
        expect(pkgs).toContain('@sadikkhan02/adapter-nodemailer');
        expect(pkgs).toContain('nodemailer');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('omits @sadikkhan02/notifykit if legacy notifykit is present in dependencies', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-pkg-test-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'my-app', dependencies: { notifykit: '^0.0.1' } }),
        );

        const pkgs = resolvePackagesToInstall(tempDir, { email: 'nodemailer' });
        expect(pkgs).not.toContain('@sadikkhan02/notifykit');
        expect(pkgs).toContain('@sadikkhan02/adapter-nodemailer');
        expect(pkgs).toContain('nodemailer');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('resolves correct packages for all four providers', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-pkg-test-'));
      try {
        const twilioPkgs = resolvePackagesToInstall(tempDir, { sms: 'twilio' });
        expect(twilioPkgs).toContain('@sadikkhan02/adapter-twilio');
        expect(twilioPkgs).toContain('twilio');

        const msg91Pkgs = resolvePackagesToInstall(tempDir, { sms: 'msg91' });
        expect(msg91Pkgs).toContain('@sadikkhan02/adapter-msg91');
        // MSG91 uses native fetch - no vendor SDK
        expect(msg91Pkgs).not.toContain('msg91');

        const fcmPkgs = resolvePackagesToInstall(tempDir, { push: 'fcm' });
        expect(fcmPkgs).toContain('@sadikkhan02/adapter-fcm');
        expect(fcmPkgs).toContain('firebase-admin');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('buildInstallCommand', () => {
    it('builds npm install command', () => {
      const cmd = buildInstallCommand('npm', [
        '@sadikkhan02/notifykit',
        '@sadikkhan02/adapter-twilio',
      ]);
      expect(cmd).toEqual({
        binary: 'npm',
        args: ['install', '@sadikkhan02/notifykit', '@sadikkhan02/adapter-twilio'],
      });
    });

    it('builds pnpm add command', () => {
      const cmd = buildInstallCommand('pnpm', ['@sadikkhan02/notifykit']);
      expect(cmd).toEqual({
        binary: 'pnpm',
        args: ['add', '@sadikkhan02/notifykit'],
      });
    });

    it('builds yarn add command', () => {
      const cmd = buildInstallCommand('yarn', ['@sadikkhan02/notifykit']);
      expect(cmd).toEqual({
        binary: 'yarn',
        args: ['add', '@sadikkhan02/notifykit'],
      });
    });

    it('builds bun add command', () => {
      const cmd = buildInstallCommand('bun', ['@sadikkhan02/notifykit']);
      expect(cmd).toEqual({
        binary: 'bun',
        args: ['add', '@sadikkhan02/notifykit'],
      });
    });
  });

  describe('installPackages', () => {
    it('executes execa with discrete argument array on success', async () => {
      vi.mocked(execaModule.execa).mockResolvedValueOnce(
        {} as unknown as ReturnType<typeof execaModule.execa>,
      );

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-install-test-'));
      try {
        const result = await installPackages(tempDir, { sms: 'twilio' }, 'npm');

        expect(result.success).toBe(true);
        expect(result.packageManager).toBe('npm');
        expect(execaModule.execa).toHaveBeenCalledWith(
          'npm',
          ['install', '@sadikkhan02/notifykit', '@sadikkhan02/adapter-twilio', 'twilio'],
          expect.objectContaining({ cwd: tempDir, stdio: 'inherit' }),
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('gracefully catches installer errors and returns failure result', async () => {
      vi.mocked(execaModule.execa).mockRejectedValueOnce(
        new Error('ENETUNREACH: network is unreachable'),
      );

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-install-test-'));
      try {
        const result = await installPackages(tempDir, { email: 'nodemailer' }, 'pnpm');

        expect(result.success).toBe(false);
        expect(result.error).toContain('ENETUNREACH: network is unreachable');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
