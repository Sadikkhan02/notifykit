/**
 * Standardized result returned by provider adapters after attempting delivery.
 */
export interface ProviderResult {
  /** True if the provider accepted or delivered the notification */
  success: boolean;
  /** Unique provider-assigned message identifier (e.g., Twilio Message SID, SMTP Message-ID) */
  messageId?: string;
  /** Human-readable error message if delivery failed */
  error?: string;
  /**
   * Whether the failure is transient and can be retried by the queue worker.
   * True for 429/5xx/network timeouts; false for invalid credentials or malformed recipients.
   */
  retryable?: boolean;
  /** Suggested backoff duration in milliseconds before retrying (e.g., for rate limits) */
  retryAfterMs?: number;
}
