import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

describe('Built-package consumer test (notifykit/interfaces export contract)', () => {
  const coreDistDir = resolve(__dirname, '../dist');
  const interfacesDts = resolve(coreDistDir, 'interfaces/index.d.ts');
  const interfacesJs = resolve(coreDistDir, 'interfaces/index.js');
  const interfacesCjs = resolve(coreDistDir, 'interfaces/index.cjs');

  it('confirms required built distribution artifacts exist', () => {
    // If running in an unbuilt state, build core first to establish artifacts
    if (!existsSync(interfacesDts) || !existsSync(interfacesJs) || !existsSync(interfacesCjs)) {
      execSync('npm run build --workspace=packages/core', {
        cwd: resolve(__dirname, '../../..'),
        stdio: 'pipe',
      });
    }

    expect(existsSync(interfacesDts)).toBe(true);
    expect(existsSync(interfacesJs)).toBe(true);
    expect(existsSync(interfacesCjs)).toBe(true);
  });

  it('resolves notifykit/interfaces via runtime ESM import through package exports', async () => {
    const esmModule = await import('notifykit/interfaces');
    expect(esmModule).toBeDefined();
    expect(typeof esmModule).toBe('object');
  });

  it('resolves notifykit/interfaces via runtime CommonJS require through package exports', () => {
    const require = createRequire(import.meta.url);
    const cjsModule = require('notifykit/interfaces');
    expect(cjsModule).toBeDefined();
    expect(typeof cjsModule).toBe('object');
  });

  it('compiles an external consumer importing from notifykit/interfaces with tsc', () => {
    const consumerTsconfig = resolve(__dirname, 'fixtures/consumer/tsconfig.json');
    const rootDir = resolve(__dirname, '../../..');

    const result = execSync(`npx tsc --project ${consumerTsconfig}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    expect(result).toBe('');
  });
});
