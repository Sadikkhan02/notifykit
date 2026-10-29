# `@notifykit/test-utils`

The official test utilities and adapter contract testing framework for **NotifyKit**.

Provides shared fixtures, in-memory mock providers, safe local Redis helpers, and the standardized **Adapter Contract Suite** (`runAdapterContractTests`) required for all official and community provider adapters.

---

## Installation

```bash
npm install --save-dev @notifykit/test-utils vitest
```

---

## 1. Adapter Contract Test Suite

Every NotifyKit adapter (email, SMS, push) must conform to the standard provider interface and error classification contract. Using `runAdapterContractTests`, you can validate your custom adapter in minutes.

### Example: Running the Contract Suite

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { MyEmailProvider, metadata } from '../src/index.js';

runAdapterContractTests({
  providerName: 'my-email',
  channel: 'email',
  metadata,
  createSuccessProvider: () => new MyEmailProvider({ mockTransport: true }),
  createAuthFailingProvider: () => new MyEmailProvider({ authError: true }),
  createNetworkFailingProvider: () => new MyEmailProvider({ networkError: true }),
  validOptions: {
    to: 'user@example.com',
    from: 'noreply@notifykit.dev',
    subject: 'Welcome',
    html: '<h1>Welcome!</h1>',
  },
  invalidOptions: {
    to: '',
    from: '',
    subject: '',
    html: '',
  },
  sampleSecret: 'my-secret-key-12345',
});
```

### What `runAdapterContractTests` Asserts

1. **Metadata Conformance**: Validates `metadata.name`, `metadata.channel`, and non-empty `requiredEnv`.
2. **Provider Identity**: Checks `provider.name === metadata.name` and ensures the canonical delivery method (`sendEmail`, `sendSms`, or `sendPush`) is implemented.
3. **Delivery Success**: Asserts `{ success: true, messageId: string }` on successful delivery.
4. **Permanent Failure Classification**: Asserts `{ success: false, retryable: false }` with actionable `error` on auth/credential failures.
5. **Transient Failure Classification**: Asserts `{ success: false, retryable: true }` with actionable `error` on network/timeout failures.
6. **Malformed Input Safety**: Asserts provider returns `{ success: false, retryable: false }` gracefully on malformed inputs without throwing unhandled exceptions.
7. **Zero Credential Exposure**: Verifies raw secrets, bearer tokens, and private key headers are never leaked in returned error messages.

---

## 2. In-Memory Mock Providers

Easily simulate notification delivery in application unit and integration tests without network I/O or credentials:

```typescript
import {
  createMockEmailProvider,
  createMockSmsProvider,
  createMockPushProvider,
} from '@notifykit/test-utils';

const mockEmail = createMockEmailProvider({ name: 'test-smtp' });
const mockSms = createMockSmsProvider({ name: 'test-sms' });

// Send a test email
await mockEmail.sendEmail({
  to: 'user@example.com',
  from: 'app@example.com',
  subject: 'Test',
  html: '<p>Test</p>',
});

// Inspect recorded calls
console.log(mockEmail.calls.length); // 1
console.log(mockEmail.calls[0].to); // 'user@example.com'

// Simulate failure
mockEmail.setResult({ success: false, error: 'Rate limit exceeded', retryable: true });
```

---

## 3. Deterministic Test Fixtures

Generate consistent, schema-valid recipients, jobs, and results:

```typescript
import {
  createTestRecipient,
  createTestNotificationJob,
  createMockProviderResult,
} from '@notifykit/test-utils';

const emailRecipient = createTestRecipient('email', { email: 'custom@example.com' });
const smsRecipient = createTestRecipient('sms');
const pushRecipient = createTestRecipient('push');

const job = createTestNotificationJob('email', {
  templateId: 'order-confirmed',
  variables: { orderId: '123' },
});
```

---

## 4. Safe Local Redis Helpers

When running integration tests with real Redis, prevent accidental execution against remote or production instances:

```typescript
import { isSafeLocalRedisUrl, cleanupTestRedis } from '@notifykit/test-utils';

// Fails closed if REDIS_URL is not 127.0.0.1 or localhost
await cleanupTestRedis();
```

---

## License

MIT
