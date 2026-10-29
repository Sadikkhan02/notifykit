# `@notifykit/adapter-twilio`

> Global SMS adapter for NotifyKit using Twilio Messaging API.

This package provides an enterprise SMS transport for NotifyKit via Twilio. It implements the `SmsProvider` interface, supports alphanumeric senders and Messaging Service SIDs, normalizes E.164 phone numbers, and adheres to `@notifykit/test-utils` contract tests.

---

## Installation

```bash
npm install notifykit @notifykit/adapter-twilio twilio
```

> **Note:** `twilio` is declared as an external peer dependency to allow consumers control over SDK version pinning and connection reuse.

---

## Configuration

### Environment Variables

| Variable                       | Required  | Description                                                         |
| :----------------------------- | :-------- | :------------------------------------------------------------------ |
| `TWILIO_ACCOUNT_SID`           | **Yes**   | Twilio Account SID (`AC...`)                                        |
| `TWILIO_AUTH_TOKEN`            | **Yes**   | Twilio Auth Token                                                   |
| `TWILIO_FROM`                  | Optional* | Default sender phone number in E.164 format (e.g. `+15555550100`)   |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional* | Twilio Messaging Service SID (`MG...`) for automated sender pooling |

_\* Either `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` must be configured (or provided in options)._

---

## Usage

```typescript
import { createNotifier } from 'notifykit';
import { TwilioSmsProvider } from '@notifykit/adapter-twilio';

const smsProvider = new TwilioSmsProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  from: process.env.TWILIO_FROM, // e.g. +15555550100
  // messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
});

const notifier = createNotifier({
  providers: {
    sms: {
      type: 'twilio',
      adapter: smsProvider,
      from: process.env.TWILIO_FROM,
    },
  },
});

// Register SMS template
notifier.registerTemplate(
  'otp-verification',
  'Your verification code is {{otp}}. Valid for 5 minutes. Do not share this code.',
);

// Enqueue SMS (returns immediately with jobId)
const { jobId } = await notifier.notify({
  to: { phone: '+15555550199' }, // E.164 required
  channels: ['sms'],
  template: 'otp-verification',
  data: { otp: '482910' },
});

// Start processing SMS queue
notifier.startWorker({ channels: ['sms'], concurrency: 5 });
```

---

## Error Classification & Resilience

The Twilio adapter maps structured Twilio error codes directly into standardized `ProviderResult` objects:

| Twilio Error Code | Reason                                               | `retryable` | BullMQ Action                     |
| :---------------- | :--------------------------------------------------- | :---------- | :-------------------------------- |
| `20429`           | Rate limit exceeded / concurrency throttling         | `true`      | Retried with exponential backoff  |
| `30001`           | Queue overflow                                       | `true`      | Retried with exponential backoff  |
| `30008`           | Unknown carrier failure / transient network          | `true`      | Retried with exponential backoff  |
| `30010`           | Carrier unreachable / temporarily unavailable        | `true`      | Retried with exponential backoff  |
| `20003`           | Authentication failure (invalid Account SID / token) | `false`     | Routed directly to DLQ (no retry) |
| `21211`           | Invalid phone number format                          | `false`     | Routed directly to DLQ (no retry) |
| `21614`           | Target number is a landline / cannot receive SMS     | `false`     | Routed directly to DLQ (no retry) |
| `21408`           | Permission denied / region not enabled               | `false`     | Routed directly to DLQ (no retry) |

### Regulatory Notice & Carrier Costs

> [!WARNING]
> Sending SMS via Twilio incurs per-segment carrier fees and pass-through charges.
> In the United States, traffic sent via 10-digit long codes (10DLC) requires an approved A2P 10DLC Brand and Campaign registration. Unregistered traffic is subject to severe carrier filtering, throttling, or non-delivery fees.

---

## License

MIT
