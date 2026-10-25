import { describe, it, expect } from 'vitest';
import { hello } from '../src/index';
import type { NotificationEvent } from '../src/interfaces/index';

describe('core tooling smoke test', () => {
  it('validates hello fixture', () => {
    expect(hello()).toBe('world');
  });

  it('validates interface fixture type', () => {
    const event: NotificationEvent = {
      to: { email: 'smoke@example.com' },
      channels: ['email'],
      template: 'smoke-template',
      data: { test: true },
    };
    expect(event).toBeDefined();
    expect(event.channels).toContain('email');
  });
});
