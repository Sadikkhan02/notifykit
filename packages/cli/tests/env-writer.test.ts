import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  formatEnvValue,
  parseEnvLines,
  mergeEnvContent,
  mergeExampleContent,
  writeEnvFiles,
} from '../src/env-writer.js';

describe('CLI env-writer', () => {
  describe('formatEnvValue', () => {
    it('returns simple values unchanged', () => {
      expect(formatEnvValue('simple_string')).toBe('simple_string');
      expect(formatEnvValue('587')).toBe('587');
      expect(formatEnvValue('redis://localhost:6379')).toBe('redis://localhost:6379');
    });

    it('wraps and escapes values with spaces, newlines, hashes, or quotes', () => {
      expect(formatEnvValue('hello world')).toBe('"hello world"');
      expect(formatEnvValue('line1\nline2')).toBe('"line1\\nline2"');
      expect(formatEnvValue('has # hash')).toBe('"has # hash"');
      expect(formatEnvValue('quote"inside')).toBe('"quote\\"inside"');
    });
  });

  describe('parseEnvLines', () => {
    it('parses comments, blanks, and key-value pairs', () => {
      const content = `# Comment line\n\nPORT=3000\nDATABASE_URL=postgres://localhost/mydb\n`;
      const lines = parseEnvLines(content);

      expect(lines[0]).toEqual({ type: 'comment', raw: '# Comment line' });
      expect(lines[1]).toEqual({ type: 'blank', raw: '' });
      expect(lines[2]).toEqual({ type: 'pair', raw: 'PORT=3000', key: 'PORT', value: '3000' });
      expect(lines[3]).toEqual({
        type: 'pair',
        raw: 'DATABASE_URL=postgres://localhost/mydb',
        key: 'DATABASE_URL',
        value: 'postgres://localhost/mydb',
      });
    });
  });

  describe('mergeEnvContent', () => {
    it('creates new content with section header if existing is empty', () => {
      const { mergedContent, writtenKeys } = mergeEnvContent('', {
        REDIS_URL: 'redis://localhost:6379',
        NOTIFYKIT_EMAIL_PROVIDER: 'nodemailer',
      });

      expect(mergedContent).toContain('# --- NotifyKit Configuration ---');
      expect(mergedContent).toContain('REDIS_URL=redis://localhost:6379');
      expect(mergedContent).toContain('NOTIFYKIT_EMAIL_PROVIDER=nodemailer');
      expect(writtenKeys).toEqual(['REDIS_URL', 'NOTIFYKIT_EMAIL_PROVIDER']);
    });

    it('preserves unrelated existing variables and comments untouched', () => {
      const existing = `# App Config\nPORT=8080\nDATABASE_URL=postgres://prod\n`;
      const { mergedContent, preservedKeys } = mergeEnvContent(existing, {
        REDIS_URL: 'redis://redis:6379',
      });

      expect(mergedContent).toContain('# App Config');
      expect(mergedContent).toContain('PORT=8080');
      expect(mergedContent).toContain('DATABASE_URL=postgres://prod');
      expect(mergedContent).toContain('REDIS_URL=redis://redis:6379');
      expect(preservedKeys).toEqual(['PORT', 'DATABASE_URL']);
    });

    it('updates existing NotifyKit keys in-place without duplicating', () => {
      const existing = `# Config\nPORT=3000\nREDIS_URL=redis://old:6379\n`;
      const { mergedContent } = mergeEnvContent(existing, {
        REDIS_URL: 'redis://new:6379',
      });

      expect(mergedContent).toContain('REDIS_URL=redis://new:6379');
      expect(mergedContent).not.toContain('redis://old:6379');
      const redisMatches = mergedContent.match(/REDIS_URL/g);
      expect(redisMatches?.length).toBe(1);
    });

    it('is idempotent when run repeatedly', () => {
      const step1 = mergeEnvContent('', {
        REDIS_URL: 'redis://localhost:6379',
        TWILIO_ACCOUNT_SID: 'AC123',
      }).mergedContent;

      const step2 = mergeEnvContent(step1, {
        REDIS_URL: 'redis://localhost:6379',
        TWILIO_ACCOUNT_SID: 'AC123',
      }).mergedContent;

      expect(step1).toBe(step2);
      const headerMatches = step2.match(/# --- NotifyKit Configuration ---/g);
      expect(headerMatches?.length).toBe(1);
    });
  });

  describe('mergeExampleContent', () => {
    it('writes placeholder values without leaking secrets', () => {
      const realSecrets = {
        SMTP_PASSWORD: 'super_secret_password_12345',
        TWILIO_AUTH_TOKEN: 'secret_twilio_token_99999',
      };

      const exampleContent = mergeExampleContent('', realSecrets);

      expect(exampleContent).not.toContain('super_secret_password_12345');
      expect(exampleContent).not.toContain('secret_twilio_token_99999');
      expect(exampleContent).toContain('SMTP_PASSWORD=your_smtp_password');
      expect(exampleContent).toContain('TWILIO_AUTH_TOKEN=your_twilio_auth_token');
    });
  });

  describe('writeEnvFiles', () => {
    it('writes .env and .env.example files to disk safely', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notifykit-env-test-'));

      try {
        const res = writeEnvFiles(tempDir, {
          REDIS_URL: 'redis://localhost:6379',
          SMTP_HOST: 'smtp.mailtrap.io',
        });

        expect(fs.existsSync(res.envPath)).toBe(true);
        expect(fs.existsSync(res.examplePath)).toBe(true);

        const envSaved = fs.readFileSync(res.envPath, 'utf8');
        expect(envSaved).toContain('REDIS_URL=redis://localhost:6379');
        expect(envSaved).toContain('SMTP_HOST=smtp.mailtrap.io');

        const exampleSaved = fs.readFileSync(res.examplePath, 'utf8');
        expect(exampleSaved).toContain('SMTP_HOST=smtp.example.com');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
