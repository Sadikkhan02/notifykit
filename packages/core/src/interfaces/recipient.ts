/**
 * Target recipient contact details for multi-channel notifications.
 */
export interface Recipient {
  /** Target email address (RFC 5322 format) */
  email?: string;
  /** Target phone number in E.164 format (e.g., +14155552671) */
  phone?: string;
  /** Device push registration token (e.g., FCM registration token) */
  pushToken?: string;
}
