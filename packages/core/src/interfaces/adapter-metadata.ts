/**
 * Adapter package metadata exported by every NotifyKit adapter.
 */
export interface AdapterMetadata {
  /** Registered provider identifier (e.g., 'twilio') */
  name: string;
  /** Notification channel supported by this adapter */
  channel: 'email' | 'sms' | 'push';
  /** List of environment variable keys required by this adapter */
  requiredEnv: string[];
}
