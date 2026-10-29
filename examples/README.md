# NotifyKit Examples

This directory contains standalone, runnable examples demonstrating the core capabilities and architecture of **NotifyKit**.

---

## Example Directory Overview

| Directory                              | Channel(s)    | Description                                                                                            |
| :------------------------------------- | :------------ | :----------------------------------------------------------------------------------------------------- |
| **[`email-only/`](email-only/)**       | Email         | Basic email notification using Nodemailer with template compilation and worker lifecycle.              |
| **[`sms-only/`](sms-only/)**           | SMS           | SMS delivery supporting both Twilio and MSG91 with E.164 phone formatting and DLT variables.           |
| **[`both-channels/`](both-channels/)** | Multi-channel | Simultaneous Email, SMS, and Push notification dispatch with concurrency tuning and graceful shutdown. |
| **[`ci-mode/`](ci-mode/)**             | Mock / CI     | Headless setup, non-interactive wizard execution, and deterministic mock delivery for CI/CD pipelines. |

---

## Prerequisites

All runnable examples require a running Redis instance for durable queue buffering:

```bash
docker run -d --name notifykit-redis -p 6379:6379 redis:7-alpine
```

---

## Enqueue Acceptance vs Asynchronous Delivery

In all NotifyKit examples, notice the critical architectural separation between:

1. **Enqueue Acceptance (`notifier.notify`):**

   ```typescript
   const { jobId } = await notifier.notify({ ... });
   ```

   This confirms that the notification payload was validated, the template was pre-rendered in memory, and the job was durably stored in the Redis queue. It returns immediately with a unique UUIDv7 `jobId`.

2. **Asynchronous Delivery (`notifier.startWorker`):**
   ```typescript
   notifier.startWorker({ channels: ['email'] });
   ```
   The background worker pulls jobs from Redis streams and transmits them to external provider gateways (SMTP, Twilio, MSG91, FCM) with automatic retries and Dead-Letter Queue (DLQ) protection.

---

## Security & Credential Rules

1. **No Real Secrets:** All `.env.example` files contain placeholder strings (`mock_user`, `your_token`, `AC000...`). Never commit real credentials or private keys.
2. **Fictitious Phone Numbers:** All example phone numbers use the fictitious `+15555550100` NANPA test range per RFC 2606.

---

## Live Vendor Verification Scripts (Manual Only)

The root scripts `send-real-email.ts`, `send-real-msg91-sms.ts`, and `send-real-fcm-push.ts` are preserved for manual integration verification against live third-party accounts.

> [!WARNING]
> Live test scripts connect to real vendor endpoints and incur real carrier/network charges. **They must never be executed in automated CI workflows.**
