# NotifyKit Email-Only Example

This example demonstrates single-channel email delivery using the `@notifykit/adapter-nodemailer` adapter.

---

## What This Example Demonstrates

1. **Configuration:** Initializing `createNotifier` with `NodemailerEmailProvider`.
2. **Template Registration:** Registering a Handlebars email template with built-in helpers (`{{formatDate}}`, `{{uppercase}}`).
3. **Enqueue Acceptance:** Pre-rendering the template in-memory and enqueuing to Redis, returning `{ jobId }`.
4. **Asynchronous Worker:** Starting the background BullMQ worker with concurrency limits.
5. **Graceful Shutdown:** Draining in-flight jobs and releasing Redis resources on termination.

---

## Setup & Running

### 1. Prerequisites

Start a local Redis instance:

```bash
docker run -d --name notifykit-redis -p 6379:6379 redis:7-alpine
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your SMTP credentials (such as [Mailtrap](https://mailtrap.io) for safe testing).

### 3. Run the Example

```bash
npx tsx index.ts
```

Press `Ctrl+C` to test graceful shutdown.
