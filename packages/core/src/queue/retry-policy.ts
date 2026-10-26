import type { JobsOptions, KeepJobs } from 'bullmq';
import type { QueueChannel } from './payload';

/**
 * Standard retry backoff policy for transient provider/network failures.
 * 3 attempts with exponential backoff starting at 1000ms.
 */
export const DEFAULT_RETRY_POLICY = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
};

/**
 * Channel-specific retention limits per Architecture v1.1 §A.4.2.
 */
export const DEFAULT_RETENTION_POLICIES: Record<
  QueueChannel | 'dlq',
  {
    removeOnComplete: boolean | number | KeepJobs;
    removeOnFail: boolean | number | KeepJobs;
  }
> = {
  email: {
    removeOnComplete: { count: 1000, age: 86400 }, // 24 hours
    removeOnFail: { count: 5000, age: 604800 }, // 7 days
  },
  sms: {
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
  push: {
    removeOnComplete: { count: 5000, age: 86400 },
    removeOnFail: { count: 10000, age: 604800 },
  },
  dlq: {
    removeOnComplete: false,
    removeOnFail: false, // DLQ items retained indefinitely until manual triage
  },
};

/**
 * Returns the default BullMQ job options for a specific channel.
 */
export function getDefaultJobOptions(channel: QueueChannel | 'dlq'): JobsOptions {
  const retention = DEFAULT_RETENTION_POLICIES[channel];
  return {
    ...DEFAULT_RETRY_POLICY,
    removeOnComplete: retention.removeOnComplete,
    removeOnFail: retention.removeOnFail,
  };
}
