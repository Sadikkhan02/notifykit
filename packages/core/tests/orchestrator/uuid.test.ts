import { describe, expect, it } from 'vitest';
import { generateUuidV7, isValidUuidV7 } from '../../src/orchestrator/uuid.js';

describe('UUID v7 Generator (RFC 9562)', () => {
  it('generates a 36-character hyphenated UUID string', () => {
    const id = generateUuidV7();
    expect(id).toHaveLength(36);
    expect(typeof id).toBe('string');
  });

  it('generates UUID with version 7 (0b0111) and variant 2 (0b10)', () => {
    const id = generateUuidV7();
    expect(isValidUuidV7(id)).toBe(true);

    // Version 7 check: 13th character (0-indexed 14) is '7'
    expect(id[14]).toBe('7');

    // Variant check: 17th character (0-indexed 19) is in ['8', '9', 'a', 'b']
    expect(['8', '9', 'a', 'b']).toContain(id[19].toLowerCase());
  });

  it('generates unique IDs across consecutive invocations', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateUuidV7());
    }
    expect(ids.size).toBe(1000);
  });

  it('guarantees millisecond chronological time ordering', async () => {
    const first = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = generateUuidV7();

    // Comparing first 48 bits (first 12 characters excluding hyphens)
    const firstTimestampHex = first.slice(0, 8) + first.slice(9, 13);
    const secondTimestampHex = second.slice(0, 8) + second.slice(9, 13);

    const firstTime = parseInt(firstTimestampHex, 16);
    const secondTime = parseInt(secondTimestampHex, 16);

    expect(secondTime).toBeGreaterThanOrEqual(firstTime);
  });

  it('isValidUuidV7 rejects invalid UUID strings', () => {
    expect(isValidUuidV7('')).toBe(false);
    expect(isValidUuidV7('invalid-uuid')).toBe(false);
    // UUID v4 (not v7)
    expect(isValidUuidV7('c9a646d3-9c61-4cc9-bc55-e24c2fc9355f')).toBe(false);
    // Bad variant
    expect(isValidUuidV7('018f9e60-466d-71b3-000e-6f8d098ef7ab')).toBe(false);
  });
});
