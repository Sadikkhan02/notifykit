import { describe, it, expect } from 'vitest';
import { isSafeLocalRedisUrl, getSafeLocalRedisUrl, cleanupTestRedis } from '../src/index.js';

describe('test-utils redis helpers', () => {
  describe('isSafeLocalRedisUrl', () => {
    it('accepts loopback IPv4, localhost, and IPv6 loopback', () => {
      expect(isSafeLocalRedisUrl('redis://localhost:6379')).toBe(true);
      expect(isSafeLocalRedisUrl('redis://127.0.0.1:6379')).toBe(true);
      expect(isSafeLocalRedisUrl('redis://0.0.0.0:6379')).toBe(true);
      expect(isSafeLocalRedisUrl('redis://[::1]:6379')).toBe(true);
    });

    it('rejects external or cloud hostnames and invalid strings', () => {
      expect(isSafeLocalRedisUrl('redis://my-cloud-redis.upstash.io:6379')).toBe(false);
      expect(isSafeLocalRedisUrl('redis://redis.production.company.internal:6379')).toBe(false);
      expect(isSafeLocalRedisUrl('http://localhost:6379')).toBe(false);
      expect(isSafeLocalRedisUrl('')).toBe(false);
      expect(isSafeLocalRedisUrl('invalid-url')).toBe(false);
    });
  });

  describe('getSafeLocalRedisUrl', () => {
    it('returns default local URL when REDIS_URL is unset or local', () => {
      const original = process.env.REDIS_URL;
      try {
        delete process.env.REDIS_URL;
        expect(getSafeLocalRedisUrl()).toBe('redis://127.0.0.1:6379');
      } finally {
        process.env.REDIS_URL = original;
      }
    });

    it('throws error when REDIS_URL is configured to a non-local host', () => {
      const original = process.env.REDIS_URL;
      try {
        process.env.REDIS_URL = 'redis://remote-redis.com:6379';
        expect(() => getSafeLocalRedisUrl()).toThrow(/Safety gate/);
      } finally {
        process.env.REDIS_URL = original;
      }
    });
  });

  describe('cleanupTestRedis safety guard', () => {
    it('fails closed when passed a non-local URL', async () => {
      await expect(cleanupTestRedis('redis://production.corp.internal:6379')).rejects.toThrow(
        /Safety gate: Refusing to perform destructive cleanup/,
      );
    });
  });
});
