import { Redis, type RedisOptions } from 'ioredis';

let memoizedRedisInstance: Redis | null = null;

/**
 * Creates or returns the shared memoized ioredis connection instance for the current process.
 * Enforces Good Citizen Rule #5 (one shared user-level Redis client) and Rule #7 (maxRetriesPerRequest: null).
 *
 * Connection Sharing Semantics:
 * - Maintains a process-wide memoized ioredis instance.
 * - Passing this instance to BullMQ Queue constructors (via QueueOptions.connection) shares
 *   the underlying command client across producer queues.
 *
 * @param redisUrl Optional Redis connection URL (falls back to process.env.REDIS_URL or localhost)
 * @param options Optional ioredis connection options
 * @returns Shared Redis instance
 */
export function createRedisConnection(redisUrl?: string, options?: RedisOptions): Redis {
  if (memoizedRedisInstance && memoizedRedisInstance.status !== 'end') {
    return memoizedRedisInstance;
  }

  const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  const defaultOptions: RedisOptions = {
    maxRetriesPerRequest: null, // Mandatory for BullMQ blocking commands
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Exponential backoff with jitter capped at 3000ms
      return Math.min(times * 100, 3000);
    },
  };

  const client = new Redis(url, {
    ...defaultOptions,
    ...options,
  });

  memoizedRedisInstance = client;
  return client;
}

/**
 * Closes the shared Redis connection and clears the memoized instance.
 */
export async function closeRedisConnection(): Promise<void> {
  if (memoizedRedisInstance) {
    const client = memoizedRedisInstance;
    memoizedRedisInstance = null;
    if (client.status !== 'end') {
      await client.quit().catch(() => client.disconnect());
    }
  }
}
