# `@notifykit/adapter-msg91`

> India-optimized, TRAI/DLT compliant SMS adapter for NotifyKit using MSG91 Flow API.

This package provides a lightweight, enterprise SMS transport for NotifyKit using the **MSG91 Flow API**. Built using native Node.js `fetch`, it requires **zero external vendor SDKs** or heavy runtime dependencies. It supports Indian Telecom Commercial Communications Customer Preference Regulations (TCCCPR/DLT) template variables and sender IDs.

---

## Installation

```bash
npm install notifykit @notifykit/adapter-msg91
```

> **Zero Vendor SDK:** Uses Node's built-in `fetch` API. No third-party MSG91 SDK required.

---

## Configuration

### Environment Variables

| Variable          | Required | Description                                                            |
| :---------------- | :------- | :--------------------------------------------------------------------- |
| `MSG91_AUTH_KEY`  | **Yes**  | MSG91 API Authentication Key                                           |
| `MSG91_FLOW_ID`   | **Yes**  | MSG91 Flow ID (maps to approved DLT Template ID)                       |
| `MSG91_SENDER_ID` | **Yes**  | Approved 6-character alphanumeric DLT Header/Sender ID (e.g. `NOTIFY`) |

---

## Usage

```typescript
import { createNotifier } from 'notifykit';
import { Msg91SmsProvider } from '@notifykit/adapter-msg91';

const smsProvider = new Msg91SmsProvider({
  authKey: process.env.MSG91_AUTH_KEY!,
  flowId: process.env.MSG91_FLOW_ID!,
  sender: process.env.MSG91_SENDER_ID!, // e.g. 'NOTIFY'
});

const notifier = createNotifier({
  providers: {
    sms: {
      type: 'msg91',
      adapter: smsProvider,
    },
  },
});

// Register SMS template matching your DLT Flow placeholders
notifier.registerTemplate(
  'otp-flow',
  'Your verification code is {{otp}}. Valid for 10 minutes. - NotifyKit',
);

// Enqueue SMS (returns immediately with jobId)
const { jobId } = await notifier.notify({
  to: { phone: '+919876543210' }, // International format with country code
  channels: ['sms'],
  template: 'otp-flow',
  data: {
    otp: '918234',
    // Dynamic variables pass directly to MSG91 Flow recipient payload
  },
});

// Start processing SMS queue
notifier.startWorker({ channels: ['sms'], concurrency: 5 });
```

---

## DLT & Regulatory Compliance (India TCCCPR)

> [!WARNING]
> In India, the Telecom Regulatory Authority of India (TRAI) mandates that all commercial and transactional SMS traffic must be registered on an approved Distributed Ledger Technology (DLT) platform (e.g., Vilpower, PingConnect, Airtel, Jio DLT).
>
> 1. **Entity Registration:** Your organization must possess an active Principal Entity (PE) ID.
> 2. **Sender ID:** Senders must be exact 6-character alphanumeric headers approved on the DLT portal.
> 3. **Template Approval:** SMS content must exactly match an approved DLT Template ID. Variables (`{#var#}`) in DLT correspond to dynamic fields in NotifyKit's `data` payload.
>
> Unregistered templates or sender mismatches are permanently rejected by Indian telecom operators.

---

## Error Classification & DLQ Routing

| Response / HTTP Status     | Cause                                                     | `retryable` | BullMQ Action                     |
| :------------------------- | :-------------------------------------------------------- | :---------- | :-------------------------------- |
| `429 Too Many Requests`    | MSG91 Flow API rate throttling                            | `true`      | Retried with exponential backoff  |
| `500`, `502`, `503`, `504` | Gateway or MSG91 upstream outage                          | `true`      | Retried with exponential backoff  |
| `ETIMEDOUT`, `ECONNRESET`  | Socket / TLS handshake interruption                       | `true`      | Retried with exponential backoff  |
| `401 Unauthorized`         | Invalid `authKey`                                         | `false`     | Routed directly to DLQ (no retry) |
| `400 Bad Request`          | DLT template mismatch, invalid Flow ID, unapproved sender | `false`     | Routed directly to DLQ (no retry) |
| `422 Unprocessable`        | Invalid mobile number format                              | `false`     | Routed directly to DLQ (no retry) |

### Credential Sanitization

All error logs and provider results automatically strip `authKey` headers, bearer tokens, and sensitive query parameters to prevent leakage in telemetry and monitoring systems.

---

## License

MIT
