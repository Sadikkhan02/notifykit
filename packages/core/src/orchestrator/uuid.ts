import { randomBytes } from 'node:crypto';

/**
 * Generates an RFC 9562-compliant UUID v7.
 *
 * Structure (128 bits / 16 bytes):
 * - 48 bits: Unix epoch timestamp in milliseconds (big-endian)
 * - 4 bits: Version (0b0111 = 7)
 * - 12 bits: Pseudo-random sequence (rand_a)
 * - 2 bits: Variant (0b10 = RFC 9562 / RFC 4122 variant)
 * - 62 bits: Pseudo-random sequence (rand_b)
 *
 * Provides millisecond-level chronological time-ordering.
 */
export function generateUuidV7(): string {
  const bytes = randomBytes(16);
  const now = Date.now();

  // 48-bit timestamp in milliseconds
  bytes[0] = Math.floor(now / 0x10000000000) & 0xff;
  bytes[1] = Math.floor(now / 0x100000000) & 0xff;
  bytes[2] = Math.floor(now / 0x1000000) & 0xff;
  bytes[3] = Math.floor(now / 0x10000) & 0xff;
  bytes[4] = Math.floor(now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // 4-bit version 7 (0b0111) in bits 48-51
  const b6 = Number(bytes[6]);
  bytes[6] = (b6 & 0x0f) | 0x70;

  // 2-bit variant (0b10) in bits 64-65
  const b8 = Number(bytes[8]);
  bytes[8] = (b8 & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Validates whether a string conforms to canonical RFC 9562 UUID v7 format.
 */
export function isValidUuidV7(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
