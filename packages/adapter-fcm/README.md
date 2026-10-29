# `@notifykit/adapter-fcm`

> Mobile & Web Push notification adapter for NotifyKit using Firebase Cloud Messaging (FCM).

This package delivers push notifications across Android, iOS (APNs through FCM), and Web browsers via Google Firebase Cloud Messaging v1 API. It conforms to the `PushProvider` contract, stringifies non-string data payloads, and handles token invalidation gracefully.

---

## Installation

```bash
npm install notifykit @notifykit/adapter-fcm firebase-admin
```

> **Note:** `firebase-admin` is declared as an external peer dependency to allow consumers control over SDK version pinning, Google Cloud environment authentication, and Firebase App pooling.

---

## Configuration & Credentials

FCM requires Google Cloud service account credentials with the **Firebase Cloud Messaging API Admin** role.

### Environment Variables

| Variable                         | Description                                                       |
| :------------------------------- | :---------------------------------------------------------------- |
| `FCM_SERVICE_ACCOUNT_JSON`       | Raw JSON string or file path to your Firebase service account key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Standard Google Cloud SDK credential path fallback                |
| `FCM_PROJECT_ID`                 | Optional explicit Google Cloud Project ID                         |

### Precedence Order

The adapter resolves service account credentials in the following order:

1. Direct `serviceAccount` parameter in `new FcmPushProvider({ serviceAccount: ... })` (object, JSON string, or file path)
2. `process.env.FCM_SERVICE_ACCOUNT_JSON`
3. `process.env.GOOGLE_APPLICATION_CREDENTIALS`
4. Pre-initialized Firebase `app` or `messaging` client injected in options

---

## Usage

```typescript
import { createNotifier } from 'notifykit';
import { FcmPushProvider } from '@notifykit/adapter-fcm';

const pushProvider = new FcmPushProvider({
  // Can be an object, JSON string, or file path:
  serviceAccount: process.env.FCM_SERVICE_ACCOUNT_JSON,
});

const notifier = createNotifier({
  providers: {
    push: {
      type: 'fcm',
      adapter: pushProvider,
    },
  },
});

// Register push notification template
notifier.registerTemplate('new-message', '{{sender}} sent you a new message: {{preview}}');

// Enqueue push notification (returns immediately with jobId)
const { jobId } = await notifier.notify({
  to: { pushToken: 'fcm_device_registration_token_xyz...' },
  channels: ['push'],
  template: 'new-message',
  data: {
    sender: 'Sarah',
    preview: 'Hey, are you free for a call?',
    // Data values are automatically stringified for FCM compliance
    conversationId: 'conv_123',
  },
});

// Start processing push queue
notifier.startWorker({ channels: ['push'], concurrency: 20 });
```

---

## Error Classification & DLQ Routing

FCM error codes are categorized cleanly between transient network/server glitches and permanent token invalidations:

| FCM / Google Error Code                       | Description                            | `retryable` | BullMQ Action                     |
| :-------------------------------------------- | :------------------------------------- | :---------- | :-------------------------------- |
| `messaging/server-unavailable`                | Google FCM backend overloaded          | `true`      | Retried with exponential backoff  |
| `messaging/internal-error`                    | Transient internal Firebase error      | `true`      | Retried with exponential backoff  |
| `messaging/quota-exceeded`                    | Project sending rate throttled         | `true`      | Retried with exponential backoff  |
| `messaging/unknown-error`                     | Unknown network/gateway glitch         | `true`      | Retried with exponential backoff  |
| `messaging/registration-token-not-registered` | Device uninstalled app / token expired | `false`     | Routed directly to DLQ (no retry) |
| `messaging/invalid-registration-token`        | Malformed or corrupted token string    | `false`     | Routed directly to DLQ (no retry) |
| `messaging/mismatched-credential`             | Token belongs to different sender ID   | `false`     | Routed directly to DLQ (no retry) |
| `messaging/authentication-error`              | Invalid service account or expired key | `false`     | Routed directly to DLQ (no retry) |

### Automatic Private Key Sanitization

All error logs and provider results automatically strip private keys (`BEGIN PRIVATE KEY`), bearer tokens, and client secrets.

---

## License

MIT
