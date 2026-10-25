# NotifyKit — Phase 1 (Provider Interfaces & Config) Implementation Plan

> **Document Type:** Master Implementation Plan (Final Revision — Planning Only)  
> **Status:** Final plan revision awaiting human review and implementation authorization.  
> **Canonical Plan File:** `Docs/PHASE-1-PLAN.md`  
> **Phase Target:** Phase 1 — Provider Interfaces & Config  
> **Target Workspace:** `packages/core` (within `notifykit` monorepo)  
> **Execution Constraint:** Planning Only — No implementation, package installation, build/test execution, or Git operations authorized.

---

## 1. Document Control & Specification Authority

### 1.1 Source of Truth
This plan is derived directly from [`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/NOTIFYKIT-MASTER-SPECIFICATION.md) and preserves all binding decisions established in [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md).

Authoritative sections governing Phase 1:
- **Phase 1 Definition & Tasks:** Section 3 (`PHASES.md` §7, lines 2599–2653).
- **Core Provider Interfaces & Signatures:** Section 1 (PRD §10.2, lines 315–349) & Section 2 (Architecture v1.1 §10.2, lines 1168–1182).
- **Module Architecture & Dependency Rules:** Section 2 (Architecture v1.1 §5.1–5.3, lines 842–910) & Section 4 (`AGENTS.md` §5.1–5.2, lines 3651–3671).
- **Configuration & Credential Rules:** Section 2 (Architecture v1.1 §11.2–11.3, lines 1530–1548).
- **Error Handling Mandatory Rules:** Section 4 (`AGENTS.md` §8.4, lines 3791–3795) & Section 2 (Architecture v1.1 §B.8.1/§B.8.3, lines 1400–1446).
- **Approved Dependency Policy:** Section 4 (`AGENTS.md` §6.1, lines 3687–3698).

### 1.2 Boundary & Scope Guardrails
- **In Scope for Phase 1:**
  1. Provider Interfaces in `packages/core/src/interfaces/`: `Recipient`, `NotificationEvent`, `EmailProvider`, `SmsProvider`, `PushProvider`, `ProviderResult`, `NotifierConfig`, `ProviderConfig`, and `AdapterMetadata`.
  2. Public export of all interfaces with comprehensive TSDoc comments from `packages/core/src/interfaces/index.ts` with zero runtime dependencies.
  3. Base error class `NotifyKitError` and `ConfigError` with stable code `E_CONFIG_INVALID` to satisfy mandatory error handling rules (`AGENTS.md` §8.4) and the Twilio validation DoD.
  4. Configuration module in `packages/core/src/config/`: Zod schemas for explicitly specified provider environment variables, `loadConfig()`, `validateConfig()`, and `REDACT_PATHS` constant.
  5. Unit tests for configuration validation covering valid, missing, and malformed inputs with ≥90% coverage on `src/config/`.
  6. Contract type tests (`expectTypeOf`) and a standalone external consumer test that builds `packages/core` and verifies `notifykit/interfaces` resolves cleanly through the package exports map for both TypeScript declarations and runtime module resolution.
- **Strictly Out of Scope:**
  - No provider adapter implementations (`packages/adapter-*`).
  - No runtime delivery orchestration (`orchestrator/`), Handlebars rendering (`templates/`), BullMQ producer/workers (`queue/`), or Pino logger wiring (`logging/`).
  - No CLI setup wizard implementation (`packages/cli/`).
  - No invented provider schemas or environment variables not specified in the master specification.
  - No modifications to `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md` or `Docs/PHASE-0-PLAN.md`.
  - No Git operations.

---

## 2. Ordered Tasks & Expected File Changes

| Task # | Step | Target File(s) | Description |
|:---:|:---|:---|:---|
| **T-1.1** | Dependency Addition | `packages/core/package.json` | Add `zod` (`^3.24.0`) to `dependencies` of `packages/core`. |
| **T-1.2** | Recipient Interface | `packages/core/src/interfaces/recipient.ts` | Define `Recipient` with optional `email`, `phone`, and `pushToken`. |
| **T-1.3** | Event Interface | `packages/core/src/interfaces/event.ts` | Define `NotificationEvent` with `to`, `channels`, `template`, and `data`. |
| **T-1.4** | Provider Result Interface | `packages/core/src/interfaces/result.ts` | Define `ProviderResult` with `success`, `messageId?`, `error?`, `retryable?`, `retryAfterMs?`. |
| **T-1.5** | Provider Interfaces | `packages/core/src/interfaces/providers.ts` | Define `EmailProvider`, `SmsProvider`, and `PushProvider` method contracts returning `Promise<ProviderResult>`. |
| **T-1.6** | Config Interfaces | `packages/core/src/interfaces/config.ts` | Define `NotifierConfig`, `ProviderConfig`. |
| **T-1.7** | Adapter Metadata Interface | `packages/core/src/interfaces/adapter-metadata.ts` | Define `AdapterMetadata` with `name`, `channel`, and `requiredEnv`. |
| **T-1.8** | Interfaces Entrypoint | `packages/core/src/interfaces/index.ts` | Re-export all public interfaces with TSDoc documentation; ensure zero runtime dependencies. |
| **T-1.9** | Error Classes | `packages/core/src/errors/notifykit-error.ts`<br>`packages/core/src/errors/config-error.ts`<br>`packages/core/src/errors/index.ts` | Define `NotifyKitError` (`code`, `message`, `hint`, `traceId`, `cause`) and `ConfigError` (`E_CONFIG_INVALID`). |
| **T-1.10** | Config Schemas & Redaction | `packages/core/src/config/schema.ts`<br>`packages/core/src/config/redact.ts` | Define Zod schemas strictly for specified provider fields (Twilio credentials, SMTP options, Redis URL) and export `REDACT_PATHS = ['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*'] as const`. |
| **T-1.11** | Config Loader & Validator | `packages/core/src/config/loader.ts`<br>`packages/core/src/config/validator.ts`<br>`packages/core/src/config/index.ts` | Implement `loadConfig(env = process.env)` and `validateConfig(raw: unknown)` producing typed `NotifierConfig` or throwing `ConfigError`. |
| **T-1.12** | Core Package Entrypoint | `packages/core/src/index.ts` | Export public config utilities and error classes (`loadConfig`, `validateConfig`, `REDACT_PATHS`, `NotifyKitError`, `ConfigError`). |
| **T-1.13** | Config Unit Tests | `packages/core/tests/config.test.ts` | Unit tests for config loader and validator (valid config, missing required variables, malformed values, hint checks). |
| **T-1.14** | Interface Contract Tests | `packages/core/tests/interfaces.test.ts` | Type-level contract validation verifying interface assignability (`expectTypeOf`). |
| **T-1.15** | External Consumer Test | `packages/core/tests/consumer.test.ts` | Standalone consumer test validating that building core and importing `'notifykit/interfaces'` resolves through package exports for types and runtime module resolution. |
| **T-1.16** | Coverage & Export Verification | `packages/core/package.json`<br>`packages/core/vitest.config.ts` | Verify coverage on `src/config/` is ≥ 90% and export maps are consistent with built outputs. |

---

## 3. Key Interface Contracts & Configuration Behavior

### 3.1 Public Provider Interface Contracts (`packages/core/src/interfaces/`)

All interfaces reside in `packages/core/src/interfaces/` and have **zero imports from internal modules or third-party packages**.

```typescript
/**
 * Target recipient of a notification.
 */
export interface Recipient {
  /** Target email address (RFC 5322 format) */
  email?: string;
  /** Target phone number in E.164 format (e.g., +14155552671) */
  phone?: string;
  /** Device push registration token (e.g., FCM registration token) */
  pushToken?: string;
}

/**
 * Payload event passed to NotifyKit to trigger a notification.
 */
export interface NotificationEvent {
  /** Target recipient contact details */
  to: Recipient;
  /** Delivery channels to target for this event */
  channels: Array<'email' | 'sms' | 'push'>;
  /** Registered template identifier (e.g., 'welcome-email') */
  template: string;
  /** Key-value variables interpolated into the template */
  data: Record<string, unknown>;
}

/**
 * Standardized result returned by provider adapters after attempting delivery.
 */
export interface ProviderResult {
  /** True if the provider accepted or delivered the notification */
  success: boolean;
  /** Unique provider-assigned message identifier (e.g., Twilio Message SID, SMTP Message-ID) */
  messageId?: string;
  /** Human-readable error message if delivery failed */
  error?: string;
  /**
   * Whether the failure is transient and can be retried by the queue worker.
   * True for 429/5xx/network timeouts; false for invalid credentials or malformed recipients.
   */
  retryable?: boolean;
  /** Suggested backoff duration in milliseconds before retrying (e.g., for rate limits) */
  retryAfterMs?: number;
}

/**
 * Contract implemented by email provider adapters (e.g., Nodemailer).
 */
export interface EmailProvider {
  /** Unique provider name identifier (e.g., 'nodemailer') */
  readonly name: string;
  /** Sends an email message */
  sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult>;
}

/**
 * Contract implemented by SMS provider adapters (e.g., Twilio, MSG91).
 */
export interface SmsProvider {
  /** Unique provider name identifier (e.g., 'twilio', 'msg91') */
  readonly name: string;
  /** Sends an SMS message */
  sendSms(opts: {
    to: string;
    from?: string;
    body: string;
    templateId?: string;
    variables?: Record<string, string>;
  }): Promise<ProviderResult>;
}

/**
 * Contract implemented by Push provider adapters (e.g., FCM).
 */
export interface PushProvider {
  /** Unique provider name identifier (e.g., 'fcm') */
  readonly name: string;
  /** Sends a push notification */
  sendPush(opts: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<ProviderResult>;
}

/**
 * Adapter package metadata exported by every NotifyKit adapter.
 */
export interface AdapterMetadata {
  /** Registered provider identifier (e.g., 'twilio') */
  name: string;
  /** Notification channel supported by this adapter */
  channel: 'email' | 'sms' | 'push';
  /** List of environment variable keys required by this adapter */
  requiredEnv: string[];
}

/**
 * Configuration options for an individual provider adapter.
 */
export interface ProviderConfig {
  /** Adapter provider type identifier (e.g., 'twilio', 'nodemailer', 'fcm') */
  type: string;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Root configuration object passed to NotifyKit initialization.
 */
export interface NotifierConfig {
  /** Redis connection URL (e.g., 'redis://localhost:6379') */
  redis?: string;
  /** Configured providers mapped by channel */
  providers: {
    email?: ProviderConfig;
    sms?: ProviderConfig;
    push?: ProviderConfig;
  };
}
```

### 3.2 Error Classes (`packages/core/src/errors/`)

#### Source Authority & Classification:
- **Mandatory Architecture Rule (`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md Section 4 AGENTS.md §8.4`, lines 3791–3795 — Priority 1):**
  - *"Every thrown error MUST contain a message with a 'how to fix' hint."*
  - *"Every thrown error MUST extend a base `NotifyKitError` class."*
- **Architecture v1.1 §B.8.1 & §B.8.3 (lines 1400–1446):**
  - Defines `NotifyKitError` shape (`code`, `message`, `hint`, `traceId`, `cause`).
  - Defines `E_CONFIG_INVALID` as the standard error code for configuration/startup validation failures.
- **Addendum Part D Note:**
  - Architecture Addendum Part D (§D.1, line 5818) suggests authoring a broad error hierarchy and `docs/errors.md`. Per the master spec note (line 17) and Phase 0 Decision B, Addendum Part D items are **not automatically merged into the phase baseline**.
  - **Plan Alignment:** Only `NotifyKitError` (the base class required by `AGENTS.md` §8.4) and `ConfigError` (with `code: 'E_CONFIG_INVALID'`) are implemented in Phase 1 to satisfy the mandatory agent rule and the Twilio DoD. Broad domain error subclasses (`E_INVALID_EVENT`, etc.) and `docs/errors.md` remain deferred.

```typescript
export class NotifyKitError extends Error {
  readonly code: string;
  readonly hint: string;
  readonly traceId: string;
  readonly cause?: unknown;

  constructor(opts: {
    code: string;
    message: string;
    hint: string;
    traceId?: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'NotifyKitError';
    this.code = opts.code;
    this.hint = opts.hint;
    this.traceId = opts.traceId ?? `err_${Date.now().toString(36)}`;
    this.cause = opts.cause;
  }
}

export class ConfigError extends NotifyKitError {
  constructor(message: string, hint: string, cause?: unknown) {
    super({
      code: 'E_CONFIG_INVALID',
      message,
      hint,
      cause,
    });
    this.name = 'ConfigError';
  }
}
```

### 3.3 Provider Configuration & Verification against Master Specification

The planned schemas and environment variables are strictly verified against master specification references:
1. **SMS Provider (`NOTIFYKIT_SMS_PROVIDER` / `providers.sms`):**
   - **Twilio** (Master Spec lines 1112, 1530–1539, 2645):
     - Required when `type: 'twilio'` (or `NOTIFYKIT_SMS_PROVIDER=twilio`):
       - `TWILIO_ACCOUNT_SID` (string, must be non-empty).
       - `TWILIO_AUTH_TOKEN` (string, must be non-empty).
     - Missing `TWILIO_AUTH_TOKEN` throws `ConfigError` (`E_CONFIG_INVALID`) with message `"Twilio selected but TWILIO_AUTH_TOKEN is missing"` and actionable hint `"Run npx notifykit init or set it in .env"`.
   - **MSG91** (Master Spec line 603, 1118):
     - When `type: 'msg91'`: reads `MSG91_AUTH_KEY` (string).
2. **Email Provider (`NOTIFYKIT_EMAIL_PROVIDER` / `providers.email`):**
   - **Nodemailer / SMTP** (Master Spec lines 1540–1545):
     - When `type: 'nodemailer'` or `type: 'smtp'`:
       - `SMTP_HOST`: string, non-empty.
       - `SMTP_PORT`: number, 1–65535 (coerced from string, default 587).
       - `SMTP_USER`: optional string.
       - `SMTP_PASSWORD`: optional string.
3. **Push Provider (`NOTIFYKIT_PUSH_PROVIDER` / `providers.push`):**
   - When `type: 'fcm'`: type string verified; no invented third-party credential schema is introduced.
4. **Redis Configuration (`REDIS_URL` / `redis`):**
   - (Master Spec line 299, 1534, 1601): Optional connection URL string matching `redis://` or `rediss://`.
5. **Secret Redaction Constant:**
   - (Master Spec line 1532, 2631):
     ```typescript
     export const REDACT_PATHS = ['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*'] as const;
     ```

---

## 4. Dependencies & Package Export Changes

### 4.1 Dependency Updates
- **`packages/core/package.json`**:
  - Add `"zod": "^3.24.0"` to `"dependencies"`.
  - **Constraint:** Zod is an approved core runtime dependency (`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md Section 4 AGENTS.md §6.1`). No unapproved dependencies will be added.

### 4.2 Package Exports
The export map established in Phase 0 remains intact:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./interfaces": {
    "types": "./dist/interfaces/index.d.ts",
    "import": "./dist/interfaces/index.js",
    "require": "./dist/interfaces/index.cjs"
  }
}
```
- In Phase 1:
  - `packages/core/src/interfaces/index.ts` re-exports all interface contracts.
  - `packages/core/src/index.ts` exports `loadConfig`, `validateConfig`, `REDACT_PATHS`, `NotifyKitError`, and `ConfigError`.

---

## 5. Test Cases & Measurable Acceptance Criteria

### 5.1 Configuration Unit Tests (`packages/core/tests/config.test.ts`)

| Test ID | Test Scenario | Expected Outcome |
|:---:|:---|:---|
| **TC-CFG-01** | Valid default configuration with explicit options | `validateConfig()` returns fully typed `NotifierConfig`. |
| **TC-CFG-02** | Valid Twilio SMS environment variables | Validates successfully with `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`. |
| **TC-CFG-03** | Twilio SMS with missing `TWILIO_AUTH_TOKEN` | Throws `ConfigError` with `code: 'E_CONFIG_INVALID'` and hint pointing to `.env` / `npx notifykit init`. |
| **TC-CFG-04** | Twilio SMS with missing `TWILIO_ACCOUNT_SID` | Throws `ConfigError` (`E_CONFIG_INVALID`). |
| **TC-CFG-05** | Valid SMTP email configuration | Validates successfully with host, port 587, user, and password. |
| **TC-CFG-06** | Malformed SMTP port (e.g. non-numeric `"abc"` or `99999`) | Throws `ConfigError` with port validation message. |
| **TC-CFG-07** | Valid Redis URL (`redis://localhost:6379`) | Validates URL string format. |
| **TC-CFG-08** | Malformed Redis URL (`not-a-url`) | Throws `ConfigError` with invalid URL error. |
| **TC-CFG-09** | Custom environment injection | `loadConfig(customEnv)` evaluates without mutating `process.env`. |
| **TC-CFG-10** | Redaction constant verification | `REDACT_PATHS` matches `['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*']`. |

### 5.2 Interface Contract & Type Tests (`packages/core/tests/interfaces.test.ts`)
- **TC-INT-01:** Type contract test verifying that a mock adapter satisfies `EmailProvider`.
- **TC-INT-02:** Type contract test verifying that a mock adapter satisfies `SmsProvider`.
- **TC-INT-03:** Type contract test verifying that a mock adapter satisfies `PushProvider`.
- **TC-INT-04:** Type contract test verifying assignability of `Recipient`, `NotificationEvent`, `ProviderResult`, and `AdapterMetadata`.
- **TC-INT-05:** Zero internal imports check: verifies `src/interfaces/` does not import from `src/config/`, `src/errors/`, or external runtime dependencies.

### 5.3 Standalone External Consumer Test (`packages/core/tests/consumer.test.ts`)

To avoid false positives from source-relative imports (`../src/interfaces`), the external consumer test validates against the **built package artifacts**:

1. **Pre-requisite:** Core package is built (`npm run build --workspace=packages/core`), producing `dist/interfaces/index.d.ts`, `dist/interfaces/index.js`, and `dist/interfaces/index.cjs`.
2. **TypeScript Declaration Check (`dist/interfaces/index.d.ts`):**
   - A consumer test fixture compiles code using `import type { SmsProvider, EmailProvider, PushProvider } from 'notifykit/interfaces'`.
   - Type-checking runs via `tsc --noEmit` on the fixture, confirming that TypeScript resolves the package declaration via `package.json`'s declared `"./interfaces"` export map, not relative source paths.
3. **Runtime ESM & CommonJS Resolution Check:**
   - The test dynamically loads `import('notifykit/interfaces')` (ESM) and `require('notifykit/interfaces')` (CJS) through standard package resolution.
   - Verifies the exported module loads without runtime exceptions and contains zero unexpected runtime side effects.

### 5.4 Measurable Coverage Threshold
- **Coverage Target:** Config module (`packages/core/src/config/`) coverage **≥ 90%** for lines, branches, functions, and statements.

---

## 6. Verification Commands & Phase 1 Definition of Done

### 6.1 Verification Commands
All commands run from the monorepo root using `npm`:

```bash
# 1. Format check
npm run format:check

# 2. Lint check (verifies import rules, module boundaries, no console.log)
npm run lint

# 3. TypeScript compilation check across all packages
npm run typecheck

# 4. Unit and contract test suite
npm test

# 5. Test coverage verification (must meet ≥90% for config module)
npm run test:coverage

# 6. Build ESM, CJS, and DTS artifacts
npm run build

# 7. Size Limit check (core bundle ≤ 60 KB)
npm run size-limit
```

### 6.2 Phase 1 Definition of Done (Master Specification §7 / lines 2643–2648)
- [ ] `import type { SmsProvider } from 'notifykit/interfaces'` works in a fresh consumer test resolving through package exports.
- [ ] Missing `TWILIO_AUTH_TOKEN` with `type: 'twilio'` throws a clear `ConfigError` (`E_CONFIG_INVALID`) with actionable hint at validation time.
- [ ] Test coverage of `config` module is ≥ 90%.
- [ ] Zero imports from `src/interfaces/` to any other internal module or runtime dependency.
- [ ] Bundle size check (`packages/core/dist/index.js`) remains ≤ 60 KB.
- [ ] All lint, format, typecheck, build, and test checks pass with exit code 0.

---

## 7. Preserved Decisions & Governance Register

1. **Package Management Standard:** `npm` and `npm workspaces` (Decision A from Phase 0 Plan).
2. **Architecture Addendum Part D Deferrals:** All 5 optional Part D tasks from Phase 0 remain deferred; the broad domain error hierarchy catalog from Part D is deferred.
3. **Size Limit Compatibility Fix:** Retain `size-limit@12.1.0` and `@size-limit/preset-app@12.1.0` preserving Node 20, 22, and 24 support.
4. **Specification & Plan Integrity:** `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md` and `Docs/PHASE-0-PLAN.md` remain completely unmodified.
