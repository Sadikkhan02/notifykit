import { describe, it, expect } from 'vitest';
import { hello } from '../src/index';
import type { BaseEvent } from '../src/interfaces/index';

describe('core tooling smoke test', () => {
  it('validates hello fixture', () => {
    expect(hello()).toBe('world');
  });
  it('validates interface fixture type', () => {
    const event: BaseEvent = { test: true };
    expect(event).toBeDefined();
  });
});
