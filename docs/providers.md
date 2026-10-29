# Provider Configuration & Integration Guide

NotifyKit features modular provider adapters that isolate third-party vendor APIs, error mapping, and authentication behind standardized interfaces.

This guide provides exhaustive setup and configuration instructions for all four official NotifyKit adapters:
- **[Nodemailer (Universal SMTP / Email)](#1-nodemailer-universal-email)**
- **[Twilio (Global SMS)](#2-twilio-sms)**
- **[MSG91 (India DLT SMS)](#3-msg91-sms)**
- **[Firebase Cloud Messaging (Push)](#4-firebase-cloud-messaging-fcm-push)**

---

## 1. Nodemailer (Universal Email)

The Nodemailer adapter (`@notifykit/adapter-nodemailer`) routes email notifications to any standard SMTP server or transactional email provider.

### Installation

```bash
npm install @notifykit/adapter-nodemailer nodemailer
```

### Environment Variables

| Variable | Required | Default | Example | Description |
| :--- | :--- | :--- | :--- | :--- |
| `SMTP_HOST` | **Yes** | — | `smtp.mailtrap.io` | SMTP server host |
| `SMTP_PORT` | **Yes** | `587` | `587` | Connection port (`587`, `465`, `25`) |
| `SMTP_USER` | **Yes** | — | `api_user` | Authentication username / API key |
| `SMTP_PASSWORD`| **Yes** | — | `secret_token` | Authentication password |
| `SMTP_SECURE` | No | `false` | `false` | Set to `true` for port 465 (TLS/SSL) |
| `SMTP_FROM` | No | `SMTP_USER` | `noreply@domain.com` | Default sender address |

### Code Configuration

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

const emailProvider = new NodemailerEmailProvider({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
  from: process.env.SMTP_FROM || 'noreply@yourdomain.com',
});

export const notifier = createNotifier({
  providers: {
    email: {
      type: 'nodemailer',
      adapter: emailProvider,
      from: 'noreply@yourdomain.com',
    },
  },
});
```

---

## 2. Twilio SMS

The Twilio adapter (`@notifykit/adapter-twilio`) delivers SMS and MMS messages worldwide.

### Installation

```bash
npm install @notifykit/adapter-twilio twilio
```

### Environment Variables

| Variable | Required | Example | Description |
| :--- | :--- | :--- | :--- |
| `TWILIO_ACCOUNT_SID` | **Yes** | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 34-character Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | **Yes** | `your_auth_token` | Twilio primary Auth Token |
| `TWILIO_FROM` | Optional* | `+15555550100` | E.164 phone number |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional* | `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Messaging Service SID |

*\* Either `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` must be configured.*

### Regulatory Notice & US A2P 10DLC
> [!WARNING]
> Sending SMS to US numbers (+1) via 10-digit long codes (10DLC) requires an approved A2P 10DLC Brand and Campaign registration in Twilio Console. Unregistered traffic is blocked by US tier-1 telecom carriers with error `30034`.

### Code Configuration

```typescript
import { createNotifier } from 'notifykit';
import { TwilioSmsProvider } from '@notifykit/adapter-twilio';

const smsProvider = new TwilioSmsProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  from: process.env.TWILIO_FROM,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
});

export const notifier = createNotifier({
  providers: {
    sms: {
      type: 'twilio',
      adapter: smsProvider,
      from: process.env.TWILIO_FROM,
    },
  },
});
```

---

## 3. MSG91 SMS

The MSG91 adapter (`@notifykit/adapter-msg91`) connects to MSG91's Flow API. Built with native Node.js `fetch`, it requires **zero external vendor dependencies**.

### Installation

```bash
npm install @notifykit/adapter-msg91
```

### Environment Variables

| Variable | Required | Example | Description |
| :--- | :--- | :--- | :--- |
| `MSG91_AUTH_KEY` | **Yes** | `your_msg91_auth_key` | MSG91 API key |
| `MSG91_FLOW_ID` | **Yes** | `64d8a1f2b...` | MSG91 Flow ID (maps to approved DLT template) |
| `MSG91_SENDER_ID` | **Yes** | `NOTIFY` | Approved 6-character DLT Header |

### Regulatory Notice & India TRAI DLT
> [!WARNING]
> In India, the Telecom Commercial Communications Customer Preference Regulations (TCCCPR) mandate DLT registration. All SMS messages must originate from an approved 6-character sender ID and match a registered DLT Template ID. Variables (`{#var#}`) in DLT correspond directly to keys in NotifyKit's `data` payload.

### Code Configuration

```typescript
import { createNotifier } from 'notifykit';
import { Msg91SmsProvider } from '@notifykit/adapter-msg91';

const smsProvider = new Msg91SmsProvider({
  authKey: process.env.MSG91_AUTH_KEY!,
  flowId: process.env.MSG91_FLOW_ID!,
  sender: process.env.MSG91_SENDER_ID!, // 6-character alphanumeric
});

export const notifier = createNotifier({
  providers: {
    sms: {
      type: 'msg91',
      adapter: smsProvider,
    },
  },
});
```

---

## 4. Firebase Cloud Messaging (FCM) Push

The FCM adapter (`@notifykit/adapter-fcm`) delivers push notifications to Android, iOS (APNs routed through FCM), and Web browsers.

### Installation

```bash
npm install @notifykit/adapter-fcm firebase-admin
```

### Environment Variables

| Variable | Description |
| :--- | :--- |
| `FCM_SERVICE_ACCOUNT_JSON` | Raw JSON string or file path to Google service account key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Standard Google Cloud credential path fallback |

### Service Account Credentials
Generate a private service account key in **Firebase Console > Project Settings > Service Accounts > Generate new private key**.

### Code Configuration

```typescript
import { createNotifier } from 'notifykit';
import { FcmPushProvider } from '@notifykit/adapter-fcm';

const pushProvider = new FcmPushProvider({
  serviceAccount: process.env.FCM_SERVICE_ACCOUNT_JSON,
});

export const notifier = createNotifier({
  providers: {
    push: {
      type: 'fcm',
      adapter: pushProvider,
    },
  },
});
```

---

## 5. Unified Multi-Channel Configuration

All adapters can be combined simultaneously in a single `createNotifier` instance:

```typescript
export const notifier = createNotifier({
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  providers: {
    email: { type: 'nodemailer', adapter: emailProvider, from: 'noreply@domain.com' },
    sms:   { type: 'twilio',     adapter: smsProvider,   from: '+15555550100' },
    push:  { type: 'fcm',        adapter: pushProvider },
  },
});
```
