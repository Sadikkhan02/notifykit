# NotifyKit v1.0.0 — Official Release Notes

NotifyKit v1.0.0 is the first production release of the enterprise-ready transactional notification delivery engine for Node.js.

## Highlights

- **Core Dispatch Engine (`notifykit`)**:
  - High-throughput asynchronous notification pipeline powered by Redis BullMQ.
  - Multi-channel support (Email, SMS, Push) with built-in Handlebars templating.
  - Exponential backoff retries, dead letter queue (DLQ) isolation, and idempotency key tracking.
  - Strict security by default: recursive 5-level deep credential redaction (`[REDACTED]`) and PII sanitization in queue payloads.
  - Proven performance: 700+ msg/sec throughput, dispatch p99 latency < 2.5 ms.

- **Modular Provider Adapters**:
  - `@notifykit/adapter-nodemailer`: Production SMTP email transport with TLS and attachment support.
  - `@notifykit/adapter-twilio`: Twilio REST API SMS delivery with Messaging Service SID support.
  - `@notifykit/adapter-msg91`: MSG91 Flow API SMS adapter with DLT template compliance.
  - `@notifykit/adapter-fcm`: Firebase Cloud Messaging push notifications via Firebase Admin SDK.

- **Setup Wizard & CLI (`notifykit-cli` / `npx notifykit init`)**:
  - Interactive zero-config CLI setup wizard for instant project onboarding.
  - Headless/CI flags (`--yes`, `--channels`, `--email`, `--sms`, `--push`, `--skip-install`).
  - Automatic dependency installation and environment variable configuration in `.env`.

- **Deterministic Testing Utilities (`@notifykit/test-utils`)**:
  - Reusable adapter contract compliance test suite (`runAdapterContractTests`).
  - Deterministic in-memory mock providers for Email, SMS, and Push channels.

## Quickstart

```bash
npm install notifykit
npx notifykit init
```

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

const notifier = createNotifier({
  email: new NodemailerEmailProvider({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
  }),
});

await notifier.notify({
  channel: 'email',
  recipient: 'user@example.com',
  template: 'welcome',
  data: { name: 'Alice' },
});
```

## Package Manifest & Versions

| Package | Version | Description |
|---|---|---|
| `notifykit` | `1.0.0` | Core dispatch engine & BullMQ worker queue |
| `notifykit-cli` | `1.0.0` | Interactive project setup wizard & CLI generator |
| `@notifykit/adapter-nodemailer` | `1.0.0` | Nodemailer SMTP email provider adapter |
| `@notifykit/adapter-twilio` | `1.0.0` | Twilio SMS provider adapter |
| `@notifykit/adapter-msg91` | `1.0.0` | MSG91 Flow API SMS provider adapter |
| `@notifykit/adapter-fcm` | `1.0.0` | Firebase Cloud Messaging push provider adapter |
| `@notifykit/test-utils` | `1.0.0` | Adapter contract test suite & deterministic mocks |

## Tarball Integrity & Checksum Verification

Reproducible SHA-256 checksums can be verified locally after building the packages:

```bash
for pkg in core cli test-utils adapter-nodemailer adapter-twilio adapter-msg91 adapter-fcm; do
  tarball=$(npm pack --workspace=packages/$pkg --pack-destination=/tmp)
  sha256sum "/tmp/$tarball"
done
```
