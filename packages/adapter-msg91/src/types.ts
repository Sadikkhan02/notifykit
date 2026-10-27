import type { AdapterMetadata } from 'notifykit/interfaces';

/**
 * Single recipient object in the MSG91 Flow API payload.
 */
export interface Msg91Recipient {
  /** Mobile number with country code without '+' (e.g., '919876543210') */
  mobiles: string;
  /** Dynamic template variables matching template placeholders (e.g., VAR1, OTP) */
  [key: string]: unknown;
}

/**
 * Top-level JSON payload passed to MSG91 Flow API v5.
 */
export interface Msg91FlowPayload {
  /** The Flow ID / template ID from MSG91 dashboard */
  template_id: string;
  /** Optional URL shortening toggle ('1' or '0') */
  short_url?: string;
  /** Optional approved 6-character sender ID / header */
  sender?: string;
  /** List of recipients with variables */
  recipients: Msg91Recipient[];
  [key: string]: unknown;
}

/**
 * Structure of a response from MSG91 Flow API v5.
 */
export interface Msg91ApiResponse {
  /** Response status type: 'success' or 'error' */
  type?: 'success' | 'error' | string;
  /** Request ID / message identifier on success, or human-readable description on error */
  message?: string;
  /** Numeric or string error code if provided by MSG91 */
  code?: number | string;
  /** Additional error or debug details */
  errors?: Record<string, unknown> | unknown[];
  [key: string]: unknown;
}

/**
 * Configuration options for the MSG91 SMS provider.
 */
export interface Msg91Config {
  /** MSG91 Authentication Key (defaults to process.env.MSG91_AUTH_KEY) */
  authKey?: string;
  /** Default Flow ID / template ID (defaults to process.env.MSG91_FLOW_ID) */
  flowId?: string;
  /** Approved 6-character Sender ID / Header (defaults to process.env.MSG91_SENDER_ID) */
  sender?: string;
  /** Custom fetch function for mocking or testing */
  fetch?: typeof fetch;
  /** Custom API base URL (defaults to 'https://control.msg91.com/api/v5/flow') */
  baseUrl?: string;
}

/**
 * Extended metadata interface for the MSG91 adapter per Master Spec §14 Phase 8.
 * Accurately implements and extends core AdapterMetadata while narrowing channel to 'sms'.
 */
export interface Msg91AdapterMetadata extends AdapterMetadata {
  name: string;
  channel: 'sms';
  requiredEnv: string[];
  /** Package version for runtime compatibility checks */
  version: string;
  /** Peer dependency requirements */
  peerDependencies: Record<string, string>;
}
