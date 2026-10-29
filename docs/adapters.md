# Creating NotifyKit Adapters

This guide explains how to build and publish a production-grade provider adapter for NotifyKit — whether for email, SMS, or push notifications.

Every NotifyKit adapter conforms to a standardized interface and must pass the **Adapter Contract Suite** provided by `@notifykit/test-utils`. Wiring a new adapter into the contract suite takes less than 30 minutes.

---

## 1. Adapter Architecture Overview

A NotifyKit adapter is a lightweight package that bridges NotifyKit's queue worker to a specific third-party provider or transport (e.g., SendGrid, Postmark, AWS SES, Sinch, APNs).

### Responsibilities of an Adapter

1. **Provider Class**: Implements one of `EmailProvider`, `SmsProvider`, or `PushProvider`.
2. **Metadata**: Exports an `AdapterMetadata` object declaring the provider name, channel, and required environment variables.
3. **Error Classification**: Maps vendor error codes and HTTP responses into standardized `ProviderResult` objects, classifying transient errors as `retryable: true` and permanent errors as `retryable: false`.
4. **Credential Sanitization**: Strips passwords, API tokens, and authorization headers from all error messages before returning them.
5. **Contract Conformance**: Passes the `@notifykit/test-utils` contract test suite.

---

## 2. Core Interfaces

All adapters import their contracts from `notifykit/interfaces`:

```typescript
import type {
  EmailProvider,
  SmsProvider,
  PushProvider,
  ProviderResult,
  AdapterMetadata,
} from 'notifykit/interfaces';
```

### The Delivery Contracts

```typescript
export interface EmailProvider {
  readonly name: string;
  sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult>;
}

export interface SmsProvider {
  readonly name: string;
  sendSms(opts: {
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }): Promise<ProviderResult>;
}

export interface PushProvider {
  readonly name: string;
  sendPush(opts: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<ProviderResult>;
}
```

### The `ProviderResult` Contract

```typescript
export interface ProviderResult {
  /** True if delivery succeeded or was accepted for queueing by the provider */
  success: boolean;
  /** Unique message identifier assigned by provider (e.g. SMTP Message-ID, Twilio SID) */
  messageId?: string;
  /** Actionable error description if delivery failed */
  error?: string;
  /** True for network timeouts, 429 rate limits, and 5xx errors; false for invalid credentials/recipients */
  retryable?: boolean;
  /** Optional suggested backoff in milliseconds (e.g. from Retry-After headers) */
  retryAfterMs?: number;
}
```

---

## 3. Step-by-Step: Writing an Adapter

### Step 1: Package Setup

Create your adapter package with `@notifykit/test-utils` as a development dependency:

```json
{
  "name": "notifykit-adapter-postmark",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "peerDependencies": {
    "notifykit": ">=0.0.1",
    "postmark": ">=3.0.0"
  },
  "devDependencies": {
    "@notifykit/test-utils": "*",
    "notifykit": "*",
    "vitest": "^5.0.0"
  }
}
```

### Step 2: Define Metadata

```typescript
// src/metadata.ts
import type { AdapterMetadata } from 'notifykit/interfaces';

export const metadata: AdapterMetadata = {
  name: 'postmark',
  channel: 'email',
  requiredEnv: ['POSTMARK_SERVER_TOKEN'],
};
```

### Step 3: Implement Error Mapping and Sanitization

```typescript
// src/error-mapper.ts
import type { ProviderResult } from 'notifykit/interfaces';

export function sanitizeErrorMessage(message: string): string {
  return message.replace(/(server[_-]?token|token|password)=[^&;\s]+/gi, '$1=[REDACTED]');
}

export function mapPostmarkError(err: unknown): ProviderResult {
  let message = 'Unknown delivery error';
  let statusCode = 500;

  if (err instanceof Error) {
    message = sanitizeErrorMessage(err.message);
    if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
      statusCode = (err as any).statusCode;
    }
  }

  // 401/403: Bad credentials -> permanent
  if (statusCode === 401 || statusCode === 403) {
    return { success: false, error: message, retryable: false };
  }

  // 429: Rate limit -> retryable
  if (statusCode === 429) {
    return { success: false, error: message, retryable: true, retryAfterMs: 1000 };
  }

  // 5xx or network errors -> retryable
  if (statusCode >= 500 || /ECONNRESET|ETIMEDOUT/i.test(message)) {
    return { success: false, error: message, retryable: true };
  }

  // Default fallback for client errors (400, invalid email, etc.)
  return { success: false, error: message, retryable: false };
}
```

### Step 4: Implement the Provider Class

```typescript
// src/provider.ts
import { ServerClient } from 'postmark';
import type { EmailProvider, ProviderResult } from 'notifykit/interfaces';
import { mapPostmarkError } from './error-mapper.js';

export class PostmarkEmailProvider implements EmailProvider {
  readonly name = 'postmark';
  private client: ServerClient;

  constructor(options: { apiKey?: string; client?: ServerClient } = {}) {
    const token = options.apiKey ?? process.env.POSTMARK_SERVER_TOKEN ?? '';
    this.client = options.client ?? new ServerClient(token);
  }

  async sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult> {
    try {
      const response = await this.client.sendEmail({
        From: opts.from,
        To: opts.to,
        Subject: opts.subject,
        HtmlBody: opts.html,
        TextBody: opts.text,
      });

      return {
        success: true,
        messageId: response.MessageID,
      };
    } catch (err) {
      return mapPostmarkError(err);
    }
  }
}
```

---

## 4. Validating with the Adapter Contract Suite

The contract suite automatically runs 7 test suites validating your adapter against all NotifyKit requirements:

```typescript
// tests/contract.test.ts
import { vi } from 'vitest';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { PostmarkEmailProvider, metadata } from '../src/index.js';

runAdapterContractTests({
  providerName: 'postmark',
  channel: 'email',
  metadata,
  createSuccessProvider: () => {
    const mockClient = {
      sendEmail: vi.fn().mockResolvedValue({ MessageID: 'postmark-msg-001' }),
    };
    return new PostmarkEmailProvider({ client: mockClient as any });
  },
  createAuthFailingProvider: () => {
    const mockClient = {
      sendEmail: vi.fn().mockRejectedValue(
        Object.assign(new Error('Invalid Server Token: [REDACTED]'), { statusCode: 401 }),
      ),
    };
    return new PostmarkEmailProvider({ client: mockClient as any });
  },
  createNetworkFailingProvider: () => {
    const mockClient = {
      sendEmail: vi.fn().mockRejectedValue(
        Object.assign(new Error('Gateway timeout ECONNRESET'), { statusCode: 504 }),
      ),
    };
    return new PostmarkEmailProvider({ client: mockClient as any });
  },
  validOptions: {
    to: 'user@example.com',
    from: 'support@example.com',
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  },
  invalidOptions: {
    to: '',
    from: '',
    subject: '',
    html: '',
  },
  sampleSecret: 'my-super-secret-token-12345',
});
```

Run tests using Vitest:

```bash
npx vitest run
```

---

## 5. Contract Checklist

Before releasing your adapter, ensure:

- [ ] `runAdapterContractTests` passes without failures.
- [ ] No raw credentials or tokens are printed to console or included in error messages.
- [ ] Transient failures (429, 500, 502, 503, 504, socket hang-up) return `retryable: true`.
- [ ] Permanent failures (400, 401, 403, 404, invalid recipient, unapproved template) return `retryable: false`.
- [ ] The package targets Node.js `>=20.0.0`.
- [ ] Automated tests use mock clients or transports — never live provider credentials or external network sockets.
