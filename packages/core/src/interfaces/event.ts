import type { Recipient } from './recipient';

/**
 * Payload event passed to NotifyKit to trigger a notification.
 */
export interface NotificationEvent {
  /** Target recipient contact details */
  to: Recipient;
  /** Delivery channels to target for this event */
  channels: Array<'email' | 'sms' | 'push'>;
  /** Registered template identifier (e.g., 'welcome-email') */
  template: string;
  /** Key-value variables interpolated into the template */
  data: Record<string, unknown>;
}
