# NotifyKit — Phase 4 (Notification Orchestrator) Implementation Plan

> **Document Type:** Master Implementation Plan (Planning Only)  
> **Status:** Awaiting human review and explicit implementation authorization.  
> **Canonical Plan File:** `Docs/PHASE-4-PLAN.md`  
> **Phase Target:** Phase 4 — Notification Orchestrator  
> **Target Workspace:** `packages/core` (within `notifykit` monorepo)  
> **Execution Constraint:** Planning Only — No implementation, package installation, build/test execution, or Git operations authorized.

---

## 1. Document Control & Specification Authority

### 1.1 Source of Truth
This plan is derived directly from [`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/NOTIFYKIT-MASTER-SPECIFICATION.md) and preserves all completed work and human-approved decisions from [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md), [`Docs/PHASE-1-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-1-PLAN.md), [`Docs/PHASE-2-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-2-PLAN.md), and [`Docs/PHASE-3-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-3-PLAN.md).

Authoritative sections governing Phase 4:
- **Phase 4 Scope & Deliverables:** Section 3 (`PHASES.md` §10, lines 2745–2791).
- **Core Library Public API:** Section 1 (PRD v1.0 §10.1, lines 291–314).
- **Core Requirements:** Section 1 (PRD v1.0 §13, lines 355–363) — `CORE-01` (input schema validation), `CORE-02` (fast enqueue with job ID return), and `CORE-08` (Pino logging with correlation key).
- **Module Architecture & Dependency Matrix:** Section 2 (Architecture v1.1 §5.2 Module 4 & §5.3, lines 878–912) — `orchestrator` is the central brain coordinating `interfaces`, `config`, `templates`, `queue`, and `logging`.
- **Enqueue Flow Sequence Diagram:** Section 2 (Architecture v1.1 §6.1, lines 916–943) — `notify()` validates event, renders template, enqueues job to BullMQ, and returns immediately with job ID.
- **Provider Injection Contract:** Section 2 (Architecture v1.1 §9.3, lines 1134–1153) — Adapters injected at runtime via `createNotifier()`.
- **Standard Error Envelope & Codes:** Section 2 (Architecture v1.1 §B.8.3, lines 1428–1445) — `E_INVALID_EVENT` (400), `E_MISSING_ADAPTER` (400), `E_MISSING_TEMPLATE` (400), `E_MISSING_VARIABLE` (400), `E_REDIS_UNAVAILABLE` (503), `E_QUEUE_FULL` (503).
- **Observability & Credential Redaction:** Section 2 (Architecture v1.1 §12.1, lines 1551–1571) — Pino logger with redaction of `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`, and `traceId` correlation.
- **Architectural Decision Records (ADRs):**
  - **ADR-003:** Adapters Injected, Not Imported (lines 2111–2116).
  - **ADR-004:** Render Templates at Enqueue Time (lines 2117–2122).
  - **ADR-005:** Explicit `startWorker()`, Not Implicit (lines 2123–2128).
  - **ADR-008:** Pino for Logging (lines 2141–2146).
  - **ADR-010:** API-First — Dual-Surface Versioning Discipline (lines 2184–2217).
- **Release Gate 4 → 5:** Section 3 (`PHASES.md` §23, lines 3340–3343) — `notify()` produces correct jobs; all validation edge cases tested.
- **Approved Dependencies:** Section 4 (`AGENTS.md` §6.1, lines 3687–3698) — `pino` is approved for runtime logging.

### 1.2 Hierarchy of Rules & Section Priority
Per `AGENTS.md` §13:
1. **Priority 1: AGENTS.md** — Mandatory rules, dependency boundaries, error conventions, zero Git operations.
2. **Priority 2: PHASES.md** — Phase scope, deliverables, acceptance criteria, Definition of Done.
3. **Priority 3: Architecture v1.1 & Addendum** — Component structure, ADR-004 fail-fast enqueue rendering, module dependency matrix.
4. **Priority 4: PRD v1.0** — Product requirements and public API ergonomics.

### 1.3 Pre-Implementation API Compatibility Gate
Before writing any Phase 4 implementation code, the implementing agent MUST inspect and verify compatibility against the exact existing TypeScript interfaces and package exports established in Phases 1–3:
1. **`ProviderConfig` & `NotifierConfig` ([`packages/core/src/interfaces/config.ts`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/packages/core/src/interfaces/config.ts)):**
   - Actual code definition:
     ```typescript
     export interface ProviderConfig {
       type: string;
       [key: string]: unknown;
     }
     export interface NotifierConfig {
       redis?: string;
       providers: {
         email?: ProviderConfig;
         sms?: ProviderConfig;
         push?: ProviderConfig;
       };
     }
     ```
   - **Crucial Rule on `ProviderConfig`:** Do NOT assume `ProviderConfig` explicitly declares an `adapter` property. The existing interface uses `type: string` and an open index signature `[key: string]: unknown`. While ADR-003 illustrates injecting adapters at runtime (e.g. `{ type: 'twilio', adapter: new TwilioSmsProvider() }`), Phase 4 implementation must work with the existing `ProviderConfig` type. If an explicit static type expansion of `ProviderConfig` is deemed necessary, that represents a change to a Phase 1 public interface; the agent must STOP and report it for human authorization rather than silently mutating `interfaces/config.ts`.
2. **Provider Interfaces ([`packages/core/src/interfaces/providers.ts`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/packages/core/src/interfaces/providers.ts)):**
   - Verify `EmailProvider`, `SmsProvider`, `PushProvider`, ensuring all require `readonly name: string`.
3. **`NotificationEvent` ([`packages/core/src/interfaces/event.ts`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/packages/core/src/interfaces/event.ts)):**
   - Verify `to: Recipient`, `channels: Array<'email' | 'sms' | 'push'>`, `template: string`, `data: Record<string, unknown>`.
4. **`NotificationJob` ([`packages/core/src/queue/payload.ts`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/packages/core/src/queue/payload.ts)):**
   - Verify `id: string`, `channel: QueueChannel`, `provider: string`, `to: Recipient`, `templateId: string`, `renderedBody: string`, `metadata: NotificationJobMetadata`.
5. **Existing Package Exports ([`packages/core/src/index.ts`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/packages/core/src/index.ts) & `package.json`):**
   - Ensure all Phase 0–3 exports remain completely preserved with zero regressions.

---

## 2. Current Repository Baseline

An inspection of the workspace confirms the following status:
- **Monorepo Structure:** Managed with `npm` (≥10) workspaces (`packages/core`, `packages/cli`, `packages/test-utils`).
- **Phase 0 Foundation Complete:** Common TypeScript (`tsconfig.base.json`), `tsup`, Vitest (`v8` coverage provider), ESLint, Prettier, Size Limit (`size-limit@12.1.0`), and GitHub Actions matrix for Node.js 20, 22, and 24.
- **Phase 1 Complete:** Public provider interfaces (`Recipient`, `NotificationEvent`, `EmailProvider`, `SmsProvider`, `PushProvider`, `NotifierConfig`, `ProviderConfig`), base error classes (`NotifyKitError`, `ConfigError`), configuration loader and validator with `zod`, and external consumer contract tests.
- **Phase 2 Complete:** Handlebars template engine (`renderTemplate`, `TemplateStore`, built-in helpers `uppercase` and `formatDate`, Option B strict missing-variable AST validation, 1,000-render performance benchmark).
- **Phase 3 Complete:** BullMQ queue producer layer (`createRedisConnection`, `QueueRegistry`, `enqueueJob`, `notificationJobSchema`, channel retention/retry policies, `RedisUnavailableError`, `QueueFullError`, real-Redis Testcontainers integration suite, and 500-enqueue p99 latency benchmark).
- **Test Status:** 99 passing tests in `packages/core`, 1 passing smoke test in `packages/cli`, 1 passing smoke test in `packages/test-utils`.
- **Core Bundle Size:** `4.2 kB` brotlied (budget: ≤ **60 KB**).
- **Enforced Coverage Thresholds:** In `packages/core/vitest.config.ts`:
  - `src/config/**`: ≥ 90% across statements, branches, functions, and lines.
  - `src/templates/**`: ≥ 90% across statements, branches, functions, and lines.
  - `src/queue/**`: ≥ 90% across statements, branches, functions, and lines (currently 98.68% stmts, 90% branch, 94.44% funcs, 100% lines).

---

## 3. Exact Boundaries & Scope

### 3.1 In-Scope for Phase 4 (Orchestrator Module & Factory)
1. **Logging Subsystem (`packages/core/src/logging/logger.ts`):**
   - Pino instance configured with credential redaction matching `REDACT_PATHS` (`*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`) per ADR-008 and PRD §12.1.
   - Configures Pino `fast-redact` with path wildcards covering top-level and nested secret properties (e.g. `*.password`, `*.*.password`, `*.secret`, `*.*.secret`, `*.token`, `*.*.token`, `*.authToken`, `*.authKey`, `*.apiKey`).
   - Child logger factory with bindings for `traceId`, `jobId`, `channel`, and `provider`.
   - Logging level configurable via environment variable (`LOG_LEVEL`, default: `'info'`) or options.
2. **UUID v7 Generator (`packages/core/src/orchestrator/uuid.ts`):**
   - Zero-dependency RFC 9562-compliant UUID v7 generator implemented using `node:crypto` (`randomBytes` / `getRandomValues`).
   - Produces 36-character hyphenated UUID v7 identifiers for `jobId` and `traceId` per Architecture §8.2 line 1049 and §A.4.3 line 1702.
   - Guarantees millisecond-level time-ordered sorting based on 48-bit Unix timestamp. Does *not* falsely claim strict monotonic ordering within the same millisecond when random sequence bits are used without a stateful counter.
3. **Event Schema & Validation (`packages/core/src/orchestrator/event-schema.ts` & `validate.ts`):**
   - Zod runtime schema `notificationEventSchema` validating `NotificationEvent`.
   - Cross-field channel validation:
     - If `channels` includes `'email'`, `to.email` must be non-empty and RFC 5322 compliant.
     - If `channels` includes `'sms'`, `to.phone` must be non-empty and E.164 formatted.
     - If `channels` includes `'push'`, `to.pushToken` must be non-empty string.
   - Rejects empty recipient `{}`.
   - Throws `InvalidEventError` (`code: 'E_INVALID_EVENT'`) with actionable hint and correlation `traceId`.
4. **Adapter Resolution (`packages/core/src/orchestrator/resolve.ts`):**
   - Resolves target channels to configured provider adapters following ADR-003 and existing types.
   - **No Assumption of Typed `adapter` on `ProviderConfig`:** The actual `ProviderConfig` in `interfaces/config.ts` declares `type: string` and index signature `[key: string]: unknown`. The implementation must not assume `adapter` is statically declared. It resolves the provider name string by inspecting `(providerConfig as Record<string, unknown>).adapter?.name ?? providerConfig.type`.
   - If an interface modification to `ProviderConfig` is required, the agent must stop and report it rather than silently mutating `interfaces/config.ts`.
   - If a requested channel has no adapter or configuration in `config.providers`, throws `MissingAdapterError` (`code: 'E_MISSING_ADAPTER'`) with actionable hint detailing required configuration.
5. **Main `notify()` Function (`packages/core/src/orchestrator/notify.ts`):**
   - Implements the complete enqueue workflow:
     1. Generates `traceId` (UUID v7) correlating all operations and log entries.
     2. Validates incoming event via `validateEvent()`.
     3. Resolves channels against configured adapters via `resolveAdapters()`.
     4. Pre-renders template with `event.data` using `TemplateStore.render()` (fail-fast per ADR-004).
     5. Constructs `NotificationJob` payload with sortable UUID v7 `jobId` for each resolved channel.
     6. Enqueues job(s) via `enqueueJob()` to BullMQ.
     7. Emits structured Pino logs bound to `traceId`, `jobId`, `channel`, and `provider`.
     8. Returns immediately upon durable queueing in Redis with `{ jobId: string }` conforming strictly to the authoritative public contract (for multi-channel events, returns the primary/first enqueued channel's `jobId`; internal job metadata and Pino logs retain `traceId` and individual channel job IDs, but these are not exposed in the public return value).
   - **Atomicity Boundary:** Guarantees atomic pre-enqueue validation (schema, recipient contact details, adapter presence, template existence, and variable interpolation are all validated before *any* Redis operation). Clearly recognizes that Redis enqueues across independent BullMQ queues (`notifykit:email`, `notifykit:sms`, `notifykit:push`) are executed sequentially without distributed two-phase commit or cross-queue transactional rollback.
6. **Public `createNotifier()` Factory (`packages/core/src/index.ts` & `src/orchestrator/notifier.ts`):**
   - Factory function `createNotifier(options?: CreateNotifierOptions)`.
   - Merges explicit options with `loadConfig()` and validates via `validateConfig()`.
   - Initializes internal `TemplateStore` and `Logger`. Delegates queue dispatch to `enqueueJob()`.
   - Returns public `Notifier` instance:
     - `notify(event: NotificationEvent): Promise<NotifyResult>` (authoritatively returns `{ jobId: string }`).
     - `registerTemplate(id: string, source: string): void`.
     - `startWorker(opts?: { channels?: Array<'email' | 'sms' | 'push'>; concurrency?: number }): void` — explicit stub matching the spec signature that throws `NotifyKitError` (`code: 'E_NOT_IMPLEMENTED'`) indicating worker functionality arrives in Phase 5.
   - **Connection Lifecycle & `Notifier.close()` (Option A Adopted):** `Notifier.close()` is unapproved and excluded from the public `Notifier` interface (zero public API expansion). Clean shutdown for default singletons is achieved via existing Phase 3 lifecycle functions (`resetDefaultRegistry()` / `closeRedisConnection()`). Callers supplying a custom registry via `options.registry` explicitly retain lifecycle ownership and are responsible for closing that registry and its underlying Redis client. Multiple notifier instances with differing Redis URLs share the initial default singleton connection (documented limitation). See Section 10.4 for detailed lifecycle analysis.
7. **Orchestrator Errors (`packages/core/src/orchestrator/errors.ts`):**
   - `InvalidEventError` extending `NotifyKitError` (`code: 'E_INVALID_EVENT'`).
   - `MissingAdapterError` extending `NotifyKitError` (`code: 'E_MISSING_ADAPTER'`).
   - Re-exported from core index alongside Phase 1–3 errors.

### 3.2 Explicit Exclusions (Not in Scope for Phase 4)
- ❌ **BullMQ Worker Processing:** Phase 5 scope. No worker loop, job consumption, or retry processor in Phase 4.
- ❌ **Concrete Provider Adapters:** Phase 6 (Nodemailer), Phase 7 (Twilio), Phase 8 (FCM), Phase 9 (MSG91). Phase 4 tests use mock adapters conforming to `EmailProvider` / `SmsProvider` / `PushProvider`.
- ❌ **HTTP API Server:** Phase 15 (v1.1) scope. No Express middleware or HTTP endpoints.
- ❌ **Prometheus Metrics:** Phase 15 (v1.1) scope.
- ❌ **Idempotency Cache:** Phase 15 (v1.1) scope per master spec line 1462.
- ❌ **Persistent Database:** No MongoDB, PostgreSQL, or ORM in v1 core (ADR-009).

---

## 4. Requirements Traceability Matrix

| Requirement ID | Specification Source | Description | Planned Phase 4 Component / Test |
| :--- | :--- | :--- | :--- |
| **CORE-01** | PRD v1.0 §13 line 355 | `notify()` validates input against typed schema; throws clear error on invalid input | `orchestrator/event-schema.ts`, `orchestrator/validate.ts`, `InvalidEventError` |
| **CORE-02** | PRD v1.0 §13 line 356 | Jobs enqueued to BullMQ; `notify()` returns immediately with job ID | `orchestrator/notify.ts`, `enqueueJob()` |
| **CORE-08** | PRD v1.0 §13 line 362 | Structured logs via Pino with correlation key | `logging/logger.ts`, `traceId` propagation |
| **ADR-003** | Architecture §20 line 2111 | Adapters injected via `createNotifier()`, never imported into core | `orchestrator/notifier.ts`, `createNotifier()` config options |
| **ADR-004** | Architecture §20 line 2117 | Render templates at enqueue time; fail-fast before pushing to queue | `orchestrator/notify.ts` calling `TemplateStore.render()` |
| **ADR-005** | Architecture §20 line 2123 | Explicit `startWorker()`, never auto-started on import | `startWorker` stub in `createNotifier()` |
| **ADR-008** | Architecture §20 line 2141 | Pino logging everywhere with redaction; `console.log` forbidden | `logging/logger.ts` using `pino` and `REDACT_PATHS` |
| **ADR-010** | Architecture §20 line 2184 | API-First versioning, stable error envelope (`code`, `message`, `hint`, `traceId`) | `NotifyKitError` derivative classes |
| **DoD-4.1** | `PHASES.md` §10 line 2780 | `notify()` puts exactly one job in `notifykit:email` queue | `tests/orchestrator/notify.test.ts` |
| **DoD-4.2** | `PHASES.md` §10 line 2781 | Invalid recipient (`{}`) throws `InvalidEventError` | `tests/orchestrator/validate.test.ts` |
| **DoD-4.3** | `PHASES.md` §10 line 2782 | Requested channel with no adapter throws `MissingAdapterError` | `tests/orchestrator/resolve.test.ts` |
| **DoD-4.4** | `PHASES.md` §10 line 2783 | Every log line for a single `notify()` call shares one `traceId` | `tests/orchestrator/logging.test.ts` |
| **DoD-4.5** | `PHASES.md` §10 line 2784 | `notify()` returns in < 10 ms (p99) | `tests/orchestrator/orchestrator-perf.test.ts` |
| **DoD-4.6** | `PHASES.md` §10 line 2785 | Code coverage ≥ 85% (and ≥ 90% per vitest thresholds) | Vitest coverage report |
| **Gate 4 → 5** | `PHASES.md` §23 line 3343 | `notify()` produces correct jobs; all validation edge cases tested | Unit + Real-Redis integration suite |

---

## 5. Detailed Task Breakdown

### Task T-4.1: Runtime Dependency Installation — `pino`
- **File:** `packages/core/package.json`
- **Action:** Add `"pino": "^9.0.0"` to `dependencies`.
- **Rationale:** Approved by master specification Section 4 (`AGENTS.md` §6.1, line 3695). Pino v9 includes bundled TypeScript definitions.
- **Verification:** `npm install`, bundle size verification (< 60 KB limit).

### Task T-4.2: Structured Logger with Redaction (`src/logging/logger.ts`)
- **File:** `packages/core/src/logging/logger.ts`, `packages/core/src/logging/index.ts`
- **Responsibilities:**
  - Create central Pino instance configured with fast-redact path wildcards corresponding to `REDACT_PATHS` (`*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`) from `src/config/redact.ts`.
  - Format fast-redact paths to capture both top-level and deeply nested properties (e.g. `*.password`, `*.*.password`, `*.secret`, `*.*.secret`, `*.token`, `*.*.token`, `*.authToken`, `*.authKey`, `*.apiKey`, `*.accountSid`).
  - Set `censor: '[REDACTED]'`.
  - Provide helper `createScopedLogger(bindings: { traceId?: string; jobId?: string; channel?: string; provider?: string })`.
  - Allow test injection of custom stream / destination for log assertion testing.
- **Dependencies:** `pino`, `src/config/redact.ts`.
- **Testing:** `tests/logging/logger.test.ts` verifying top-level credential redaction, nested credential redaction (e.g. `data.user.password`, `headers.authorization`), log levels, and child binding propagation with zero secret leakage.

### Task T-4.3: Zero-Dependency RFC 9562 UUID v7 Generator (`src/orchestrator/uuid.ts`)
- **File:** `packages/core/src/orchestrator/uuid.ts`
- **Responsibilities:**
  - Implement RFC 9562 §5.7 UUID v7 generator:
    - 48 bits: Unix timestamp in ms (`Date.now()`).
    - 4 bits: version 7 (`0b0111`).
    - 12 bits: pseudo-random sequence (`rand_a`).
    - 2 bits: variant (`0b10`).
    - 62 bits: pseudo-random sequence (`rand_b`).
  - Return canonical 36-character hyphenated UUID string (e.g. `018f9e60-466d-71b3-a00e-6f8d098ef7ab`).
  - Guarantee millisecond-level chronological time ordering. Clarify that within the same millisecond tick, pseudo-random bits do not guarantee strict monotonicity.
  - Provide `isUuidV7(value: string): boolean` helper for validation.
- **Dependencies:** `node:crypto`.
- **Testing:** `tests/orchestrator/uuid.test.ts` verifying RFC 9562 compliance (version 7, variant 2), regex formatting, and chronological sorting across millisecond boundaries.

### Task T-4.4: Orchestrator Errors (`src/orchestrator/errors.ts`)
- **File:** `packages/core/src/orchestrator/errors.ts`
- **Responsibilities:**
  - `InvalidEventError`:
    - Extends `NotifyKitError`.
    - `code: 'E_INVALID_EVENT'`.
    - Message detailing specific validation failure.
    - Actionable `hint` guiding correction.
    - `traceId` correlation.
  - `MissingAdapterError`:
    - Extends `NotifyKitError`.
    - `code: 'E_MISSING_ADAPTER'`.
    - Message: `No provider adapter configured for channel "${channel}".`
    - Actionable `hint`: `Configure a provider for "${channel}" in createNotifier({ providers: { ${channel}: ... } }) or remove the channel from your notification event.`
    - `traceId` correlation.
- **Dependencies:** `src/errors/notifykit-error.ts`.
- **Testing:** Unit tests verifying error names, codes, hints, and stack retention.

### Task T-4.5: Event Validation & Recipient Rules (`src/orchestrator/event-schema.ts` & `src/orchestrator/validate.ts`)
- **File:** `packages/core/src/orchestrator/event-schema.ts`, `packages/core/src/orchestrator/validate.ts`
- **Responsibilities:**
  - Define `notificationEventSchema` using `zod`:
    - `to`: Object matching `recipientSchema`.
    - `channels`: Array of `'email' | 'sms' | 'push'`, non-empty (`min(1)`), unique values.
    - `template`: Non-empty string.
    - `data`: Record of key-value variables (`Record<string, unknown>`).
  - Implement `validateEvent(rawEvent: unknown, traceId?: string): NotificationEvent`:
    - Validates schema structure.
    - Enforces channel-specific recipient rules:
      - If `channels.includes('email')`: `to.email` must be defined and valid email format.
      - If `channels.includes('sms')`: `to.phone` must be defined and valid E.164 phone string.
      - If `channels.includes('push')`: `to.pushToken` must be defined and non-empty string.
    - If `to` is `{}` or missing channel contact info, throws `InvalidEventError`.
- **Dependencies:** `zod`, `src/interfaces/event.ts`, `src/queue/payload.ts` (`recipientSchema`), `src/orchestrator/errors.ts`.
- **Testing:** `tests/orchestrator/validate.test.ts` covering 15+ edge cases (missing recipient fields, invalid channel values, empty data, extra fields).

### Task T-4.6: Channel → Adapter Resolution (`src/orchestrator/resolve.ts`)
- **File:** `packages/core/src/orchestrator/resolve.ts`
- **Responsibilities:**
  - Function `resolveChannelAdapters(channels: Array<'email' | 'sms' | 'push'>, providers: NotifierConfig['providers'], traceId?: string): Map<'email' | 'sms' | 'push', { providerName: string; adapter?: unknown }>`:
    - Follows ADR-003 while respecting existing `ProviderConfig` types (does not assume an explicit `adapter` property on `ProviderConfig`).
    - For each requested channel, verifies `providers[channel]` is configured.
    - Extracts provider identifier: uses `(providerConfig as Record<string, unknown>).adapter?.name ?? providerConfig.type`.
    - If a static change to `ProviderConfig` is deemed necessary, halts and reports for human approval rather than silently changing public interfaces.
    - If a requested channel has no provider configured, throws `MissingAdapterError` (`E_MISSING_ADAPTER`).
    - Returns mapping of channel to resolved provider name and optional adapter instance.
- **Dependencies:** `src/interfaces/config.ts`, `src/interfaces/providers.ts`, `src/orchestrator/errors.ts`.
- **Testing:** Unit tests for injected adapter instances via open index signature, configuration metadata, mixed multi-channel configurations, and unconfigured channel errors.

### Task T-4.7: Main `notify()` Orchestrator (`src/orchestrator/notify.ts`)
- **File:** `packages/core/src/orchestrator/notify.ts`
- **Responsibilities:**
  - Export `interface NotifyContext`:
    - `config: NotifierConfig`
    - `registry: QueueRegistry`
    - `templateStore: TemplateStore`
    - `logger: Logger`
  - Function `notify(event: NotificationEvent, ctx: NotifyContext): Promise<NotifyResult>`:
    1. Generate `traceId = generateUuidV7()`.
    2. Create scoped logger with `traceId`.
    3. Call `validateEvent(event, traceId)`.
    4. Call `resolveChannelAdapters(event.channels, ctx.config.providers, traceId)`.
    5. Call `ctx.templateStore.render(event.template, event.data)` (throws `MissingTemplateError` or `MissingVariableError` if invalid).
    6. For each resolved channel:
       - Generate `jobId = generateUuidV7()`.
       - Assemble `NotificationJob`:
         - `id: jobId`
         - `channel: channel`
         - `provider: resolvedAdapter.providerName`
         - `to: event.to`
         - `templateId: event.template`
         - `renderedBody: renderedBody`
         - `metadata: { enqueuedAt: Date.now(), traceId }`
       - Call `enqueueJob(job, { registry: ctx.registry })`.
       - Emit Pino `info` log with `{ traceId, jobId, channel, provider: resolvedAdapter.providerName, msg: 'Notification job enqueued' }`.
    7. Return `{ jobId: primaryJobId }` strictly preserving the authoritative `{ jobId: string }` contract. (Channel-specific job IDs and `traceId` are logged via Pino and embedded in `NotificationJob.metadata`, but not exposed as public return fields).
  - Document that pre-enqueue validation is atomic, but per-channel Redis enqueues execute sequentially without cross-queue distributed rollback.
- **Dependencies:** `src/orchestrator/validate.ts`, `src/orchestrator/resolve.ts`, `src/templates/store.ts`, `src/queue/enqueue.ts`, `src/logging/logger.ts`, `src/orchestrator/uuid.ts`.
- **Testing:** `tests/orchestrator/notify.test.ts` verifying job construction, template rendering at enqueue time, error propagation, and multi-channel handling returning `{ jobId }`.

### Task T-4.8: Public Notifier Factory (`src/orchestrator/notifier.ts` & `src/index.ts`)
- **File:** `packages/core/src/orchestrator/notifier.ts`, `packages/core/src/index.ts`
- **Responsibilities:**
  - Define `Notifier` interface matching authoritative spec contract (`PHASES.md` §10 line 2770):
    ```typescript
    export interface Notifier {
      notify(event: NotificationEvent): Promise<NotifyResult>;
      registerTemplate(id: string, source: string): void;
      startWorker(opts?: { channels?: Array<'email' | 'sms' | 'push'>; concurrency?: number }): void;
    }
    ```
    *(Note: `Notifier.close()` is unapproved and omitted per Option A with zero public API expansion. Clean shutdown for default singletons is achieved via existing Phase 3 `resetDefaultRegistry()` and `closeRedisConnection()`. Callers supplying a custom registry explicitly own its lifecycle.)*
  - Implement `createNotifier(options?: CreateNotifierOptions): Notifier`:
    - Merges options with `loadConfig()` and validates with `validateConfig()`.
    - Passes optional `options.registry` and `options.redis` into internal `NotifyContext`.
    - Initializes `TemplateStore`. If `options.templates` provided, registers them; if `options.templateDir` provided, calls `loadFromDirectory()`.
    - Binds `notify()` function with internal context, delegating queue resolution to `enqueueJob()`.
    - Binds `registerTemplate(id, source)` to `templateStore.register(id, source)`.
    - Implements `startWorker(opts)` stub matching spec signature that throws `NotifyKitError` (`code: 'E_NOT_IMPLEMENTED'`, hint: `'Worker functionality is introduced in Phase 5'`).
  - Re-export from `packages/core/src/index.ts`:
    - `createNotifier`, `type Notifier`, `type CreateNotifierOptions`, `type NotifyResult`
    - `InvalidEventError`, `MissingAdapterError`
    - `getLogger`, `createScopedLogger`
- **Dependencies:** `src/config`, `src/templates`, `src/queue`, `src/logging`, `src/orchestrator`.
- **Testing:** `tests/orchestrator/create-notifier.test.ts` verifying initialization, template registration, worker stub exception, default singleton clean shutdown via `resetDefaultRegistry()` and `closeRedisConnection()`, and custom registry caller ownership (distinguishing default singleton lifecycle from custom-registry ownership; mock-object tests do not claim real socket teardown).

### Task T-4.9: Performance Benchmark Test (`tests/orchestrator/orchestrator-perf.test.ts`)
- **File:** `packages/core/tests/orchestrator/orchestrator-perf.test.ts`
- **Responsibilities:**
  - Execute 500 sequential `notify()` calls against real Redis / Testcontainers.
  - Measure per-call enqueue duration via `performance.now()`.
  - Calculate p99 latency.
  - Assert that p99 latency is `< 10.0 ms` per Definition of Done line 2784.
  - Assert CI failure guard `assertRedisAvailable()` prevents silent skipping.
- **Testing:** Isolated benchmark suite.

### Task T-4.10: Real-Redis Integration Tests (`tests/orchestrator/orchestrator-integration.test.ts`)
- **File:** `packages/core/tests/orchestrator/orchestrator-integration.test.ts`
- **Responsibilities:**
  - End-to-end integration test from `createNotifier()` -> `registerTemplate()` -> `notify()` -> real BullMQ queue in Redis.
  - Inspect Redis keys: confirm job exists in `bull:notifykit:<channel>:wait`, inspect payload hash, verify `renderedBody` is pre-rendered and `traceId` is present in metadata.
  - Enforce `assertRedisAvailable(ctx)` so that in CI, missing Redis causes explicit failure.
- **Testing:** Full path integration against Testcontainers Redis.

---

## 6. API and Behavior Design

### 6.1 Public `createNotifier` Factory Signature
```typescript
export interface CreateNotifierOptions {
  redis?: string;
  providers?: {
    email?: ProviderConfig;
    sms?: ProviderConfig;
    push?: ProviderConfig;
  };
  templates?: Record<string, string>;
  templateDir?: string;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

/**
 * Public Return Type for notify():
 * Authoritative contract per PRD §13 (CORE-02) and Architecture §6.1 is `{ jobId: string }`.
 * `jobIds` and `traceId` are omitted from the public return type to avoid unapproved API expansion.
 */
export interface NotifyResult {
  /** Primary job ID returned upon durable queueing in Redis */
  jobId: string;
}

export interface Notifier {
  /**
   * Enqueues a notification event across all requested delivery channels.
   * Renders the registered template fail-fast and pushes durably to Redis queues.
   * Returns `{ jobId: string }`.
   */
  notify(event: NotificationEvent): Promise<NotifyResult>;

  /**
   * Registers a Handlebars template in the in-memory template store.
   */
  registerTemplate(id: string, source: string): void;

  /**
   * Worker lifecycle stub — explicitly deferred to Phase 5.
   * Throws E_NOT_IMPLEMENTED in Phase 4.
   */
  startWorker(opts?: { channels?: Array<'email' | 'sms' | 'push'>; concurrency?: number }): void;
}

export function createNotifier(options?: CreateNotifierOptions): Notifier;
```

### 6.2 Behavior Rules for Multi-Channel Events & Atomicity Boundaries
When an event requests multiple channels (e.g. `channels: ['email', 'sms']`):
1. **Pre-Enqueue Atomic Validation:** All channels, recipient contact fields (`to.email`, `to.phone`), adapter existence, and template rendering (`TemplateStore.render()`) are validated *before any job is pushed to Redis*. If channel `'sms'` is missing an adapter or phone number, `notify()` throws immediately (`InvalidEventError` or `MissingAdapterError`) without enqueueing any partial email job.
2. **Redis Enqueue Execution (Non-Transactional Across Queues):** Once validation passes, jobs are enqueued to their respective BullMQ channel queues (`notifykit:email`, `notifykit:sms`, `notifykit:push`). Because BullMQ queues are independent data structures with separate Redis keys, *no cross-queue transactional rollback or two-phase commit exists*. If Redis fails, crashes, or runs out of memory between channel enqueues, earlier enqueued jobs remain in Redis and the operation rejects with `RedisUnavailableError` or `QueueFullError`. NotifyKit does not claim multi-queue distributed transactional atomicity.
3. **Correlation Tracking:** All jobs created from a single `notify()` invocation share the identical `traceId` in their metadata. Each job has its own unique, time-sortable RFC 9562 UUID v7 `jobId`.
4. **Return Value:** Returns `{ jobId: primaryJobId }` strictly conforming to CORE-02 and Architecture §6.1. Channel-specific job IDs and `traceId` are recorded in Pino logs and embedded in `NotificationJob.metadata`, but are not exposed as public `NotifyResult` fields unless explicitly approved.

---

## 7. Validation and Error Handling Contract

All orchestrator errors strictly inherit from `NotifyKitError` and maintain the standard dual-surface error envelope:

```typescript
{
  "code": "E_INVALID_EVENT" | "E_MISSING_ADAPTER" | "E_MISSING_TEMPLATE" | "E_MISSING_VARIABLE" | "E_REDIS_UNAVAILABLE" | "E_QUEUE_FULL" | "E_INTERNAL",
  "message": string,
  "hint": string,
  "traceId": string
}
```

### Specific Error Conditions & Mappings:
1. **Empty recipient `{}` or missing contact info:**
   - Error: `InvalidEventError`
   - Code: `'E_INVALID_EVENT'`
   - Example Message: `Field "to.phone" is required when channel "sms" is selected.`
   - Example Hint: `Pass { to: { phone: "+919876543210" } } or remove "sms" from channels.`
2. **Channel requested without adapter configured:**
   - Error: `MissingAdapterError`
   - Code: `'E_MISSING_ADAPTER'`
   - Example Message: `No provider adapter configured for channel "sms".`
   - Example Hint: `Configure a provider for "sms" in createNotifier({ providers: { sms: ... } }) or remove "sms" from event channels.`
3. **Template not registered:**
   - Error: `MissingTemplateError` (from Phase 2)
   - Code: `'E_MISSING_TEMPLATE'`
   - Example Hint: `Register template "order-confirmed" with notifier.registerTemplate() before calling notify().`
4. **Missing template variable in output interpolation:**
   - Error: `MissingVariableError` (from Phase 2)
   - Code: `'E_MISSING_VARIABLE'`
   - Example Hint: `Provide value for "user.name" in event.data payload.`
5. **Redis connection offline or cluster failure:**
   - Error: `RedisUnavailableError` (from Phase 3)
   - Code: `'E_REDIS_UNAVAILABLE'`
6. **Redis OOM / maxmemory reached:**
   - Error: `QueueFullError` (from Phase 3)
   - Code: `'E_QUEUE_FULL'`

---

## 8. Testing Strategy

### 8.1 Unit Tests (`packages/core/tests/orchestrator/*.test.ts`)
1. **Event Schema & Validation (`tests/orchestrator/validate.test.ts`):**
   - Valid event with email recipient passes.
   - Valid event with phone recipient passes.
   - Valid event with pushToken recipient passes.
   - Valid multi-channel event passes.
   - Rejects empty recipient `{}` with `InvalidEventError`.
   - Rejects missing `to.email` when `'email'` in channels.
   - Rejects missing `to.phone` when `'sms'` in channels.
   - Rejects missing `to.pushToken` when `'push'` in channels.
   - Rejects malformed email string (e.g. `not-an-email`).
   - Rejects malformed phone string (non-E.164).
   - Rejects empty `channels` array (`[]`).
   - Rejects unknown channel names (e.g. `'carrier-pigeon'`).
   - Rejects empty template string (`""`).
   - Rejects non-object `data`.
2. **Adapter Resolution (`tests/orchestrator/resolve.test.ts`):**
   - Resolves injected provider adapter instance (e.g. `adapter: new TwilioSmsProvider()`) matching ADR-003.
   - Resolves provider configuration metadata (e.g. `{ type: 'nodemailer' }`).
   - Prioritizes `adapter.name` when an injected adapter is supplied.
   - Resolves multi-channel adapters with mixed configuration formats.
   - Throws `MissingAdapterError` (`E_MISSING_ADAPTER`) when channel has no provider in config.
   - Throws `MissingAdapterError` when `config.providers` is empty.
3. **UUID v7 Compliance (`tests/orchestrator/uuid.test.ts`):**
   - Validates RFC 9562 §5.7 bit structure (version bits = 7, variant bits = 2).
   - Validates canonical 36-character hyphenated UUID regex.
   - Validates chronological sort order across advancing millisecond timestamps.
   - Does not assume or test sub-millisecond monotonic ordering for randomly seeded sequence bits.
4. **Main `notify()` Function (`tests/orchestrator/notify.test.ts`):**
   - Successful enqueue builds correct `NotificationJob` payload.
   - Pre-rendered body matches template + data output (ADR-004 verification).
   - Enqueues job to mock queue with sortable UUID v7 `jobId`.
   - Propagates identical `traceId` across multiple channel jobs.
   - Pre-enqueue validation failure leaves 0 jobs enqueued to Redis.
   - Fails fast on `MissingTemplateError` before queueing any job.
   - Fails fast on `MissingVariableError` before queueing any job.
   - Multi-queue enqueue failure simulation: tests that second channel Redis failure throws `RedisUnavailableError` / `QueueFullError`.
   - Returns strictly `{ jobId }` matching the authoritative contract.
5. **Logging & Redaction (`tests/orchestrator/logging.test.ts`):**
   - Captures Pino log lines from `notify()`.
   - Confirms all log lines for a `notify()` call contain identical `traceId`.
   - Confirms top-level credentials (e.g. `token`, `password`, `secret`, `apiKey`) are redacted to `[REDACTED]`.
   - Confirms deeply nested credentials (e.g. `data.user.password`, `to.authToken`, `config.providers.email.password`) are redacted to `[REDACTED]`.
   - Confirms zero plaintext credential leakage in raw log output streams.
   - Confirms no `console.log` calls exist across orchestrator modules.
6. **Factory Contract (`tests/orchestrator/create-notifier.test.ts`):**
   - `createNotifier()` initializes in < 50 ms.
   - Validates configuration at creation time (fails fast on invalid config).
   - `registerTemplate()` adds templates usable by `notify()`.
   - `startWorker()` stub throws `NotifyKitError` with code `E_NOT_IMPLEMENTED`.
   - Clean shutdown for default singletons is verified using Phase 3 `closeRedisConnection()` and `resetDefaultRegistry()`, leaving zero open handles without adding an unapproved `close()` method to `Notifier`.
   - Distinguishes default singleton lifecycle from custom-registry lifecycle ownership: callers supplying `options.registry` own closing their registry and underlying Redis client. Mock-object tests in unit suites verify delegation without claiming mock teardown proves real network resource cleanup.

### 8.2 Real-Redis Integration Tests (`tests/orchestrator/orchestrator-integration.test.ts`)
- Runs against real Redis (via Testcontainers `redis:7-alpine`).
- Enforces `assertRedisAvailable(ctx)` to fail explicitly in CI if Redis cannot start.
- Verifies full flow: `createNotifier()` -> `registerTemplate()` -> `notify()` -> job in Redis key `bull:notifykit:email:wait`.
- Inspects job hash in Redis: validates pre-rendered body, UUID v7 format, trace ID, and recipient details.

### 8.3 Performance Benchmark (`tests/orchestrator/orchestrator-perf.test.ts`)
- Enqueues 500 sequential notification events.
- Measures duration of each `notify()` call.
- Calculates 99th percentile (p99).
- Asserts `p99 < 10.0 ms` per Definition of Done line 2784.

---

## 9. Definition of Done & Quality Gates

### 9.1 Phase 4 Acceptance Criteria (DoD)
- [ ] `notify({ to: { email }, channels: ['email'], template: 'welcome', data: {} })` puts exactly one job in `notifykit:email` queue.
- [ ] Invalid recipient (`{}`) throws `InvalidEventError` with code `E_INVALID_EVENT`.
- [ ] Requested channel with no adapter throws `MissingAdapterError` with code `E_MISSING_ADAPTER`.
- [ ] Every log line for a single `notify()` call shares one `traceId`.
- [ ] `notify()` returns in < 10 ms (p99).
- [ ] `createNotifier()` factory initializes and returns `{ notify, registerTemplate, startWorker }` (Option A adopted: default singleton shutdown managed via `resetDefaultRegistry()` and `closeRedisConnection()`; custom registries owned and closed by the caller; no `Notifier.close()` added).
- [ ] `startWorker()` stub throws clear error indicating workers are Phase 5.
- [ ] Unit tests cover 15+ edge cases across validation and orchestration.
- [ ] Integration test verifies full path from `notify()` to Redis job using Testcontainers.
- [ ] Core package test coverage ≥ 90% across statements, branches, functions, and lines.
- [ ] Core bundle size remains ≤ 60 KB (currently 4.2 kB).

### 9.2 Release Gate 4 → 5
- `notify()` produces correct jobs; all validation edge cases tested.
- Real-Redis integration suite passes in CI across Node.js 20.x, 22.x, and 24.x.
- Zero lint errors (`npm run lint`), format clean (`npm run format:check`), typecheck clean (`npm run typecheck`).

---

## 10. Risks, Open Questions & Mitigations

### 10.1 Multi-Channel `notify()` Return Value & Strict Contract Preservation
- **Specification Context:**
  - PRD §13 line 356 (`CORE-02`): `Jobs must be enqueued to BullMQ; notify() returns immediately with a job ID.`
  - Architecture §6.1 line 940 (Sequence Diagram): `User Code ◄──────────────┤ { jobId }`
  - `PHASES.md` §10 line 2780: `notify({ to: { email }, channels: ['email'], template: 'welcome', data: {} })` puts exactly one job in `notifykit:email` queue.
- **Contract Decision & Constraint Enforcement:**
  - The public return type strictly preserves `{ jobId: string }`:
    ```typescript
    export interface NotifyResult {
      jobId: string;
    }
    ```
  - For single-channel events, `jobId` is the BullMQ job ID of the enqueued job.
  - For multi-channel events (e.g. `channels: ['email', 'sms']`), independent jobs are queued to their respective BullMQ queues, each assigned an RFC 9562 UUID v7 identifier and the shared `traceId`. `notify()` returns `{ jobId: primaryJobId }` (the job ID of the first channel enqueued).
  - Proposed expansions such as `jobIds?: Record<...>` or `traceId?: string` on `NotifyResult` are **not approved** and are excluded from the public API contract. Internal logging and job metadata retain full multi-channel job mapping and `traceId` correlation without public API expansion.

### 10.2 Pino Fast-Redact & Nested Secret Protection
- **Context:** Architecture §12.1 mandates credential redaction of `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`.
- **Implementation Strategy:** Pino's `fast-redact` compiles path expressions into specialized JS functions. Wildcard patterns (`'*.password'`, `'*.*.password'`, `'*.secret'`, `'*.*.secret'`, `'*.token'`, `'*.*.token'`, `'*.authToken'`, `'*.authKey'`) will be configured to protect both root-level objects and nested payloads (e.g. `data.user.password`).
- **Test Requirement:** Unit tests will assert zero plaintext leakage across root, nested, and configuration object log calls.

### 10.3 Injected Adapters vs Metadata Configuration & API Compatibility (ADR-003)
- **Context:** Architecture §9.3 and ADR-003 mandate that adapters are injected at runtime (`adapter: new TwilioSmsProvider()`). Meanwhile, existing `ProviderConfig` in `packages/core/src/interfaces/config.ts` declares:
  ```typescript
  export interface ProviderConfig {
    type: string;
    [key: string]: unknown;
  }
  ```
- **Constraint Enforcement:** The implementation must NOT assume `ProviderConfig` explicitly declares a typed `adapter` property. It must operate within the existing index signature (`[key: string]: unknown`), extracting provider identifiers via `(providerConfig as Record<string, unknown>).adapter?.name ?? providerConfig.type`.
- **Gate Requirement:** If an explicit static type modification to `ProviderConfig` is deemed necessary, the agent must STOP and report it for human review rather than silently altering a Phase 1 public interface.

### 10.4 Connection Lifecycle Analysis & Adoption of Option A (Explicit Caller Ownership)
- **Context & Unapproved Status of `Notifier.close()`:**
  - The master specification (`PHASES.md` §10 line 2770) explicitly defines the `createNotifier()` factory contract:
    `- [ ] index.ts — createNotifier() factory returning { notify, registerTemplate, startWorker (stub) }`
  - Neither PRD §10.1 nor `PHASES.md` §10 authorizes a public `close()` method on the `Notifier` interface. Therefore, `Notifier.close()` is treated as **unapproved** and is NOT added to the public API contract.
- **Connection Lifecycle Investigation & Findings:**
  - An inspection of `packages/core/src/orchestrator/notifier.ts`, `src/queue/enqueue.ts`, and `src/queue/connection.ts` reveals:
    1. `createNotifier()` does not eagerly create connections or queues; it stores `options.registry` and `options.redis` in the closure and delegates queue resolution to `enqueueJob()`.
    2. `resetDefaultRegistry(): Promise<void>` in `src/queue/enqueue.ts` closes the module-level `defaultRegistry` singleton and its 4 BullMQ Queue instances (`email`, `sms`, `push`, `dlq`).
    3. `closeRedisConnection(): Promise<void>` in `src/queue/connection.ts` closes the module-level `memoizedRedisInstance` ioredis client singleton.
- **Scope of Package-Level Teardown vs Custom Registries:**
  - `resetDefaultRegistry()` and `closeRedisConnection()` manage **module-level default singletons only**.
  - When callers supply a custom registry via `createNotifier({ registry: customRegistry })`, `enqueueJob()` uses `customRegistry` directly, completely bypassing `getOrCreateDefaultRegistry()` and `createRedisConnection()`.
  - In this case, `resetDefaultRegistry()` and `closeRedisConnection()` do **not** touch or close `customRegistry` or its underlying Redis client.
- **Decision: Adoption of Option A (Explicit Caller Ownership, Zero Public API Expansion):**
  - **Standard Default Usage:** For consumers using the default singleton configuration, clean shutdown is fully achieved via existing Phase 3 lifecycle functions:
    ```typescript
    import { createNotifier, closeRedisConnection, resetDefaultRegistry } from 'notifykit';

    const notifier = createNotifier();
    await notifier.notify({ ... });

    // Clean shutdown for default singleton configuration:
    await resetDefaultRegistry();
    await closeRedisConnection();
    ```
  - **Custom Registry Injections:** Callers supplying an injected `QueueRegistry` explicitly retain lifecycle ownership of that resource. The caller is responsible for invoking `await customRegistry.close()` and closing the associated ioredis connection upon application shutdown:
    ```typescript
    import { createNotifier, QueueRegistry } from 'notifykit';
    import Redis from 'ioredis';

    const customRedis = new Redis('redis://custom-host:6379');
    const customRegistry = new QueueRegistry(customRedis);
    const notifier = createNotifier({ registry: customRegistry });
    await notifier.notify({ ... });

    // Caller explicitly manages injected resource lifecycle:
    await customRegistry.close();
    await customRedis.quit();
    ```
  - **No Public API Expansion:** Keeps the `Notifier` interface strictly frozen to `{ notify, registerTemplate, startWorker }` with zero unauthorized additions.
- **Documented Multi-Instance Limitation (Different Redis URLs):**
  - Multiple notifier instances configured with different Redis URLs (e.g. `notifier1 = createNotifier({ redis: 'redis://host-1:6379' })` and `notifier2 = createNotifier({ redis: 'redis://host-2:6379' })`) share the initial default singleton connection. Because `getOrCreateDefaultRegistry()` and `createRedisConnection()` are memoized module singletons, `notifier2` will reuse the connection established by `notifier1` rather than creating an isolated connection.
  - This behavior is a documented limitation of the module-singleton architecture in Phase 3/4. It is **not** claimed to be supported or fixed in Phase 4.
- **Testing & Verification Distinction:**
  - Mock-object tests in unit suites (e.g. `tests/orchestrator/create-notifier.test.ts`) assert that `createNotifier()` accepts custom registries and forwards jobs correctly, but do **not** claim that mock teardown tests prove real network resource cleanup.
  - Real resource cleanup leaving zero open network handles is verified exclusively in `tests/orchestrator/orchestrator-integration.test.ts` for the default singleton path against real Redis.

### 10.5 Multi-Queue Enqueue Atomicity vs Independent Queue Architecture
- **Context:** When multiple channels are targeted, separate BullMQ `add()` calls are made to distinct queues.
- **Boundary:** Pre-enqueue validation is completely atomic in memory (schema, channels, recipients, adapters, and template rendering). However, once Redis commands begin, there is no cross-queue Redis rollback transaction across separate BullMQ queues. If channel 1 succeeds and channel 2 encounters a Redis disconnection, channel 1's job remains in its queue. This behavior is documented as a consequence of independent channel queues (Architecture §8.1).

### 10.6 Pino v9 Node.js Compatibility
- **Verification:** Pino v9 requires Node.js >= 18.0.0. Pino v9 runs seamlessly on Node.js 20, 22, and 24 without native addon bindings. Pino will be verified in the CI matrix across Node.js 20.x, 22.x, and 24.x.

### 10.7 Bundle Size Impact
- **Mitigation:** In `packages/core/tsup.config.ts`, `pino` is an external runtime dependency. Only internal NotifyKit glue code is bundled. Current bundle is 4.2 kB; the orchestrator module is projected to add < 2 kB (budget: 60 kB).

### 10.8 Avoidance of Unrelated Public API Expansion
- **Strict Scope Boundary:** Phase 4 strictly limits public API surface additions to `createNotifier()`, `Notifier` (with `notify`, `registerTemplate`, and `startWorker` stub), `NotifyResult` (`{ jobId: string }`), and error classes (`InvalidEventError`, `MissingAdapterError`). No unapproved lifecycle methods (`close()`), multi-channel result expansions (`jobIds`, `traceId`), rate-limiting APIs, plugin systems, idempotency headers, or worker lifecycle logic may be added to public exports.

---

## 11. Implementation Order & Authorization Notice

**Phase 4 implementation MUST proceed in this exact sequence once authorized:**
1. Install `pino` runtime dependency in `packages/core`.
2. Implement `logging/logger.ts` and `orchestrator/uuid.ts`.
3. Implement `orchestrator/errors.ts`, `orchestrator/event-schema.ts`, and `orchestrator/validate.ts` with comprehensive unit tests.
4. Implement `orchestrator/resolve.ts`.
5. Implement `orchestrator/notify.ts` and `orchestrator/notifier.ts`.
6. Export `createNotifier` and errors in `packages/core/src/index.ts`.
7. Implement Real-Redis integration test and p99 performance benchmark.
8. Run full verification suite (`format:check`, `lint`, `typecheck`, `test:coverage`, `build`, `size-limit`).

> **STOP:** This plan is complete. In accordance with the Phase-Gating Protocol and user instructions, **no implementation code has been written and no Git operations were performed.** Awaiting explicit human approval to proceed with Phase 4 implementation.
