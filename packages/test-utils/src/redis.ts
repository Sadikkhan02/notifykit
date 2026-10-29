import { createRedisConnection } from 'notifykit';

const SAFE_LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * Checks whether the given Redis connection string safely points to a local or loopback instance.
 * Fails closed on malformed or non-local URLs to protect external Redis databases from accidental data loss.
 */
export function isSafeLocalRedisUrl(redisUrl: string): boolean {
  if (!redisUrl || typeof redisUrl !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return SAFE_LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Resolves the Redis URL to use for test suites.
 * Throws an explicit error if process.env.REDIS_URL is configured to a non-local host.
 */
export function getSafeLocalRedisUrl(): string {
  const envUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  if (!isSafeLocalRedisUrl(envUrl)) {
    throw new Error(
      `Safety gate: REDIS_URL (${envUrl}) does not point to a safe local loopback address (127.0.0.1, localhost).`,
    );
  }
  return envUrl;
}

/**
 * Safely flushes the test Redis database.
 * Strictly verifies the URL is local before issuing any destructive commands.
 */
export async function cleanupTestRedis(redisUrl: string = getSafeLocalRedisUrl()): Promise<void> {
  if (!isSafeLocalRedisUrl(redisUrl)) {
    throw new Error(
      `Safety gate: Refusing to perform destructive cleanup on non-local Redis instance: "${redisUrl}".`,
    );
  }

  const client = createRedisConnection(redisUrl);
  try {
    await client.flushdb();
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
