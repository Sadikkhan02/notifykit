# NotifyKit Multi-Channel Example (Both Channels / All Channels)

This example demonstrates orchestrating notifications across multiple channels simultaneously (**Email**, **SMS**, and **Push**) using a single `notify()` invocation.

---

## What This Example Demonstrates

1. **Multi-Channel Orchestration:** A single call to `notifier.notify({ channels: ['email', 'sms', 'push'], ... })` routes the event across three queues simultaneously.
2. **Channel Concurrency Tuning:** Configuring per-channel worker concurrency limits (`concurrency: { email: 10, sms: 5, push: 20 }`).
3. **Multi-Adapter Coexistence:** Running Nodemailer, Twilio, and Firebase Cloud Messaging side-by-side in a single application process.
4. **Durable Teardown:** Handling OS termination signals (`SIGINT`, `SIGTERM`) to cleanly drain all three worker queues.

---

## Setup & Running

### 1. Prerequisites

Start local Redis:

```bash
docker run -d --name notifykit-redis -p 6379:6379 redis:7-alpine
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your email, SMS, and push credentials.

### 3. Run the Example

```bash
npx tsx index.ts
```

Press `Ctrl+C` to test graceful draining of all three worker pools.
