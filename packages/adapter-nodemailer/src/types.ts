import type { Transporter } from 'nodemailer';
import type { AdapterMetadata } from 'notifykit/interfaces';

/**
 * Authentication credentials for SMTP server connection.
 */
export interface SmtpAuthOptions {
  user: string;
  pass: string;
}

/**
 * Configuration options for the Nodemailer email provider.
 */
export interface NodemailerConfig {
  /** SMTP server hostname or IP address */
  host?: string;
  /** SMTP server port number (defaults to 587) */
  port?: number;
  /** Whether to enforce TLS connection (defaults to true if port is 465, false otherwise) */
  secure?: boolean;
  /** Authentication credentials */
  auth?: SmtpAuthOptions;
  /** Default sender email address */
  from?: string;
  /** Pre-configured or mocked Nodemailer transporter instance */
  transporter?: Transporter;
}

/**
 * Extended metadata interface for the Nodemailer adapter per Master Spec §12 Phase 6.
 * Accurately implements and extends core AdapterMetadata.
 */
export interface NodemailerAdapterMetadata extends AdapterMetadata {
  name: string;
  channel: 'email';
  requiredEnv: string[];
  /** Package version for runtime compatibility checks */
  version: string;
  /** Peer dependency requirements */
  peerDependencies: Record<string, string>;
}
