import { z } from 'zod';
import type { Recipient } from '../interfaces/recipient';

/**
 * Standard channels supported by NotifyKit queue producers.
 */
export type QueueChannel = 'email' | 'sms' | 'push';

/**
 * Standard recipient validation schema matching Recipient interface.
 */
export const recipientSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pushToken: z.string().optional(),
});

/**
 * Metadata associated with an enqueued notification job.
 */
export interface NotificationJobMetadata {
  enqueuedAt: number;
  userId?: string;
  traceId: string;
}

/**
 * Notification job payload contract matching Architecture v1.1 §8.2.
 */
export interface NotificationJob {
  /** Sortable UUID v7 identifier */
  id: string;
  /** Delivery channel */
  channel: QueueChannel;
  /** Target provider key or adapter name */
  provider: string;
  /** Recipient contact details */
  to: Recipient;
  /** Source template identifier */
  templateId: string;
  /** Pre-rendered content body per ADR-004 */
  renderedBody: string;
  /** Rendered template variables retained for diagnostics and auditing */
  variables?: Record<string, string>;
  /** Job execution and tracing metadata */
  metadata: NotificationJobMetadata;
}

/**
 * Runtime Zod validation schema for NotificationJob.
 */
export const notificationJobSchema = z.object({
  id: z.string().min(1, 'Job ID cannot be empty'),
  channel: z.enum(['email', 'sms', 'push'], {
    errorMap: () => ({ message: 'Channel must be "email", "sms", or "push"' }),
  }),
  provider: z.string().min(1, 'Provider identifier cannot be empty'),
  to: recipientSchema,
  templateId: z.string().min(1, 'templateId cannot be empty'),
  renderedBody: z.string(),
  variables: z.record(z.string()).optional(),
  metadata: z.object({
    enqueuedAt: z.number().int().positive(),
    userId: z.string().optional(),
    traceId: z.string().min(1, 'traceId cannot be empty'),
  }),
});
