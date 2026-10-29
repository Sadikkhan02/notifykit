# `@notifykit/adapter-nodemailer`

> Universal Email adapter for NotifyKit using Nodemailer (SMTP, AWS SES, Mailgun, SendGrid, Gmail, Mailtrap).

This package bridges NotifyKit's background worker to any SMTP server or email delivery provider supported by Nodemailer. It conforms to the `EmailProvider` contract and is verified by `@notifykit/test-utils`.

---

## Installation

```bash
npm install notifykit @notifykit/adapter-nodemailer nodemailer
```

> **Note:** `nodemailer` is declared as an external peer dependency to allow consuming applications full control over version pinning and native transport extensions.

---

## Configuration

### Environment Variables

| Variable        | Required | Default     | Description                                                          |
| :-------------- | :------- | :---------- | :------------------------------------------------------------------- |
| `SMTP_HOST`     | **Yes**  | —           | SMTP server hostname (e.g., `smtp.mailtrap.io`, `smtp.sendgrid.net`) |
| `SMTP_PORT`     | **Yes**  | `587`       | SMTP port (`587` for STARTTLS, `465` for SSL, `25` standard)         |
| `SMTP_USER`     | **Yes**  | —           | Authentication username / API user                                   |
| `SMTP_PASSWORD` | **Yes**  | —           | Authentication password / API key                                    |
| `SMTP_SECURE`   | No       | `false`     | Set to `true` if connecting over port `465` (SSL)                    |
| `SMTP_FROM`     | No       | `SMTP_USER` | Default sender email address (`noreply@yourdomain.com`)              |

---

## Usage

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

const emailProvider = new NodemailerEmailProvider({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
  from: process.env.SMTP_FROM || 'noreply@yourdomain.com',
});

const notifier = createNotifier({
  providers: {
    email: {
      type: 'nodemailer',
      adapter: emailProvider,
      from: 'noreply@yourdomain.com',
    },
  },
});

// Register an email template
notifier.registerTemplate(
  'account-activation',
  '<h1>Activate Your Account</h1><p>Click <a href="{{url}}">here</a> to confirm.</p>',
);

// Enqueue notification (returns immediately with jobId)
const { jobId } = await notifier.notify({
  to: { email: 'user@example.com' },
  channels: ['email'],
  template: 'account-activation',
  data: { url: 'https://example.com/activate?token=xyz' },
});

// Start processing email queue
notifier.startWorker({ channels: ['email'] });
```

---

## Error Classification & Resilience

Every delivery attempt is mapped into a standardized `ProviderResult`:

| SMTP Error / Response Code                     | Category         | `retryable` | BullMQ Action                     |
| :--------------------------------------------- | :--------------- | :---------- | :-------------------------------- |
| `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`      | Network glitch   | `true`      | Retried with exponential backoff  |
| `EAI_AGAIN` (DNS temporary lookup failure)     | DNS transient    | `true`      | Retried with exponential backoff  |
| `421` (Service not available, closing channel) | Server busy      | `true`      | Retried with exponential backoff  |
| `450`, `451`, `452` (Mailbox busy / limit)     | Rate/Quota       | `true`      | Retried with exponential backoff  |
| `535` (Authentication credentials invalid)     | Config defect    | `false`     | Routed directly to DLQ (no retry) |
| `550`, `551`, `553` (Mailbox does not exist)   | Recipient bad    | `false`     | Routed directly to DLQ (no retry) |
| `552`, `554` (Transaction failed / rejected)   | Policy violation | `false`     | Routed directly to DLQ (no retry) |

### Credential Sanitization

All raw error messages returned by Nodemailer are sanitized before being attached to error logs or provider results: passwords, authorization bearer tokens, and connection credentials matching `pass` or `password` patterns are automatically redacted.

---

## License

MIT
