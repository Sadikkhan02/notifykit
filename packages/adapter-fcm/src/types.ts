import type { App } from 'firebase-admin/app';
import type { AdapterMetadata } from 'notifykit/interfaces';

/**
 * Standard Firebase service account credential fields.
 */
export interface FcmServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  [key: string]: unknown;
}

/**
 * Structural contract for a Firebase Admin messaging client.
 * Compatible with firebase-admin/messaging and test mocks.
 */
export interface MessagingLike {
  send(message: FcmMessagePayload): Promise<string>;
  [key: string]: unknown;
}

/**
 * Structural contract for a Firebase Admin App instance.
 */
export interface AppLike {
  name: string;
  [key: string]: unknown;
}

/**
 * Notification content payload passed to Firebase Cloud Messaging.
 */
export interface FcmNotificationPayload {
  title?: string;
  body?: string;
}

/**
 * Message payload dispatched to Firebase Cloud Messaging.
 */
export interface FcmMessagePayload {
  token: string;
  notification?: FcmNotificationPayload;
  data?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Configuration options for the FCM push provider.
 */
export interface FcmConfig {
  /** Raw service account JSON string, file path, or parsed service account object */
  serviceAccount?: string | FcmServiceAccount;
  /** Explicit Google Cloud Project ID */
  projectId?: string;
  /** Pre-configured Firebase Admin App instance */
  app?: App | AppLike;
  /** Pre-configured or mocked Firebase Messaging client instance */
  messaging?: MessagingLike;
}

/**
 * Extended metadata interface for the FCM adapter per Master Spec §15 Phase 9.
 * Accurately implements and extends core AdapterMetadata while narrowing channel to 'push'.
 */
export interface FcmAdapterMetadata extends AdapterMetadata {
  name: string;
  channel: 'push';
  requiredEnv: string[];
  /** Package version for runtime compatibility checks */
  version: string;
  /** Peer dependency requirements */
  peerDependencies: Record<string, string>;
}
