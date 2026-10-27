# Phase 5 Plan: BullMQ Worker Layer

## 1. Objective, Scope, Exclusions, Dependencies & Assumptions

### 1.1 Objective
Implement the processing half of NotifyKit's core queue subsystem per `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md` §11 (Phase 5 line 2793). The BullMQ Worker layer consumes pre-rendered notification jobs from Redis queues (`notifykit:email`, `notifykit:sms`, `notifykit:push`), dispatches them to configured provider adapters, manages retries with exponential backoff for transient failures, routes terminal failures to the dead-letter queue (`notifykit:dlq`), and provides graceful shutdown draining in-flight work.

### 1.2 Scope (In-Scope for Phase 5)
1. **Per-Channel BullMQ Worker Creation (`packages/core/src/queue/worker.ts`):**
   - Independent BullMQ `Worker` instances for each targeted channel (`email`, `sms`, `push`).
   - Prefix isolation adhering to `bull:notifykit` and channel queue names (`email`, `sms`, `push`).
   - Worker connection configuration enforcing Good Citizen Rules (`maxRetriesPerRequest: null`, `enableReadyCheck: false`).
2. **Adapter Job Dispatcher (`packages/core/src/queue/dispatch.ts`):**
   - Maps `NotificationJob` payload to provider adapter interface methods:
     - `email` → `EmailProvider.sendEmail({ to, from, subject, html, text })`
     - `sms` → `SmsProvider.sendSms({ to, from, body, templateId, variables })`
     - `push` → `PushProvider.sendPush({ token, title, body, data })`
   - Distinguishes thrown exceptions from returned `{ success: boolean; messageId?: string; error?: string; retryable?: boolean }` results.
3. **Deterministic Error Classification (`packages/core/src/queue/error-classifier.ts`):**
   - Strict 3-tier precedence classification:
     1. Explicit `ProviderResult.retryable` flag.
     2. Recognized structured error metadata (HTTP 429/5xx, network socket timeouts).
     3. Fallback handling for unknown errors (defaulting to retryable up to attempt limits).
   - Uses BullMQ's native `UnrecoverableError` exclusively for non-retryable terminal failures to prevent wasted retry cycles.
4. **Dead-Letter Queue (DLQ) Routing & Collision-Resistant Colon-Free Deduplication (`packages/core/src/queue/dlq.ts`):**
   - Routes terminally failed jobs to `notifykit:dlq` (internal BullMQ queue `dlq`, prefix `bull:notifykit`).
   - Enforces a collision-resistant, **colon-free** deterministic DLQ job ID format: `dlq-${channel}-${encodedSourceJobId}` where `encodedSourceJobId = Buffer.from(job.id, 'utf8').toString('base64url')` (e.g. `dlq-email-MDE5MmE0YjgtODJkZi03NmEwLTgwYTUtZjcxNjNjNDZlM2Vh`).
   - Bijective Base64URL encoding guarantees zero character collisions and zero colons `:`, ensuring Redis keys conform strictly to `<prefix>:<queueName>:<jobId>`.
   - Preserves the intact original `NotificationJob` payload (with original `id` and `traceId`), error details, attempt count, and terminal failure reason in the DLQ record.
   - Bounded deduplication: deduplicates replay attempts only while the corresponding DLQ job ID remains present in Redis; does not claim global distributed exactly-once delivery.
   - Failure-safe DLQ enqueue: if writing to the DLQ fails, re-throws to ensure the source job remains preserved in the origin queue's failed state.
5. **Synchronous `startWorker()` & Asynchronous Cleanup (`packages/core/src/orchestrator/notifier.ts` & `src/queue/worker.ts`):**
   - Preserves the public synchronous signature `startWorker(options?: StartWorkerOptions): void` on `Notifier`:
     - Synchronous pre-construction validation: all requested channels, provider adapters, and concurrency options are validated *before* instantiating any workers.
     - **Default Channel Selection:** When `channels` is omitted, automatically selects only those channels whose provider adapters can be successfully resolved in `config.providers`.
     - **Explicit Channel Validation:** When `channels` is explicitly requested, validates each requested channel at startup. If an adapter is missing or unusable, throws `MissingAdapterError` synchronously fail-fast at startup time.
     - **Failure Behavior during Construction:** If unexpected errors occur while constructing workers, background teardown is initiated asynchronously on any workers created earlier in that invocation (`w.close().catch(...)`); the method does not use `await` or falsely claim cleanup has completed before it has, and re-throws the error synchronously.
   - Implements instance-scoped graceful shutdown `stopWorker(): Promise<void>`:
     - Drains active in-flight jobs without terminating socket connections prematurely.
     - Awaits worker closure and closes all BullMQ Worker instances idempotently.
6. **Comprehensive Unit & Integration Testing:**
   - Unit tests covering dispatch mapping, error classification precedence, Base64URL colon-free DLQ payload assembly, pre-construction adapter validation, construction failure cleanup initiation, and concurrency.
   - Real-Redis integration tests via Testcontainers testing end-to-end processing, retry backoff timing, immediate DLQ routing for non-retryable errors, DLQ deduplication, and graceful draining on shutdown.

### 1.3 Explicit Exclusions (Out of Scope for Phase 5)
- ❌ **Template Re-Rendering:** Templates are strictly rendered at enqueue time per ADR-004. The worker processes `renderedBody` directly and does NOT invoke Handlebars.
- ❌ **Concrete Vendor SDK Adapters:** Phase 6 (Nodemailer), Phase 7 (Twilio), Phase 8 (FCM), Phase 9 (MSG91). Phase 5 tests use mock adapters conforming to `EmailProvider`, `SmsProvider`, and `PushProvider`.
- ❌ **Dynamic `retryAfterMs` Backoff:** Custom dynamic per-job backoff delays are deferred. All retries adhere strictly to the established Phase 3 exponential backoff contract (starting at 1000ms).
- ❌ **Standalone `stopWorkers()` Export:** Worker shutdown is kept instance-scoped on `Notifier` (`notifier.stopWorker()`); no redundant package-level shutdown API is introduced.
- ❌ **Prometheus / OpenTelemetry Metrics:** Phase 15 (v1.1) scope.
- ❌ **HTTP API Server:** Phase 15 (v1.1) scope.
- ❌ **Persistent External Database:** Core NotifyKit relies strictly on Redis queues and DLQ for transient job lifecycle; no relational or document database is added (ADR-009).

### 1.4 Dependencies & Assumptions
- **Runtime Dependencies:**
  - `bullmq: ^5.41.0` (installed v5.81.5; provides `Worker`, `UnrecoverableError`, `Job`).
  - `ioredis: ^5.5.0` (installed; provides Redis command and subscriber clients).
  - `pino: ^9.6.0` (installed; structured logging and credential redaction).
  - Zero new runtime npm dependencies required.
- **Assumptions:**
  - Redis connection URL defaults to `process.env.REDIS_URL` or `redis://127.0.0.1:6379`.
  - Providers configured on `createNotifier({ providers })` supply either typed configuration metadata or injected adapter instances per ADR-003.

---

## 2. Requirements Traceability Matrix

| Requirement ID | Specification Source | Description | Implementation Task | Test Verification |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-5.1** | PRD §10.3 line 357 (`CORE-03`) | Worker retries failed jobs with exponential backoff (3 total processing attempts: 1 initial + up to 2 retries, 1000ms initial delay). | `src/queue/worker.ts`, `error-classifier.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-02) |
| **REQ-5.2** | PRD §10.3 line 358 (`CORE-04`) | Failed jobs after max attempts must be moved to dead-letter queue (`notifykit:dlq`). | `src/queue/dlq.ts`, `src/queue/worker.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-02) |
| **REQ-5.3** | Architecture §8.3 line 1068, ADR-005 | Explicit worker startup via `notifier.startWorker()`; returns `void`; never auto-start on import. | `src/orchestrator/notifier.ts` | `tests/orchestrator/worker-lifecycle.test.ts` (TC-W-UNIT-01) |
| **REQ-5.4** | Architecture §8.4 line 1088 | Per-channel worker concurrency configurable by user (default: 5). | `src/queue/worker.ts` | `tests/queue/worker.test.ts` (TC-W-UNIT-05) |
| **REQ-5.5** | Architecture §A.7 line 1776, PHASES §11 line 2816 | Graceful shutdown draining in-flight jobs via `notifier.stopWorker(): Promise<void>`. | `src/queue/worker.ts`, `src/orchestrator/notifier.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-04) |
| **REQ-5.6** | PHASES §11 line 2812 | Map `NotificationJob` payload to adapter calls without re-rendering. | `src/queue/dispatch.ts` | `tests/queue/dispatch.test.ts` (TC-W-UNIT-02) |
| **REQ-5.7** | PHASES §11 line 2813 | Deterministic 3-tier error classification: retryable vs non-retryable. | `src/queue/error-classifier.ts` | `tests/queue/error-classifier.test.ts` (TC-W-UNIT-03) |
| **REQ-5.8** | PHASES §11 line 2819 | Non-retryable failure moves immediately to DLQ without retrying via `UnrecoverableError`. | `src/queue/worker.ts`, `src/queue/dlq.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-03) |
| **REQ-5.9** | Architecture §12.1 line 1445, ADR-008 | Pino structured logging with `traceId` correlation and credential redaction. | `src/queue/worker.ts`, `src/queue/dispatch.ts` | `tests/queue/worker.test.ts` (TC-W-UNIT-06) |
| **REQ-5.10** | Architecture §A.4.1 line 1656 | Respect Redis key namespace `bull:notifykit:*` for all workers and DLQ. | `src/queue/worker.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-01) |
| **REQ-5.11** | Robustness & Safety | Bijective Base64URL colon-free deterministic DLQ job IDs (`dlq-${channel}-${b64urlId}`) preventing key corruption and deduplicating while in Redis. | `src/queue/dlq.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-06) |
| **REQ-5.12** | Robustness & Safety | DLQ enqueue failure safety: re-throw error so source job remains in failed state. | `src/queue/worker.ts`, `src/queue/dlq.ts` | `tests/queue/worker-integration.test.ts` (TC-W-INT-07) |
| **REQ-5.13** | Robustness & Safety | Pre-construction validation: fail fast synchronously with `MissingAdapterError` before any workers are created if an explicitly requested channel lacks an adapter. | `src/orchestrator/notifier.ts`, `src/queue/worker.ts` | `tests/queue/worker.test.ts` (TC-W-UNIT-07) |
| **REQ-5.14** | Robustness & Safety | Dynamic channel selection: when `channels` is omitted, filter only configured and resolvable channels. | `src/orchestrator/notifier.ts` | `tests/queue/worker.test.ts` (TC-W-UNIT-08) |

---

## 3. Architecture & Worker Lifecycle Design

```
                     ┌───────────────────────────────────────────────┐
                     │          Redis (bull:notifykit:*)             │
                     └───────┬───────────────────────────────┬───────┘
                             │ BLMOVE / BRPOPLPUSH           │
                             ▼                               ▼
                 ┌───────────────────────┐       ┌───────────────────────┐
                 │  Worker: email        │       │  Worker: sms          │
                 │  (concurrency: N)     │       │  (concurrency: N)     │
                 └───────────┬───────────┘       └───────────┬───────────┘
                             │                               │
                             ▼                               ▼
                     ┌───────────────────────────────────────────────┐
                     │           Adapter Dispatcher                  │
                     │  (dispatchJob: map payload -> adapter method) │
                     └───────┬───────────────────────────────┬───────┘
                             │                               │
                Success (true)                               Throws or success: false
                             │                               │
                             ▼                               ▼
                     ┌───────────────┐               ┌───────────────────────┐
                     │ Complete Job  │               │ Error Classifier      │
                     │ (Redis Ack)   │               │ (3-Tier Precedence)   │
                     └───────────────┘               └───────────┬───────────┘
                                                                 │
                                     ┌───────────────────────────┴───────────────────────────┐
                                     ▼                                                       ▼
                             [ Retryable Error ]                                    [ Non-Retryable Error ]
                                     │                                                       │
                       attemptsMade + 1 < attempts?                                          │
                                     │                                                       │
                      ┌──────────────┴──────────────┐                                        │
                     YES                            NO                                       │
                      │                              │                                       │
                      ▼                              ▼                                       ▼
              ┌───────────────┐              ┌───────────────────────────────────────────────────────┐
              │ Re-throw to   │              │ Route to DLQ (bull:notifykit:dlq)                     │
              │ BullMQ Backoff│              │ Base64URL ID: dlq-${channel}-${b64urlId}              │
              └───────────────┘              │ If Non-Retryable: Throw BullMQ UnrecoverableError     │
                                             │ If Max Attempts: Re-throw error                       │
                                             └───────────────────────────────────────────────────────┘
```

### 3.1 Worker Instantiation & Key Prefixing
- For each targeted channel in `channels` (e.g. `['email', 'sms']`), NotifyKit instantiates a BullMQ `Worker`:
  ```typescript
  new Worker<NotificationJob>(channel, async (job) => processJob(job), {
    connection: redisClient,
    prefix: 'bull:notifykit',
    concurrency: channelConcurrency,
  });
  ```
- Resulting internal BullMQ queues listened to:
  - `email` with prefix `bull:notifykit` → monitors `bull:notifykit:email:*`
  - `sms` with prefix `bull:notifykit` → monitors `bull:notifykit:sms:*`
  - `push` with prefix `bull:notifykit` → monitors `bull:notifykit:push:*`
- Matches Phase 3 `QueueRegistry` prefix and queue naming contracts exactly.

### 3.2 Concurrency Architecture
- Concurrency defines the maximum number of simultaneous jobs processed in parallel by a single worker instance.
- Configurable globally or on a per-channel basis via `StartWorkerOptions`:
  ```typescript
  export interface StartWorkerOptions {
    channels?: Array<'email' | 'sms' | 'push'>;
    concurrency?: number | Partial<Record<'email' | 'sms' | 'push', number>>;
  }
  ```
- Defaults:
  - Global default: `5` concurrent jobs per worker.
  - If a channel-specific override is provided (e.g. `{ concurrency: { email: 10, sms: 2 } }`), it takes precedence for that channel.

### 3.3 Synchronous Validation & Worker State Machine
- **Synchronous Pre-Construction Validation:**
  Before constructing any BullMQ `Worker` instance, `startWorker()` executes synchronous validation:
  1. If workers are already active for this instance, logs a warning and returns immediately.
  2. If `channels` is omitted: resolves configured providers using `resolveChannelAdapters()`; selects only channels with configured, resolvable adapters. If no channels are resolvable, logs a warning and returns without constructing workers.
  3. If `channels` is explicitly passed: validates every requested channel against `config.providers`. If an adapter is missing, throws `MissingAdapterError` synchronously.
  4. Validates concurrency options (must be positive integers). If invalid, throws `NotifyKitError` synchronously.
- **Worker Construction & Failure Behavior:**
  - After synchronous pre-validation passes, workers are instantiated in a loop.
  - If unexpected runtime errors occur during worker instantiation (e.g. constructor failure):
    - Any workers constructed earlier in that call immediately have background teardown initiated (`w.close().catch(...)`).
    - The method does NOT use `await` or claim cleanup is complete; it initiates teardown in the background, clears the instance's active worker map, and re-throws the error synchronously to the caller.
- **Graceful Shutdown (`stopWorker()`):**
  - Normal graceful shutdown is performed via `await notifier.stopWorker(): Promise<void>`.
  - Awaits `Promise.all(Array.from(workers.values()).map(w => w.close()))`.
  - Drains in-flight work and guarantees that worker blocking sockets are cleanly terminated before resolving.

---

## 4. Retry Semantics & Error Classification Matrix

### 4.1 Exact Retry-Count Semantics in BullMQ v5
- Phase 3 established `DEFAULT_RETRY_POLICY = { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }`.
- In BullMQ v5, `attempts: 3` defines **3 total processing attempts** (1 initial execution + up to 2 retry attempts):
  - **Attempt 1 (Initial):** `job.attemptsMade === 0`. If execution fails, BullMQ increments `attemptsMade` to 1. Since 1 < 3, it schedules retry 1 with 1,000 ms backoff (`1000 * 2^0`).
  - **Attempt 2 (Retry 1):** `job.attemptsMade === 1`. If execution fails, BullMQ increments `attemptsMade` to 2. Since 2 < 3, it schedules retry 2 with 2,000 ms backoff (`1000 * 2^1`).
  - **Attempt 3 (Retry 2):** `job.attemptsMade === 2`. If execution fails, BullMQ increments `attemptsMade` to 3. Since 3 >= 3, maximum attempts are exhausted. The job transitions to the `failed` state.
- **Worker Terminal Condition for Retryable Failures:**
  Inside the worker processor, the current attempt is `job.attemptsMade + 1`. A failure is terminal when:
  `job.attemptsMade + 1 >= (job.opts.attempts ?? 3)`

### 4.2 Error Classification Precedence
Error classification follows a deterministic 3-tier hierarchy:

1. **Tier 1 (Highest Precedence): Explicit `ProviderResult.retryable`**
   - If the adapter returns an object with `retryable: true`, the failure is classified as **Retryable**.
   - If the adapter returns an object with `retryable: false`, the failure is classified as **Non-Retryable**.
2. **Tier 2: Recognized Structured Error Metadata**
   - **Transient Network Errors:** `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `EAI_AGAIN`, `UND_ERR_CONNECT_TIMEOUT`, `fetch failed` → **Retryable**.
   - **HTTP Server & Rate Limit Codes:** Status `408`, `429`, `500`, `502`, `503`, `504` → **Retryable**.
   - **Client Errors:** Status `400`, `401`, `403`, `404`, `422` → **Non-Retryable**.
   - **Validation / Configuration Errors:** `ZodError`, schema parsing errors, missing adapter → **Non-Retryable**.
3. **Tier 3 (Lowest Precedence / Safe Fallback): Unknown Errors**
   - Any runtime exception or unclassified failure defaults to **Retryable** up to the remaining attempt limit. This guarantees transient glitches do not lead to dropped notifications.

### 4.3 Handling `retryAfterMs` & Backoff Delay
- BullMQ's queue-level backoff contract uses the fixed exponential formula starting at 1,000 ms.
- Dynamic per-job backoff delays (e.g. honoring `retryAfterMs`) require moving jobs to delayed status manually (`job.moveToDelayed()`), which represents an unnecessary public API and queue contract expansion.
- **Decision:** Dynamic `retryAfterMs` handling is **formally deferred** to a future phase. In Phase 5, all retryable errors strictly follow the established exponential backoff contract (`1000ms * 2^(attemptsMade - 1)`).

### 4.4 Error Classification Matrix

| Outcome / Error Category | Concrete Examples | Precedence Tier | Classification | Worker Action | BullMQ Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Provider Success** | `{ success: true, messageId: 'msg_123' }` | Result Check | **Success** | Log success. Return result. | Job acknowledged; removed per `removeOnComplete`. |
| **Explicit Retryable Result** | `{ success: false, error: 'Rate limit', retryable: true }` | Tier 1 | **Retryable** | If attempts remain: throw retryable error.<br>If attempts exhausted: route to DLQ, re-throw error. | If attempts remain: BullMQ delays retry.<br>If exhausted: job marked failed. |
| **Explicit Non-Retryable Result** | `{ success: false, error: 'Invalid number', retryable: false }` | Tier 1 | **Non-Retryable** | Route immediately to DLQ with Base64URL ID. Throw `UnrecoverableError`. | BullMQ aborts retries immediately; marks job failed. |
| **Network Socket Glitch** | `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND` | Tier 2 | **Retryable** | If attempts remain: re-throw error.<br>If attempts exhausted: route to DLQ, re-throw error. | If attempts remain: BullMQ schedules exponential retry.<br>If exhausted: job marked failed. |
| **Auth / Bad Credentials** | `401 Unauthorized`, `403 Forbidden` | Tier 2 | **Non-Retryable** | Route immediately to DLQ with Base64URL ID. Throw `UnrecoverableError`. | BullMQ aborts retries immediately; marks job failed. |
| **Missing Adapter** | No provider configured for channel | Tier 2 | **Non-Retryable** | Route immediately to DLQ with Base64URL ID. Throw `UnrecoverableError`. | BullMQ aborts retries immediately; marks job failed. |
| **Malformed Job Payload** | Fails `notificationJobSchema.safeParse` | Tier 2 | **Non-Retryable** | Route immediately to DLQ with Base64URL ID. Throw `UnrecoverableError`. | BullMQ aborts retries immediately; marks job failed. |
| **Ambiguous / Untagged Error** | Generic `Error('Something broke')` | Tier 3 (Fallback) | **Retryable** | If attempts remain: re-throw error.<br>If attempts exhausted: route to DLQ, re-throw error. | Standard BullMQ exponential retry until max attempts, then DLQ. |

---

## 5. Dead-Letter Queue (DLQ) Design & Failure Safety

### 5.1 DLQ Queue Configuration
- Logical Queue Name: `notifykit:dlq`
- Internal BullMQ Queue Name: `dlq` (prefix: `bull:notifykit`)
- Redis Keys Generated: `bull:notifykit:dlq:*`
- Retention: `removeOnComplete: false`, `removeOnFail: false` (retained indefinitely for manual inspection and audit).

### 5.2 Dead-Letter Payload Contract (`DeadLetterJob`)

```typescript
export interface DeadLetterErrorDetails {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  retryable: boolean;
  httpStatus?: number;
}

export type TerminalFailureReason =
  | 'MAX_RETRIES_EXCEEDED'
  | 'NON_RETRYABLE_ERROR'
  | 'MALFORMED_JOB'
  | 'MISSING_ADAPTER'
  | 'UNHANDLED_EXCEPTION';

export interface DeadLetterJob {
  /** Copy of the complete original NotificationJob payload */
  originalJob: NotificationJob;
  /** Detailed error classification that caused dead-lettering */
  error: DeadLetterErrorDetails;
  /** Unix timestamp (milliseconds) when the job was moved to DLQ */
  failedAt: number;
  /** Total number of processing attempts executed before dead-lettering */
  attemptsMade: number;
  /** High-level categorized failure reason */
  terminalReason: TerminalFailureReason;
  /** Original correlation trace identifier */
  traceId: string;
}
```

### 5.3 Collision-Resistant Colon-Free DLQ Deduplication & Bounded Idempotency
- **Why Character Replacement Is Insufficient:**
  Replacing non-alphanumeric characters with an underscore (e.g. `replace(/[^a-zA-Z0-9]/g, '_')`) is lossy and causes collisions: for instance, distinct IDs `a-b` and `a.b` both collapse to `a_b`.
- **Collision-Resistant Base64URL Encoding:**
  To guarantee strict collision-resistance with zero colons `:`, the source job ID is encoded using URL-safe Base64URL (RFC 4648 §5):
  ```typescript
  const encodedSourceJobId = Buffer.from(job.id, 'utf8').toString('base64url');
  const dlqJobId = `dlq-${job.channel}-${encodedSourceJobId}`;
  await dlqQueue.add('dlq', deadLetterPayload, { jobId: dlqJobId });
  ```
  - **Bijective 1-to-1 Mapping:** Base64URL encoding is mathematically collision-free ($ID_1 \ne ID_2 \implies b64url(ID_1) \ne b64url(ID_2)$).
  - **BullMQ v5.81.5 Compatibility Evidence:** BullMQ constructs Redis keys via `${prefix}:${queueName}:${jobId}`. Base64URL strings contain exclusively `[A-Za-z0-9_-]` with zero colons `:`, keeping the Redis key cleanly structured as `bull:notifykit:dlq:dlq-${channel}-${encodedSourceJobId}` without splitting errors. BullMQ `queue.js` forbids only job IDs equal to `'0'` or starting with `'0:'`; `dlq-...` passes all BullMQ validations.
  - **Preservation of Source ID:** The intact original source job ID (UUID v7 string) is preserved untouched in `deadLetterPayload.originalJob.id`.
- **Bounded Deduplication Semantics:**
  - BullMQ deduplicates duplicate `queue.add()` calls with the same `jobId` **only while that job ID remains present in the DLQ in Redis**.
  - If an operator manually removes or purges a DLQ record, a subsequent delayed replay could re-insert it. NotifyKit documents this as bounded idempotency, without falsely claiming distributed exactly-once delivery.
- **Source Job State vs DLQ Record:**
  - The source job remains in its channel queue (`bull:notifykit:<channel>:<jobId>`) in the `failed` state.
  - The DLQ record lives independently in `bull:notifykit:dlq:dlq-${channel}-${encodedSourceJobId}`.

### 5.4 DLQ Enqueue Failure Safety
If enqueuing to `notifykit:dlq` throws an error (e.g. Redis disconnection or OOM during the DLQ push):
1. The worker logs a `fatal` diagnostic log containing `traceId`, `jobId`, the original error, and the DLQ enqueue error.
2. The worker **re-throws the error** without catching.
3. Because the processor threw, BullMQ keeps the source job in the active channel queue (or transitions it to `failed` under `bull:notifykit:<channel>:failed`).
4. **Zero Message Loss Guarantee:** The source notification payload is never silently acknowledged or dropped if the DLQ fails.

---

## 6. Public API Impact Analysis & Lifecycle Design

### 6.1 `startWorker()` Contract (Preserved Synchronous Signature)
- Preserves the existing synchronous `startWorker()` return contract (`void`):
  ```typescript
  startWorker(opts?: StartWorkerOptions): void;
  ```
- Options:
  ```typescript
  export interface StartWorkerOptions {
    channels?: Array<'email' | 'sms' | 'push'>;
    concurrency?: number | Partial<Record<'email' | 'sms' | 'push', number>>;
  }
  ```
- **Synchronous Pre-Validation:**
  - Pre-validates all requested channels, adapters, and concurrency options synchronously before any worker is instantiated.
  - If `opts?.channels` is omitted, defaults strictly to resolvable channels in `config.providers`.
  - If `opts?.channels` contains an unconfigured channel, fails fast at startup by throwing `MissingAdapterError` synchronously.
  - If worker construction throws mid-loop, background teardown is initiated asynchronously on earlier-created workers (`w.close().catch(...)`); `startWorker()` does not use `await` and re-throws the error synchronously.
- Calling `startWorker()` when workers are already running logs a warning and performs no-op (idempotent).

### 6.2 Proposed Public API Addition: `notifier.stopWorker()`
- **Specification Authority:** `PHASES.md` §11 explicitly mandates `stopWorker()`:
  - Line 2816: `- [ ] stopWorker() graceful shutdown`
  - Line 2830: `- [ ] stopWorker() drains in-flight jobs before closing`
- **Instance-Scoped API Proposal:** Add `stopWorker(): Promise<void>` to `Notifier`:
  ```typescript
  export interface Notifier {
    notify(event: NotificationEvent): Promise<NotifyResult>;
    registerTemplate(id: string, source: string): void;
    startWorker(opts?: StartWorkerOptions): void;
    stopWorker(): Promise<void>; // Proposed Phase 5 Addition
  }
  ```
- **Lifecycle Semantics:**
  - `await notifier.stopWorker()` stops all BullMQ Workers owned by that notifier instance.
  - Waits for active in-flight jobs to finish executing (draining).
  - Closes duplicated worker connections.
  - Calling `stopWorker()` repeatedly is safe and idempotent (resolves immediately if already stopped).
- **Omission of Standalone `stopWorkers()`:** Standalone package-level `stopWorkers()` is omitted from public exports to avoid redundant API surface. Lifecycle management remains strictly instance-scoped.

---

## 7. Redis Connection Ownership & Shutdown Ordering

### 7.1 Connection Ownership in BullMQ v5
In BullMQ v5, when an `ioredis` instance is passed via `{ connection: redisClient }`:
- The passed client is **borrowed** for general command operations.
- BullMQ's internal `RedisConnection` duplicates the client (`client.duplicate()`) to establish dedicated blocking connections (`bclient`) for `BRPOPLPUSH` / `BLMOVE`.
- When `worker.close()` is called:
  - BullMQ closes the duplicated blocking connection.
  - BullMQ does **not** close the borrowed main `redisClient`.

### 7.2 Resource Ownership Matrix

| Resource | Created By | Owned By | Closed By |
| :--- | :--- | :--- | :--- |
| **Worker Instances** | `notifier.startWorker()` | `Notifier` instance | `notifier.stopWorker()` |
| **Worker Blocking Clients (`bclient`)** | BullMQ internal | BullMQ Worker | `worker.close()` |
| **Default QueueRegistry & Queues** | `getOrCreateDefaultRegistry()` | Module-level singleton | `resetDefaultRegistry()` |
| **Default Redis Client** | `createRedisConnection()` | Module-level singleton | `closeRedisConnection()` |
| **Custom QueueRegistry** | Caller application | Caller application | Caller application (`registry.close()`) |
| **Custom Redis Client** | Caller application | Caller application | Caller application (`client.quit()`) |

### 7.3 Shutdown Ordering
For an application running NotifyKit workers:
1. `await notifier.stopWorker()` — Drains in-flight jobs and closes worker blocking sockets.
2. `await resetDefaultRegistry()` — Closes BullMQ Queue producer instances.
3. `await closeRedisConnection()` — Closes the shared ioredis connection.

### 7.4 Multi-URL Limitation (Preserved)
Multiple notifier instances configured with different Redis URLs continue to share the first initialized default singleton connection per Phase 4. This limitation is preserved without modification.

---

## 8. Proposed File Changes & Rationale

| Action | File Path | Rationale |
| :--- | :--- | :--- |
| **Create** | `packages/core/src/queue/dispatch.ts` | Dispatches `NotificationJob` to provider adapter methods (`sendEmail`, `sendSms`, `sendPush`) and normalizes provider results. |
| **Create** | `packages/core/src/queue/error-classifier.ts` | Implements 3-tier error classification hierarchy and identifies non-retryable errors for `UnrecoverableError`. |
| **Create** | `packages/core/src/queue/dlq.ts` | Assembles `DeadLetterJob` with Base64URL colon-free deterministic ID (`dlq-${channel}-${b64urlId}`) and enqueues to `notifykit:dlq`. |
| **Create** | `packages/core/src/queue/worker.ts` | BullMQ `Worker` factory, per-channel worker management, pre-construction validation, background cleanup initiation on construction failure, and graceful drain. |
| **Modify** | `packages/core/src/orchestrator/notifier.ts` | Implement synchronous `startWorker()` with pre-construction validation and propose `stopWorker()` on `Notifier`. |
| **Modify** | `packages/core/src/queue/index.ts` | Re-export worker functions, types, DLQ payload contract, and error classifier. |
| **Modify** | `packages/core/src/index.ts` | Re-export `startWorker` options and `DeadLetterJob` interface for consumers. |
| **Create** | `packages/core/tests/queue/dispatch.test.ts` | Unit tests for adapter dispatch and payload mapping across all channels. |
| **Create** | `packages/core/tests/queue/error-classifier.test.ts` | Unit tests for 3-tier error classification rules and `UnrecoverableError` tagging. |
| **Create** | `packages/core/tests/queue/dlq.test.ts` | Unit tests for DLQ payload construction, Base64URL colon-free IDs, and enqueue logic. |
| **Create** | `packages/core/tests/queue/worker.test.ts` | Unit tests for worker creation, concurrency options, pre-construction channel validation, construction failure cleanup initiation, and shutdown idempotency. |
| **Create** | `packages/core/tests/queue/worker-integration.test.ts` | Real-Redis integration tests via Testcontainers: end-to-end processing, retry backoff, DLQ routing, DLQ deduplication, and graceful drain. |

---

## 9. Ordered Implementation Tasks & Subphases

### Subphase 1: Dispatcher, Error Classification & DLQ Modules (Pure Logic & Unit Tests)
- **Task 5.1: Adapter Dispatcher (`src/queue/dispatch.ts`):**
  - Implement `dispatchJob(job: NotificationJob, providers?: NotifierConfig['providers'], logger?: Logger): Promise<ProviderResult>`.
  - Validate recipient channel data; call corresponding adapter method.
  - Return `{ success, messageId, error, retryable }`.
  - Unit test: `tests/queue/dispatch.test.ts`.
- **Task 5.2: Error Classifier (`src/queue/error-classifier.ts`):**
  - Implement `classifyError(err: unknown, result?: ProviderResult): ClassifiedError`.
  - Implement 3-tier precedence: explicit result flag > recognized metadata > fallback to retryable.
  - Unit test: `tests/queue/error-classifier.test.ts`.
- **Task 5.3: DLQ Router (`src/queue/dlq.ts`):**
  - Implement `routeToDlq(job: NotificationJob, error: unknown, attemptsMade: number, terminalReason: TerminalFailureReason, options: DlqRoutingOptions): Promise<string>`.
  - Enforce Base64URL colon-free deterministic job ID `dlq-${job.channel}-${Buffer.from(job.id).toString('base64url')}`.
  - Failure-safety: re-throw error if DLQ enqueue fails.
  - Unit test: `tests/queue/dlq.test.ts`.

### Subphase 2: Worker Core & Lifecycle Implementation
- **Task 5.4: BullMQ Worker Engine (`src/queue/worker.ts`):**
  - Implement `createChannelWorker(channel, processor, options)`.
  - Implement processor flow: `dispatchJob()` → `classifyError()` → `routeToDlq()`.
  - Manage worker registry `Map<QueueChannel, Worker>`.
  - Implement synchronous pre-construction validation: skip unconfigured channels when omitted; throw `MissingAdapterError` synchronously when explicitly requested channel is missing.
  - Implement background teardown initiation if worker construction fails mid-loop.
  - Implement `stopWorkers()` draining in-flight work.
  - Unit test: `tests/queue/worker.test.ts`.
- **Task 5.5: Connect Orchestrator Notifier (`src/orchestrator/notifier.ts`):**
  - Wire synchronous `notifier.startWorker(opts)` to `startWorkers()`.
  - Implement `notifier.stopWorker()` awaiting `stopWorkers()`.
  - Unit test: `tests/orchestrator/create-notifier.test.ts`.

### Subphase 3: Real-Redis Integration Testing & Verification
- **Task 5.6: Real-Redis Worker Integration Suite (`tests/queue/worker-integration.test.ts`):**
  - Full end-to-end test against Testcontainers `redis:7-alpine`:
    - TC-W-INT-01: Enqueue job → worker picks up → mock adapter receives → job completed.
    - TC-W-INT-02: Transient error → 3 total processing attempts with exponential backoff → moves to DLQ.
    - TC-W-INT-03: Non-retryable error → immediately moves to DLQ on attempt 1 without retrying.
    - TC-W-INT-04: Graceful shutdown → in-flight jobs finish before `stopWorker()` resolves.
    - TC-W-INT-05: Worker reconnects cleanly after Redis restart/disconnection.
    - TC-W-INT-06: Base64URL colon-free deterministic DLQ deduplication on duplicate terminal processing.
    - TC-W-INT-07: DLQ enqueue failure preserves source job in channel failed state.
- **Task 5.7: Full Verification Suite:**
  - Monorepo checks: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`, `npm run size-limit`.

---

## 10. Test-First Acceptance Criteria (DoD per Task)

### Task 5.1 Acceptance Criteria (Dispatch)
- [ ] Maps `email` job to `EmailProvider.sendEmail({ to, from, subject, html, text })`.
- [ ] Maps `sms` job to `SmsProvider.sendSms({ to, from, body, templateId, variables })`.
- [ ] Maps `push` job to `PushProvider.sendPush({ token, title, body, data })`.
- [ ] Throws `MissingAdapterError` if channel provider is not configured.
- [ ] Returns provider result directly when adapter resolves cleanly.

### Task 5.2 Acceptance Criteria (Error Classification)
- [ ] Tier 1: Explicit `ProviderResult.retryable: false` classifies as non-retryable even if error message looks transient.
- [ ] Tier 2: Network errors (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `fetch failed`) classify as `retryable: true`.
- [ ] Tier 2: Rate limits (`429`) and server errors (`500`, `502`, `503`, `504`) classify as `retryable: true`.
- [ ] Tier 2: Client errors (`400`, `401`, `403`, `404`, `422`) classify as `retryable: false`.
- [ ] Tier 3: Unrecognized exceptions fallback to `retryable: true`.
- [ ] `UnrecoverableError` is thrown only for terminal non-retryable failures.

### Task 5.3 Acceptance Criteria (DLQ)
- [ ] Enqueues `DeadLetterJob` containing intact `originalJob`, `error`, `failedAt`, `attemptsMade`, and `terminalReason`.
- [ ] Enforces Base64URL colon-free deterministic job ID `dlq-${channel}-${Buffer.from(job.id).toString('base64url')}`.
- [ ] Deduplicates repeat insertions while the DLQ job remains present in Redis.
- [ ] Enforces permanent retention (`removeOnComplete: false`, `removeOnFail: false`).
- [ ] Failure-safety: if DLQ enqueue throws, error is re-thrown and not swallowed.

### Task 5.4 & 5.5 Acceptance Criteria (Worker Lifecycle)
- [ ] `startWorker()` executes synchronously and returns `void`.
- [ ] When `channels` is omitted, starts workers only for configured, resolvable channels.
- [ ] When `channels` explicitly requests an unconfigured channel, throws `MissingAdapterError` synchronously before constructing any workers.
- [ ] If worker construction throws mid-loop, background teardown is initiated on earlier-constructed workers and the error is re-thrown.
- [ ] Respects per-channel concurrency settings.
- [ ] `stopWorker(): Promise<void>` stops accepting new jobs and drains active jobs before closing.
- [ ] Calling `stopWorker()` repeatedly is idempotent and safe.

### Task 5.6 Acceptance Criteria (Integration Suite)
- [ ] Enqueued job processed by mock adapter in < 1000ms.
- [ ] Transient failure executes exactly 3 total attempts with exponential backoff before landing in DLQ.
- [ ] Non-retryable failure moves to DLQ on attempt 1 without retry delays.
- [ ] Duplicate terminal failure does not create duplicate entries in DLQ while record exists.
- [ ] DLQ enqueue failure keeps the source job in `bull:notifykit:<channel>:failed`.
- [ ] In-flight job running during `stopWorker()` finishes cleanly.
- [ ] Testcontainers Redis unavailability in CI causes explicit test failure (no silent skips).

---

## 11. Security, Credential-Redaction & Data Retention

- **DLQ Payload Sensitivity & Indefinite Retention:**
  - DLQ records retain the complete `NotificationJob` payload, including recipient contact information (`to.email`, `to.phone`, `to.pushToken`) and `renderedBody`.
  - Because `notifykit:dlq` retention is permanent (`removeOnComplete: false`, `removeOnFail: false`), these payloads persist in Redis indefinitely until manual triage or administrative purging.
  - Production deployments must enforce Redis encryption-in-transit (TLS), encryption-at-rest, and strict Redis ACL authentication.
- **Credential Redaction in Worker Logs:**
  - All worker logging uses the centralized Pino logger created via `createScopedLogger({ traceId, jobId, channel })`.
  - Credentials in provider configs (`authToken`, `apiKey`, `password`, `secret`) are redacted via Pino `fast-redact` patterns configured in Phase 4.
  - Job payloads in worker logs do NOT print raw recipient tokens or passwords in plain text.
- **Worker Process Isolation:**
  - Workers run within the host Node.js application process without spawning external shell processes or executing unvalidated code.

---

## 12. Performance & Concurrency Considerations

- **CPU Overhead:** Worker does zero template rendering (rendered at enqueue time per ADR-004), leaving CPU free for network I/O with provider APIs.
- **Memory Overhead:** BullMQ workers maintain minimal in-memory state; job payloads are garbage-collected immediately upon acknowledgment.
- **Redis Connection Sharing:** Worker commands use the borrowed ioredis connection with `maxRetriesPerRequest: null`; blocking connections are duplicated and managed internally by BullMQ.
- **Bundle Size Budget:**
  - Current bundle size: `6.39 kB` brotlied.
  - Budget: `≤ 60.00 kB` (currently 10.6% utilized).
  - Phase 5 introduces no new external dependencies; projected addition is < 2.5 kB brotlied, remaining well below 10 kB total.

---

## 13. Risk Register & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Infinite Retries on Permanent Failures** | High (wasted resources, quota depletion) | Low | Strict 3-tier error classification. Non-retryable errors throw `UnrecoverableError` immediately. |
| **Duplicate DLQ Records on Replay** | Medium (skewed DLQ triage counts) | Medium | Base64URL colon-free deterministic DLQ job IDs. |
| **Source Job Lost on DLQ Enqueue Failure** | High (dropped notification) | Low | Failure-safe DLQ routing: re-throw error so BullMQ keeps job in channel's failed state. |
| **Zombie / Stalled Jobs on Process Crash** | Medium (delayed delivery) | Low | BullMQ's automatic lock renewal (`lockDuration: 30000ms`, `stalledInterval: 30000ms`) re-queues stalled jobs automatically if a worker node crashes mid-flight. |
| **Duplicate Delivery on Network Glitch** | Low to Medium (recipient receives duplicate message) | Medium | Document at-least-once delivery semantics. Provider adapters in Phase 6–9 will utilize provider idempotency keys where supported. |
| **Silent DLQ Flooding from Missing Adapter** | High (all jobs dead-lettered) | Medium | Synchronous pre-construction validation throws `MissingAdapterError` before any workers start. |
| **Partial Startup Dangling Connections** | Medium | Low | Catch initialization errors, initiate background teardown on constructed workers, and clear worker map before re-throwing. |

---

## 14. Definition of Done (DoD) & CI Gates

### 14.1 Acceptance Criteria
- [ ] `startWorker()` executes synchronously, validates pre-construction, and starts BullMQ workers without starting on module import.
- [ ] Enqueued jobs are processed and dispatched to mock adapters within 1000ms.
- [ ] Transient failures are processed for exactly 3 total attempts with exponential backoff (1s, 2s).
- [ ] Terminal failures land in `notifykit:dlq` with full original job data, error details, and Base64URL colon-free deterministic job ID.
- [ ] Non-retryable failures bypass retries and route directly to DLQ on attempt 1.
- [ ] `stopWorker()` cleanly drains active in-flight jobs before closing.
- [ ] Unit tests achieve ≥ 90% coverage across statements, branches, functions, and lines in `src/queue/**`.
- [ ] Real-Redis integration suite passes in CI across Node.js 20.x, 22.x, and 24.x using Testcontainers.
- [ ] Bundle size remains ≤ 60 kB.
- [ ] Monorepo verification commands pass:
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:coverage`
  - `npm run build`
  - `npm run size-limit`

---

## 15. Explicit Decisions & Open Questions for Human Review

### Decisions Settled by Master Specification & Repository Contracts:
1. **Explicit Startup Only (ADR-005):** Workers are never started on import; only upon synchronous `notifier.startWorker()`.
2. **Pre-rendered Body (ADR-004):** Workers consume `job.renderedBody` without invoking Handlebars.
3. **Retry Semantics:** `attempts: 3` means exactly 3 total processing attempts (1 initial + up to 2 retries) with exponential backoff starting at 1,000 ms.
4. **Deferred Feature:** Dynamic `retryAfterMs` handling is deferred; all retries use the established exponential backoff policy.
5. **Omission of Standalone `stopWorkers()`:** Worker shutdown is kept instance-scoped on `Notifier`.
6. **Colon-Free DLQ IDs:** DLQ job IDs use `dlq-${channel}-${Buffer.from(job.id).toString('base64url')}` to prevent redundant colon delimiters in BullMQ Redis keys (`bull:notifykit:dlq:dlq-${channel}-${encodedId}`).
7. **No Vendor SDKs in Core:** Tested with mock adapters; vendor SDKs arrive in Phases 6–9.

### Questions for Human Confirmation:
1. **`Notifier.stopWorker()` Public Interface Addition:**
   - *Proposal:* Formally declare `stopWorker(): Promise<void>` on the `Notifier` interface to provide instance-level graceful shutdown draining in-flight jobs as mandated by `PHASES.md` §11 line 2816.
   - *Recommendation:* Approve adding `stopWorker(): Promise<void>` to `Notifier`.
2. **Default & Explicit Channel Selection in `startWorker()`:**
   - *Proposal:*
     - When `opts?.channels` is omitted, automatically start workers only for channels with resolvable provider adapters in `config.providers`.
     - When `opts?.channels` is explicitly passed and any requested channel has no resolvable provider adapter, throw `MissingAdapterError` synchronously prior to constructing any workers.
   - *Recommendation:* Approve this behavior to prevent silent failure loops.
