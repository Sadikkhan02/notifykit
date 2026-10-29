# NotifyKit Architecture & Internal Design

This document details the architectural principles, data flow, queue topologies, error recovery policies, and distributed tracing implementation of **NotifyKit**.

---

## 1. Architectural Philosophy

NotifyKit is designed around four foundational architectural principles:

1. **Stateless & Code-First:** NotifyKit requires no database (no PostgreSQL, MongoDB, or MySQL). All configuration, provider bindings, and templates live directly in code or environment variables.
2. **Redis as a Durable Buffer:** Persistent state is delegated entirely to Redis via BullMQ streams. Queues buffer high-volume bursts, absorb provider outages, and survive process crashes.
3. **Fail-Fast In-Memory Pre-Rendering (ADR-004):** Templates are rendered *before* jobs enter Redis. If a template has syntax errors or is missing required variables, the caller fails immediately in `< 2ms` without polluting queues or wasting Redis IO.
4. **Zero Vendor Lock-In:** Providers are isolated behind standard TypeScript interfaces (`EmailProvider`, `SmsProvider`, `PushProvider`). Swapping Twilio for MSG91 or Nodemailer for SES requires zero changes to application notification code.

---

## 2. End-to-End Notification Lifecycle

```
Caller: notifier.notify(event)
  │
  ├─► 1. Generate Correlation UUIDv7 traceId
  ├─► 2. Validate Event Schema (to, channels, template, data)
  ├─► 3. Resolve Channel Provider Adapters
  ├─► 4. Pre-Render Template In-Memory (ADR-004)
  │      └─ [Syntax / Missing Variable Error? Throw synchronously!]
  ├─► 5. Enqueue NotificationJob to BullMQ
  │      └─► Return immediately to caller: { jobId: "<uuid-v7>" }
  │
  ▼ [Asynchronous Boundary: Redis Streams]
  │
Background Worker: notifier.startWorker()
  │
  ├─► 6. Worker pulls NotificationJob from Redis
  ├─► 7. Adapter Dispatch (sendEmail / sendSms / sendPush)
  │
  ├─► Success:
  │     └─► Retain job metadata per retention policy
  │
  ├─► Transient Failure (Network glitch, rate limit, 5xx):
  │     └─► BullMQ Exponential Backoff Retry (Attempts 1 to 5)
  │
  └─► Terminal Failure (Bad email/phone, auth failure, DLT mismatch) OR Exhausted Retries:
        └─► Intercept and route directly to Dead-Letter Queue (bull:notifykit:dlq)
```

---

## 3. Queue Topology & Namespacing

NotifyKit isolates all queue keys under a standard BullMQ namespace to ensure safe coexistence on shared Redis clusters.

| Channel | Queue Name | Redis Key Pattern | Default Concurrency |
| :--- | :--- | :--- | :--- |
| **Email** | `notifykit:email` | `bull:notifykit:email:*` | `5` |
| **SMS** | `notifykit:sms` | `bull:notifykit:sms:*` | `5` |
| **Push** | `notifykit:push` | `bull:notifykit:push:*` | `10` |
| **DLQ** | `notifykit:dlq` | `bull:notifykit:dlq:*` | *Passive (No workers)* |

> See **[Redis Data Model & Key Architecture](redis.md)** for exhaustive details on key types, connection pooling, and shared-instance rules.

---

## 4. In-Memory Template Rendering (ADR-004)

Unlike traditional queue systems that serialize raw template names and variable dictionaries into queue payloads, NotifyKit renders templates in memory **before** enqueuing:

### Why Pre-Render?
- **Immediate Feedback:** A typo in a Handlebars variable throws a `MissingVariableError` or `TemplateSyntaxError` directly in the HTTP request handler, allowing your API to return `400 Bad Request` to the user.
- **Queue Determinism:** Background workers never fail due to missing template files or template engine parsing errors.
- **Worker Simplicity:** Workers simply receive pre-rendered HTML/plaintext and invoke provider APIs.

---

## 5. Retry Policy & Dead-Letter Queue (DLQ)

NotifyKit classifies all errors into two categories:

### 1. Transient Errors (`retryable: true`)
Transient errors are expected operational issues that typically resolve quickly:
- Connection timeouts (`ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`).
- Provider HTTP 429 rate limits.
- Upstream 5xx gateway errors (`500`, `502`, `503`, `504`).

**Backoff Strategy:**
- Max Retries: **5 attempts**.
- Strategy: **Exponential backoff with randomized jitter**.
- Progression: `~1s`, `~2s`, `~4s`, `~8s`, `~16s`.

### 2. Terminal Errors (`retryable: false`)
Terminal errors indicate a defect that will never succeed upon retry:
- Invalid recipient phone numbers (e.g. Twilio `21211`).
- Non-existent mailboxes (SMTP `550`).
- Unregistered FCM device tokens (`messaging/registration-token-not-registered`).
- Invalid authentication credentials or unapproved DLT sender IDs.

**DLQ Routing:**
When an adapter returns `retryable: false`, the worker immediately halts retries and transfers the job to `bull:notifykit:dlq`.
- DLQ jobs are **retained indefinitely** (`removeOnFail: false`).
- Contains full error stack, terminal reason, attempt count, and original payload for auditing.

---

## 6. Observability, Logging & Tracing

NotifyKit includes a high-performance structured JSON logger powered by **Pino**.

### Distributed Tracing with UUIDv7
Every call to `notify()` generates an RFC 9562-compliant **UUIDv7**. UUIDv7 combines a 48-bit millisecond timestamp with cryptographically random bits, providing:
- Natural chronological ordering.
- Zero collision across distributed nodes.
- Direct correlation across API enqueues, Redis jobs, worker executions, and adapter logs.

### Automatic Secret & PII Redaction
NotifyKit automatically sanitizes all log outputs using `REDACT_PATHS`:
- `*.auth.pass`, `*.auth.password`, `*.password`
- `*.headers.authorization`, `*.authorization`
- `*.token`, `*.serviceAccount`, `*.privateKey`
- Recipient contact info (`phone`, `email`) in debug dumps

---

## 7. Concurrency & Horizontal Scaling

NotifyKit workers are completely stateless and can scale horizontally across multiple Node.js processes, containers, or Kubernetes pods.

```typescript
// Configure worker concurrency per process
notifier.startWorker({
  channels: ['email', 'sms', 'push'],
  concurrency: {
    email: 20, // 20 parallel SMTP sockets
    sms: 10,   // 10 parallel HTTP requests
    push: 50,  // 50 parallel HTTP/2 multiplexed streams
  },
});
```

BullMQ automatically coordinates work distribution across all connected worker instances using atomic Redis Lua scripts with zero duplicate processing.
