import { describe, it, expect } from 'vitest';
import { cliVersion } from '../src/index';

describe('cli tooling smoke test', () => {
  it('validates cli entry fixture', () => {
    expect(cliVersion).toBe('0.0.1');
  });
});
