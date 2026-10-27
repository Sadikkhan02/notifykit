import fs from 'node:fs';
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { PushProvider, ProviderResult } from 'notifykit/interfaces';
import { mapFcmError } from './error-mapper.js';
import type { FcmConfig, FcmServiceAccount, MessagingLike, FcmMessagePayload } from './types.js';

const NOTIFYKIT_FCM_APP_NAME = 'notifykit-fcm';

/**
 * Firebase Cloud Messaging push provider adapter implementing NotifyKit PushProvider.
 */
export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';
  private readonly config: FcmConfig;
  private messagingInstance: MessagingLike | null = null;

  constructor(config: FcmConfig = {}) {
    this.config = config;
    if (config.messaging) {
      this.messagingInstance = config.messaging;
    }
  }

  /**
   * Resolves and parses service account credentials from config, env JSON string, or file path.
   */
  private resolveServiceAccount(): FcmServiceAccount | string | null {
    const raw =
      this.config.serviceAccount ??
      process.env.FCM_SERVICE_ACCOUNT_JSON ??
      process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!raw) {
      return null;
    }

    if (typeof raw === 'object') {
      return raw;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // Raw JSON content
      if (trimmed.startsWith('{')) {
        try {
          return JSON.parse(trimmed) as FcmServiceAccount;
        } catch {
          return null;
        }
      }

      // Filesystem path
      if (fs.existsSync(trimmed)) {
        try {
          const content = fs.readFileSync(trimmed, 'utf8');
          return JSON.parse(content) as FcmServiceAccount;
        } catch {
          // Fall back to passing path directly to cert()
          return trimmed;
        }
      }

      return trimmed;
    }

    return null;
  }

  /**
   * Lazily resolves or initializes the Firebase messaging client.
   * Avoids collision with default consumer apps by using dedicated app name 'notifykit-fcm'.
   */
  private getMessagingClient(): MessagingLike | null {
    if (this.messagingInstance) {
      return this.messagingInstance;
    }

    // Injected custom app
    if (this.config.app) {
      this.messagingInstance = getMessaging(this.config.app as App) as unknown as MessagingLike;
      return this.messagingInstance;
    }

    // Check if dedicated notifykit app already exists
    const existingApp = getApps().find((a) => a.name === NOTIFYKIT_FCM_APP_NAME);
    if (existingApp) {
      this.messagingInstance = getMessaging(existingApp) as unknown as MessagingLike;
      return this.messagingInstance;
    }

    const serviceAccount = this.resolveServiceAccount();
    if (!serviceAccount) {
      return null;
    }

    try {
      const app = initializeApp(
        {
          credential: cert(serviceAccount),
          projectId: this.config.projectId,
        },
        NOTIFYKIT_FCM_APP_NAME,
      );

      this.messagingInstance = getMessaging(app) as unknown as MessagingLike;
      return this.messagingInstance;
    } catch {
      return null;
    }
  }

  /**
   * Sends a push notification via Firebase Cloud Messaging.
   *
   * @param opts Push notification options (token, title, body, optional data)
   * @returns Standardized ProviderResult with retryability classification
   */
  async sendPush(opts: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<ProviderResult> {
    if (!opts.token || typeof opts.token !== 'string' || !opts.token.trim()) {
      return {
        success: false,
        error: 'Recipient push token is required',
        retryable: false,
      };
    }

    const messaging = this.getMessagingClient();
    if (!messaging) {
      return {
        success: false,
        error:
          'FCM credentials not configured. Set FCM_SERVICE_ACCOUNT_JSON in environment or pass serviceAccount in config.',
        retryable: false,
      };
    }

    const payload: FcmMessagePayload = {
      token: opts.token.trim(),
      notification: {
        title: opts.title,
        body: opts.body,
      },
    };

    if (opts.data) {
      // Ensure all data values are stringified per FCM protocol requirements
      payload.data = Object.fromEntries(
        Object.entries(opts.data).map(([key, val]) => [key, String(val)]),
      );
    }

    try {
      const messageId = await messaging.send(payload);
      return {
        success: true,
        messageId: typeof messageId === 'string' && messageId.length > 0 ? messageId : undefined,
      };
    } catch (err) {
      return mapFcmError(err);
    }
  }
}
