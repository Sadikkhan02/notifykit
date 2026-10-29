# `notifykit` (Core)

> Code-first, stateless notification orchestration library for Node.js and TypeScript.

`notifykit` provides a unified, multi-channel notification engine powered by BullMQ and Redis. It allows applications to enqueue notifications fail-fast, pre-render templates reliably in memory, and deliver messages across Email, SMS, and Push notification channels with durable retry logic, automatic error classification, and dead-letter queue (DLQ) protection.

---

## Features

- **Unified Multi-Channel API**: Single `notifier.notify()` method targeting Email, SMS, and Push simultaneously.
- **Durable Queueing with BullMQ**: Persistent background job processing backed by Redis streams.
- **Fail-Fast In-Memory Pre-Rendering**: Templates render _before_ queueing (ADR-004), preventing syntax errors or missing variables from entering Redis.
- **Exponential Backoff Retries**: Automatic retries for transient provider/network glitches (up to 5 attempts with jitter).
- **Dead-Letter Queue (DLQ)**: Automatic isolation of non-retryable failures (invalid phone numbers, malformed emails, authentication rejections).
- **Correlation & Distributed Tracing**: Every event generates a chronological UUIDv7 trace ID propagated across queues, workers, logs, and adapter calls.
- **Automatic Secret & PII Redaction**: Sensitive fields (`auth.pass`, `token`, `phone`, `email`, `authorization`) are stripped in structured logs.
- **Pluggable Adapter Architecture**: Compatible with official adapters for Nodemailer, Twilio, MSG91, and Firebase Cloud Messaging (FCM).

---

## Installation

```bash
npm install notifykit
```

Install the adapters you need:

```bash
# Email (Universal SMTP, SendGrid, Gmail, Mailtrap)
npm install @notifykit/adapter-nodemailer nodemailer

# SMS (Twilio)
npm install @notifykit/adapter-twilio twilio

# SMS (MSG91 - India DLT optimized, native fetch, zero vendor SDK)
npm install @notifykit/adapter-msg91

# Push (Firebase Cloud Messaging)
npm install @notifykit/adapter-fcm firebase-admin
```

---

## Quick Start

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

// 1. Initialize the Notifier
const notifier = createNotifier({
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  providers: {
    email: {
      type: 'nodemailer',
      adapter: new NodemailerEmailProvider({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || 'mock_user',
          pass: process.env.SMTP_PASSWORD || 'mock_pass',
        },
      }),
      from: 'noreply@example.com',
    },
  },
});

// 2. Register a template
notifier.registerTemplate(
  'welcome-email',
  '<h1>Welcome, {{name}}!</h1><p>Your account is ready.</p>',
);

// 3. Enqueue notification (guarantees durable Redis acceptance)
const { jobId } = await notifier.notify({
  to: { email: 'user@example.com' },
  channels: ['email'],
  template: 'welcome-email',
  data: { name: 'Alice' },
});

console.log(`Notification enqueued with ID: ${jobId}`);

// 4. Start processing background queues
notifier.startWorker({ channels: ['email'], concurrency: 5 });

// 5. Gracefully shutdown on termination signals
process.on('SIGINT', async () => {
  await notifier.stopWorker();
  process.exit(0);
});
```

---

## Core API Reference

### `createNotifier(options?: CreateNotifierOptions): Notifier`

Factory function that creates a configured `Notifier` orchestrator instance.

#### Options (`CreateNotifierOptions`)

| Option      | Type                          | Description                                                                                 |
| :---------- | :---------------------------- | :------------------------------------------------------------------------------------------ |
| `redis`     | `string`                      | Redis connection URL (e.g., `redis://localhost:6379`). Defaults to `process.env.REDIS_URL`. |
| `providers` | `NotifierConfig['providers']` | Channel providers map (`email`, `sms`, `push`).                                             |
| `templates` | `Record<string, string>`      | Initial template dictionary `[id]: source`.                                                 |
| `logLevel`  | `LogLevel`                    | Pino logging level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`).          |
| `logger`    | `Logger`                      | Custom Pino logger instance.                                                                |

---

### `notifier.notify(event: NotificationEvent): Promise<NotifyResult>`

Validates the event, pre-renders the template in-memory, resolves channel adapters, and atomically enqueues jobs to Redis.

> **Important Distinction: Enqueue vs Delivery**
> `await notifier.notify(...)` resolves as soon as the notification is safely persisted in the Redis queue. It returns `{ jobId: string }`. Actual transmission to SMTP, Twilio, MSG91, or FCM happens asynchronously in the background worker.

#### Event Schema (`NotificationEvent`)

```typescript
export interface NotificationEvent {
  to: {
    email?: string; // RFC 5322 formatted email
    phone?: string; // E.164 formatted phone number (+15555550100)
    pushToken?: string; // FCM device registration token
  };
  channels: Array<'email' | 'sms' | 'push'>;
  template: string; // Registered template ID
  data: Record<string, unknown>; // Template variables
}
```

---

### `notifier.registerTemplate(id: string, source: string): void`

Compiles and caches a Handlebars template in memory. Supports built-in helpers:

- `{{uppercase text}}`: Converts text to uppercase.
- `{{formatDate timestamp}}`: Formats dates safely.

---

### `notifier.startWorker(options?: StartWorkerOptions): void`

Starts BullMQ queue workers to consume and dispatch enqueued notifications.

```typescript
notifier.startWorker({
  channels: ['email', 'sms'], // Channels to process (defaults to all configured)
  concurrency: { email: 10, sms: 5 }, // Global number or per-channel overrides
});
```

---

### `notifier.stopWorker(): Promise<void>`

Drains active in-flight jobs and pauses queue workers cleanly. Call this before application process exit.

---

### Global Connection Teardown

For standalone scripts and automated testing, close queue instances and the shared Redis connection pool:

```typescript
import { resetDefaultRegistry, closeRedisConnection } from 'notifykit';

await notifier.stopWorker();
await resetDefaultRegistry();
await closeRedisConnection();
```

---

## Retry Policy & Dead Letter Queue (DLQ)

NotifyKit adheres to strict delivery resilience policies:

1. **Transient Errors (`retryable: true`)**:
   - Connection timeouts, HTTP 429 rate limits, and 5xx gateway errors are automatically retried up to **5 times**.
   - Backoff strategy: Exponential backoff with random jitter (`1s`, `2s`, `4s`, `8s`, `16s`).
2. **Terminal Errors (`retryable: false`)**:
   - Invalid phone numbers (e.g. Twilio `21211`), DLT registration rejections (MSG91), unregistered push tokens (FCM), or authentication failures immediately bypass retries and are routed directly to `bull:notifykit:dlq:*`.
   - DLQ jobs are retained indefinitely for post-mortem analysis.

---

## License

MIT
