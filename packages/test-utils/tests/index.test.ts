import { describe, it, expect } from 'vitest';
import { isTestUtils } from '../src/index';

describe('test-utils tooling smoke test', () => {
  it('validates test-utils skeleton fixture', () => {
    expect(isTestUtils).toBe(true);
  });
});
