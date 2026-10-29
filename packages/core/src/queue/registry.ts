import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { NotifyKitError } from '../errors/notifykit-error.js';
import type { NotificationJob, QueueChannel } from './payload';

export type LogicalQueueName = `notifykit:${QueueChannel | 'dlq'}`;

export interface QueueRegistryOptions {
  /**
   * BullMQ key prefix.
   * Defaults to 'bull:notifykit' so that generated Redis keys strictly
   * follow 'bull:notifykit:<channel>:*' while honoring BullMQ's runtime constraint
   * forbidding ':' characters in queue names.
   */
  prefix?: string;
}

/**
 * Manages BullMQ Queue producer instances across all notification channels and DLQ.
 * Reuses the single shared ioredis connection across all 4 queues.
 *
 * Queue Naming Architecture:
 * - Public logical queue names follow 'notifykit:<channel>' (e.g. 'notifykit:email').
 * - Internal BullMQ queue names are '<channel>' (e.g. 'email') with prefix 'bull:notifykit'.
 * - Resulting Redis keys are 'bull:notifykit:<channel>:<subKey>' per Architecture §A.4.1.
 */
export class QueueRegistry {
  private readonly connection: Redis;
  private readonly prefix: string;
  private readonly queuesByChannel: Map<QueueChannel | 'dlq', Queue<NotificationJob>> = new Map();

  constructor(connection: Redis, options?: QueueRegistryOptions) {
    this.connection = connection;
    this.prefix = options?.prefix ?? 'bull:notifykit';

    const channels: Array<QueueChannel | 'dlq'> = ['email', 'sms', 'push', 'dlq'];
    for (const channel of channels) {
      // BullMQ queue name is bare channel identifier (contains no ':')
      // Combined with prefix 'bull:notifykit', generated Redis keys are 'bull:notifykit:<channel>:*'
      const queue = new Queue<NotificationJob>(channel, {
        connection: this.connection,
        prefix: this.prefix,
      });
      this.queuesByChannel.set(channel, queue);
    }
  }

  /**
   * Resolves channel or logical queue name into standard channel identifier.
   */
  private resolveChannel(
    channelOrLogicalName: QueueChannel | 'dlq' | LogicalQueueName,
  ): QueueChannel | 'dlq' {
    if (channelOrLogicalName.startsWith('notifykit:')) {
      return channelOrLogicalName.replace('notifykit:', '') as QueueChannel | 'dlq';
    }
    return channelOrLogicalName as QueueChannel | 'dlq';
  }

  /**
   * Retrieves the BullMQ Queue instance for a specific channel or DLQ.
   * Accepts either bare channel ('email', 'sms', 'push', 'dlq')
   * or public logical queue name ('notifykit:email', 'notifykit:sms', 'notifykit:push', 'notifykit:dlq').
   */
  getQueue(channelOrLogicalName: QueueChannel | 'dlq' | LogicalQueueName): Queue<NotificationJob> {
    const channel = this.resolveChannel(channelOrLogicalName);
    const queue = this.queuesByChannel.get(channel);
    if (!queue) {
      throw new NotifyKitError({
        code: 'E_QUEUE_NOT_REGISTERED',
        message: `Queue for channel "${channelOrLogicalName}" is not registered.`,
        hint: `Specify a valid registered channel ('email', 'sms', 'push', or 'dlq') or logical name (e.g. 'notifykit:email').`,
      });
    }
    return queue;
  }

  /**
   * Retrieves all registered queue instances keyed by their public logical queue name ('notifykit:<channel>').
   */
  getAllQueues(): Map<LogicalQueueName, Queue<NotificationJob>> {
    const map = new Map<LogicalQueueName, Queue<NotificationJob>>();
    for (const [channel, queue] of this.queuesByChannel.entries()) {
      map.set(`notifykit:${channel}`, queue);
    }
    return map;
  }

  /**
   * Gracefully closes all registered queue instances.
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queuesByChannel.values()).map((q) => q.close());
    await Promise.all(closePromises);
    this.queuesByChannel.clear();
  }

  /**
   * Retrieves the underlying Redis connection instance used by this registry.
   */
  getConnection(): Redis {
    return this.connection;
  }
}
