import { NotifyKitError } from '../errors/notifykit-error';

/**
 * Thrown when Redis is unreachable, disconnected, or connection handshake fails.
 */
export class RedisUnavailableError extends NotifyKitError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'E_REDIS_UNAVAILABLE',
      message: `Redis connection unavailable: ${message}`,
      hint: 'Verify that Redis is running and REDIS_URL is correctly configured in your environment or NotifierConfig',
      cause,
    });
    this.name = 'RedisUnavailableError';
  }
}

/**
 * Thrown when Redis memory limit (maxmemory) is exceeded (OOM command not allowed).
 */
export class QueueFullError extends NotifyKitError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'E_QUEUE_FULL',
      message: `Queue storage full (Redis OOM): ${message}`,
      hint: 'Redis maxmemory reached. Increase Redis maxmemory, lower retention limits (removeOnComplete/removeOnFail), or prune stale jobs',
      cause,
    });
    this.name = 'QueueFullError';
  }
}
