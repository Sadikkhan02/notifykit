import type { AdapterMetadata } from 'notifykit/interfaces';

/**
 * Structural representation of a Twilio message instance returned by the API.
 */
export interface TwilioMessageInstance {
  sid: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Parameter payload passed to Twilio's messages.create method.
 */
export interface TwilioMessageCreateParams {
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
  [key: string]: unknown;
}

/**
 * Minimal structural client contract required by TwilioSmsProvider.
 * Compatible with the official twilio SDK client and test mocks.
 */
export interface TwilioClientLike {
  messages: {
    create(params: TwilioMessageCreateParams): Promise<TwilioMessageInstance>;
  };
}

/**
 * Configuration options for the Twilio SMS provider.
 */
export interface TwilioConfig {
  /** Twilio Account SID (defaults to process.env.TWILIO_ACCOUNT_SID) */
  accountSid?: string;
  /** Twilio Auth Token (defaults to process.env.TWILIO_AUTH_TOKEN) */
  authToken?: string;
  /** Default sender phone number (e.g. '+14155552671') or Messaging Service SID (starts with 'MG') */
  from?: string;
  /** Pre-configured or mocked Twilio client instance */
  client?: TwilioClientLike;
}

/**
 * Extended metadata interface for the Twilio adapter per Master Spec §13 Phase 7.
 * Accurately implements and extends core AdapterMetadata while narrowing channel to 'sms'.
 */
export interface TwilioAdapterMetadata extends AdapterMetadata {
  name: string;
  channel: 'sms';
  requiredEnv: string[];
  /** Package version for runtime compatibility checks */
  version: string;
  /** Peer dependency requirements */
  peerDependencies: Record<string, string>;
}
