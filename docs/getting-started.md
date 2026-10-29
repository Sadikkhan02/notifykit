# Getting Started with NotifyKit

Welcome to **NotifyKit**, a code-first, stateless notification orchestration library for Node.js and TypeScript.

This tutorial guides you step-by-step from an empty directory to sending your first multi-channel notification in under **10 minutes**.

---

## 1. Prerequisites

Before installing NotifyKit, ensure your environment meets the minimum version requirements:

- **Node.js:** `>= 20.0.0` (LTS recommended)
- **npm:** `>= 10.0.0` (or compatible pnpm / Yarn / Bun)
- **Redis:** `>= 6.2.0` (required for BullMQ Streams and atomic Lua scripts)

### Starting a Local Redis Instance

If you don't already have a local Redis server running, start one with Docker:

```bash
docker run -d --name notifykit-redis -p 6379:6379 redis:7-alpine
```

Verify connectivity:
```bash
redis-cli ping
# Output: PONG
```

---

## 2. Installation & Setup

You can set up NotifyKit using our interactive CLI wizard or by installing packages manually.

### Option A: The Fast Path (CLI Setup Wizard)

Run the wizard in your project root:

```bash
npm install notifykit
npx notifykit init
```

The interactive wizard prompts you to:
1. Select your target channels (**Email**, **SMS**, **Push**).
2. Choose provider adapters (**Nodemailer**, **Twilio**, **MSG91**, **FCM**).
3. Configure your Redis URL.
4. Securely capture provider credentials with masked inputs.
5. Automatically write a merge-safe `.env` and `.env.example`.
6. Install only the selected adapter packages and peer dependencies.

### Option B: Manual Installation

Install the core library and the specific adapter(s) you need:

```bash
# Core orchestrator
npm install notifykit

# Choose your provider adapters:
npm install @notifykit/adapter-nodemailer nodemailer
npm install @notifykit/adapter-twilio twilio
npm install @notifykit/adapter-msg91
npm install @notifykit/adapter-fcm firebase-admin
```

---

## 3. Configuring the Notifier

Create an application entry point (e.g. `notifier.ts`):

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';
import { TwilioSmsProvider } from '@notifykit/adapter-twilio';

export const notifier = createNotifier({
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  providers: {
    // 1. Email Channel Configuration
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
      from: 'noreply@yourdomain.com',
    },

    // 2. SMS Channel Configuration
    sms: {
      type: 'twilio',
      adapter: new TwilioSmsProvider({
        accountSid: process.env.TWILIO_ACCOUNT_SID || 'AC00000000000000000000000000000000',
        authToken: process.env.TWILIO_AUTH_TOKEN || 'mock_token',
        from: process.env.TWILIO_FROM || '+15555550100',
      }),
      from: process.env.TWILIO_FROM || '+15555550100',
    },
  },
});
```

---

## 4. Registering Templates

NotifyKit uses Handlebars for template compilation. Register your templates fail-fast during application startup:

```typescript
// Register an email template (HTML + variables)
notifier.registerTemplate(
  'welcome-user',
  '<h1>Welcome to Our Platform, {{name}}!</h1>' +
    '<p>Your account was created on {{formatDate createdAt}}.</p>' +
    '<p>Click <a href="{{activationUrl}}">here</a> to activate your profile.</p>',
);

// Register an SMS template (Plaintext + variables)
notifier.registerTemplate(
  'otp-verification',
  'Your verification code is {{otp}}. Valid for 10 minutes. Do not share this code.',
);
```

### Built-in Helpers
- `{{uppercase text}}`: Converts a string to uppercase.
- `{{formatDate timestamp}}`: Formats dates safely.

---

## 5. Dispatching Notifications

To send a notification, invoke `notifier.notify()`:

```typescript
// Enqueue an Email notification
const emailResult = await notifier.notify({
  to: { email: 'jane.doe@example.com' },
  channels: ['email'],
  template: 'welcome-user',
  data: {
    name: 'Jane Doe',
    createdAt: new Date().toISOString(),
    activationUrl: 'https://example.com/activate?token=abc',
  },
});

console.log(`Email enqueued with Job ID: ${emailResult.jobId}`);

// Enqueue an SMS notification
const smsResult = await notifier.notify({
  to: { phone: '+15555550199' }, // E.164 format
  channels: ['sms'],
  template: 'otp-verification',
  data: { otp: '582910' },
});

console.log(`SMS enqueued with Job ID: ${smsResult.jobId}`);
```

> **Important Invariant: Enqueue vs Delivery**
> When `await notifier.notify(...)` resolves, it confirms that your event was validated, pre-rendered, and **durably enqueued into Redis** with an atomic UUIDv7 job ID.
>
> Actual delivery to SMTP servers or telephony carriers happens asynchronously in the background worker.

---

## 6. Starting Queue Workers

To consume and deliver jobs from Redis queues, start the worker:

```typescript
// Start workers for all configured channels
notifier.startWorker({
  channels: ['email', 'sms'],
  concurrency: {
    email: 10, // 10 parallel SMTP connections
    sms: 5,    // 5 parallel SMS requests
  },
});

console.log('NotifyKit workers active and listening for jobs...');
```

---

## 7. Graceful Shutdown

NotifyKit adheres to strict process lifecycle hygiene. In production, always drain active in-flight jobs and close connections before exiting:

```typescript
import { resetDefaultRegistry, closeRedisConnection } from 'notifykit';

async function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Draining queue workers...`);

  // 1. Pause workers and wait for active jobs to complete
  await notifier.stopWorker();

  // 2. Clean up BullMQ queue instances
  await resetDefaultRegistry();

  // 3. Close the shared Redis connection pool
  await closeRedisConnection();

  console.log('Teardown complete. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
```

---

## Next Steps

- **[Architecture Deep-Dive](architecture.md):** Understand the queue topology, retry mechanics, and Dead-Letter Queue (DLQ).
- **[Provider Guides](providers.md):** Detailed configuration and regulatory instructions for Nodemailer, Twilio, MSG91, and FCM.
- **[Troubleshooting Guide](troubleshooting.md):** Common errors, Redis issues, and recovery recipes.
- **[Creating Custom Adapters](adapters.md):** How to write your own provider adapter using `@notifykit/test-utils`.
- **[Redis Data Model](redis.md):** Complete reference of Redis key layouts and retention policies.
