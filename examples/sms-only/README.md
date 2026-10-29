# NotifyKit SMS-Only Example

This example demonstrates single-channel SMS delivery supporting both **Twilio** and **MSG91** adapters.

---

## What This Example Demonstrates

1. **Provider Flexibility:** Toggling between `@notifykit/adapter-twilio` and `@notifykit/adapter-msg91`.
2. **E.164 Phone Normalization:** Strict validation of recipient phone numbers.
3. **Template Compilation:** Rendering SMS text with variable placeholders.
4. **Enqueue vs Delivery:** Pre-rendering into Redis and asynchronous delivery.
5. **Regulatory Awareness:** Notes on US A2P 10DLC and India DLT compliance.

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

Choose `SMS_PROVIDER=twilio` or `SMS_PROVIDER=msg91` and provide your test credentials.

### 3. Run the Example

```bash
npx tsx index.ts
```

Press `Ctrl+C` to terminate gracefully.
