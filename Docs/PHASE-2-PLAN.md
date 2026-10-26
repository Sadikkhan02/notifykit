# NotifyKit — Phase 2 (Template Engine) Implementation Plan

> **Document Type:** Master Implementation Plan (Planning Only)  
> **Status:** Awaiting human review and explicit implementation authorization.  
> **Canonical Plan File:** `Docs/PHASE-2-PLAN.md`  
> **Phase Target:** Phase 2 — Template Engine  
> **Target Workspace:** `packages/core` (within `notifykit` monorepo)  
> **Execution Constraint:** Planning Only — No implementation, package installation, build/test execution, or Git operations authorized.

---

## 1. Document Control & Specification Authority

### 1.1 Source of Truth
This plan is derived directly from [`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/NOTIFYKIT-MASTER-SPECIFICATION.md) and follows the established project architecture and human-approved decisions from [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md) and [`Docs/PHASE-1-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-1-PLAN.md).

Authoritative sections governing Phase 2:
- **Phase 2 Scope & Tasks:** Section 3 (`PHASES.md` §8, lines 2655–2696).
- **Core Functional Requirement CORE-07:** Section 1 (PRD §10.3, line 361) — *"Templates must be rendered with Handlebars using the data payload."*
- **Module Architecture & Dependency Rules:** Section 2 (Architecture v1.1 §5.1–5.3, lines 842–910) — Module 3 `templates/` depends on `interfaces` and `handlebars`.
- **Architectural Decision Record ADR-004:** Section 2 (Architecture v1.1 §ADR-004, lines 2117–2122) & Section 4 (`AGENTS.md` §MUST NOT-11, line 3509) — *"Render templates at enqueue time; keep rendering out of the BullMQ worker."*
- **Error Hierarchy & Standard Codes:** Section 2 (Architecture v1.1 §B.8.1/§B.8.3, lines 1400–1446) — `E_MISSING_TEMPLATE` (400) and `E_MISSING_VARIABLE` (400).
- **Mandatory Agent Error Rules:** Section 4 (`AGENTS.md` §8.4, lines 3791–3795) — All errors must extend `NotifyKitError` and include actionable "how to fix" hints.
- **Approved Dependency Policy:** Section 4 (`AGENTS.md` §6.1, lines 3687–3698) — `handlebars` is an approved core runtime dependency.

### 1.2 Hierarchy of Rules & Section Priority
Per `AGENTS.md` §13:
1. **Priority 1: AGENTS.md** — Mandatory rules, dependency boundaries, error conventions, zero Git operations.
2. **Priority 2: PHASES.md** — Phase scope, deliverables, acceptance criteria, Definition of Done.
3. **Priority 3: Architecture v1.1** — Component structure, ADR-004 fail-fast enqueue rendering, module dependency matrix.
4. **Priority 4: PRD v1.0** — Product requirements and Handlebars rendering.

---

## 2. Current Repository Baseline

An inspection of the workspace confirms the following status:
- **Monorepo Structure:** Managed with `npm` (≥10) workspaces (`packages/core`, `packages/cli`, `packages/test-utils`).
- **Phase 0 Foundation Complete:** Common TypeScript (`tsconfig.base.json`), `tsup`, Vitest (`v8` coverage provider), ESLint, Prettier, Size Limit (`size-limit@12.1.0`), and GitHub Actions matrix for Node.js 20, 22, and 24.
- **Phase 1 Complete:**
  - Public provider interfaces in `packages/core/src/interfaces/`: `Recipient`, `NotificationEvent`, `EmailProvider`, `SmsProvider`, `PushProvider`, `ProviderResult`, `NotifierConfig`, `ProviderConfig`, and `AdapterMetadata` (zero runtime dependencies).
  - Error classes in `packages/core/src/errors/`: `NotifyKitError` (with `code`, `message`, `hint`, `traceId`, `cause`) and `ConfigError` (`E_CONFIG_INVALID`).
  - Configuration in `packages/core/src/config/`: `schema.ts`, `loader.ts`, `validator.ts`, and `redact.ts`.
  - Core bundle size: `1.78 kB` brotlied (budget: ≤ 60 KB).
  - Test suites: 42 tests passing across workspaces (32 core, 1 cli, 1 test-utils, 4 built-package consumer contract tests).
  - Dedicated path-specific threshold in `packages/core/vitest.config.ts`: enforces ≥90% specifically for `src/config/**`.

---

## 3. Exact Boundaries & Scope

### 3.1 In-Scope for Phase 2
1. **Template Renderer (`packages/core/src/templates/render.ts`):**
   - Function `renderTemplate(source: string, data: Record<string, unknown>): string`.
   - Compiles and executes Handlebars templates against user-provided data.
   - Detects missing template variables using supported Handlebars mechanisms (AST traversal or strict compilation with error mapping) and throws `MissingVariableError` with clear fix hints.
2. **Template Store (`packages/core/src/templates/store.ts`):**
   - Class `TemplateStore` implementing:
     - `register(id: string, source: string): void` — compiles and caches the template in memory.
     - `get(id: string): HandlebarsTemplateDelegate` — retrieves compiled template; throws `MissingTemplateError` if not registered.
     - `has(id: string): boolean` — checks registration status.
     - `delete(id: string): boolean` — removes a cached template.
     - `clear(): void` — clears all cached templates (for process shutdown / testing).
     - `render(id: string, data: Record<string, unknown>): string` — convenience helper that verifies existence, renders, and validates variables.
     - `loadFromDirectory(dirPath: string, extension?: string): Promise<number>` — optional filesystem loader reading `.hbs` or `.html` template files from a local directory.
3. **Handlebars Helpers (`packages/core/src/templates/helpers.ts`):**
   - `uppercase(str: string): string` — transforms strings to uppercase.
   - `formatDate(date: Date | string | number, format?: string): string` — formats dates reliably using standard JavaScript/Intl formatting.
   - Registration utility binding default helpers to the isolated Handlebars environment.
4. **Error Classes (`packages/core/src/templates/errors.ts`):**
   - `MissingTemplateError` — extends `NotifyKitError` with code `E_MISSING_TEMPLATE` and actionable hint.
   - `MissingVariableError` — extends `NotifyKitError` with code `E_MISSING_VARIABLE` and actionable hint.
5. **Module Entrypoint & Public Exports:**
   - `packages/core/src/templates/index.ts` re-exporting all template functionality.
   - `packages/core/src/index.ts` exporting `renderTemplate`, `TemplateStore`, `MissingTemplateError`, `MissingVariableError`.
6. **Testing & Coverage:**
   - Unit tests covering basic rendering, helper functions, missing variable validation, missing template detection, malformed syntax errors, and store caching.
   - Performance benchmark test: renders 1,000 templates in < 5 seconds total (< 5 ms per template at p99).
   - Dedicated coverage threshold in `packages/core/vitest.config.ts`: enforces ≥90% across statements, branches, functions, and lines for `src/templates/**`.

### 3.2 Strictly Out-of-Scope
- **No Orchestration:** No implementation of `notify()`, channel routing, or provider resolution (Phase 6).
- **No Factory Wiring:** No `createNotifier()` factory or full `notifier.registerTemplate()` integration (Phase 6). `TemplateStore` will provide the exact method contract so `createNotifier()` can delegate directly to it in Phase 6.
- **No Queue or Worker Execution:** No BullMQ producer or worker execution (Phase 3 & Phase 5). Per ADR-004, templates are rendered exclusively at enqueue time and never in workers.
- **No External / Database Templates:** No database-backed template persistence or template versioning (deferred to v1.1).
- **No CLI Wizard Features:** CLI template scaffolding belongs to Phase 10.
- **No Git Operations:** Git commits and pushes remain human-owned.

---

## 4. Ordered Tasks & Target File Paths

| Task # | Step | Target File(s) | Description |
|:---:|:---|:---|:---|
| **T-2.1** | Dependency Addition | `packages/core/package.json`<br>`package-lock.json` | Add approved runtime dependency `handlebars` (`^4.7.8`) to `packages/core`. Note: Handlebars bundles its own TypeScript declarations (`types/index.d.ts`); do not add `@types/handlebars`. Run `npm install`. |
| **T-2.2** | Template Errors | `packages/core/src/templates/errors.ts`<br>`packages/core/src/errors/index.ts` | Implement `MissingTemplateError` (`E_MISSING_TEMPLATE`) and `MissingVariableError` (`E_MISSING_VARIABLE`), extending `NotifyKitError`. Re-export from `src/errors/index.ts`. |
| **T-2.3** | Built-in Helpers | `packages/core/src/templates/helpers.ts` | Implement `uppercase` and `formatDate` helpers, with registration utility for the isolated Handlebars instance. |
| **T-2.4** | Template Renderer | `packages/core/src/templates/render.ts` | Implement `renderTemplate(source, data)` using a supported Handlebars approach (AST inspection via `Handlebars.parse` / `Visitor` or compilation with `{ strict: true }`), enforcing strict missing-variable fail-fast validation and syntax error handling. |
| **T-2.5** | Template Store | `packages/core/src/templates/store.ts` | Implement `TemplateStore` class with `register`, `get`, `has`, `delete`, `clear`, `render`, and optional `loadFromDirectory`. |
| **T-2.6** | Templates Module Entrypoint | `packages/core/src/templates/index.ts` | Re-export `renderTemplate`, `TemplateStore`, `MissingTemplateError`, `MissingVariableError`, and helper types. |
| **T-2.7** | Core Package Exports | `packages/core/src/index.ts` | Export template public surface (`renderTemplate`, `TemplateStore`, `MissingTemplateError`, `MissingVariableError`) from core package entrypoint. |
| **T-2.8** | Unit & Edge-Case Tests | `packages/core/tests/templates.test.ts` | Comprehensive unit tests (8+ cases) for successful render, helpers, missing variables, missing templates, syntax errors, and store operations. |
| **T-2.9** | Performance Benchmark Test | `packages/core/tests/templates-perf.test.ts` | Performance benchmark test rendering 1,000 templates in < 5 seconds (< 5ms p99). |
| **T-2.10** | Coverage Configuration | `packages/core/vitest.config.ts` | Add `'src/templates/**'` threshold of 90% across statements, branches, functions, and lines. |

---

## 5. Public API & Error Contracts

### 5.1 Template Store Contract (`packages/core/src/templates/store.ts`)

```typescript
import type { HandlebarsTemplateDelegate } from 'handlebars';

export class TemplateStore {
  /**
   * Registers and pre-compiles a template in memory.
   *
   * @param id Unique template identifier (e.g., 'welcome-email')
   * @param source Raw Handlebars template string
   */
  register(id: string, source: string): void;

  /**
   * Retrieves a pre-compiled template delegate by ID.
   *
   * @param id Template identifier
   * @throws {MissingTemplateError} If template ID is not registered
   */
  get(id: string): HandlebarsTemplateDelegate;

  /**
   * Checks whether a template ID is registered.
   *
   * @param id Template identifier
   */
  has(id: string): boolean;

  /**
   * Removes a template from the store.
   *
   * @param id Template identifier
   * @returns True if the template was found and removed
   */
  delete(id: string): boolean;

  /**
   * Clears all registered templates from memory.
   */
  clear(): void;

  /**
   * Renders a registered template with the provided data payload.
   *
   * @param id Template identifier
   * @param data Variable interpolation payload
   * @returns Rendered template string
   * @throws {MissingTemplateError} If template ID is not registered
   * @throws {MissingVariableError} If a required variable is missing
   */
  render(id: string, data: Record<string, unknown>): string;

  /**
   * Optional helper: Loads and registers all template files from a local directory.
   *
   * @param dirPath Directory path to scan for templates
   * @param extension File extension filter (defaults to '.hbs')
   * @returns Number of templates loaded
   */
  loadFromDirectory(dirPath: string, extension?: string): Promise<number>;
}
```

### 5.2 Standalone Render Function (`packages/core/src/templates/render.ts`)

```typescript
/**
 * Compiles and renders a raw Handlebars template string with user data.
 * Validates that all required template variables are present in the data context.
 *
 * @param source Raw Handlebars template string
 * @param data Data context object for interpolation
 * @returns Rendered output string
 * @throws {MissingVariableError} If a variable referenced in the template is undefined
 * @throws {NotifyKitError} If template syntax is malformed
 */
export function renderTemplate(
  source: string,
  data: Record<string, unknown>
): string;
```

### 5.3 Error Class Contracts (`packages/core/src/templates/errors.ts`)

Both error classes extend `NotifyKitError` per `AGENTS.md` §8.4:

```typescript
import { NotifyKitError } from '../errors/notifykit-error';

/**
 * Thrown when a template identifier is requested but has not been registered in TemplateStore.
 */
export class MissingTemplateError extends NotifyKitError {
  readonly templateId: string;

  constructor(templateId: string) {
    super({
      code: 'E_MISSING_TEMPLATE',
      message: `Template "${templateId}" is not registered`,
      hint: `Register the template before use using notifier.registerTemplate("${templateId}", source) or store.register("${templateId}", source)`,
    });
    this.name = 'MissingTemplateError';
    this.templateId = templateId;
  }
}

/**
 * Thrown when a template references a variable that is missing (undefined) in the data payload.
 */
export class MissingVariableError extends NotifyKitError {
  readonly variableName: string;
  readonly templateId?: string;

  constructor(variableName: string, templateId?: string) {
    const contextMsg = templateId
      ? `in template "${templateId}"`
      : 'in template';
    super({
      code: 'E_MISSING_VARIABLE',
      message: `Required template variable "${variableName}" is missing ${contextMsg}`,
      hint: `Provide "${variableName}" in the notification data payload: { data: { ${variableName}: ... } }`,
    });
    this.name = 'MissingVariableError';
    this.variableName = variableName;
    this.templateId = templateId;
  }
}
```

---

## 6. Dependency Additions & Rationale

### 6.1 Package Additions
- **Runtime (`packages/core/package.json`):**
  - `"handlebars": "^4.7.8"`
  - **Rationale:** Mandated by Master Specification Section 1 (`PRD §10.3 CORE-07`), Section 2 (`Architecture v1.1 §5.2`), and Section 4 (`AGENTS.md §6.1`). Handlebars is an approved core runtime dependency.
- **Development (`package.json` root devDependencies):**
  - *None required for Handlebars.*
  - **Rationale:** Handlebars (`^4.7.8`) directly ships with its own official TypeScript definitions (`types/index.d.ts`, declared via `"types": "types/index.d.ts"` in `handlebars/package.json`). Adding `@types/handlebars` is unnecessary and omitted to avoid redundant or conflicting typings. Handlebars is retained as the sole approved runtime dependency in `packages/core/package.json`.

### 6.2 Module Isolation & Bundle Size Strategy
- Handlebars is listed under `dependencies` of `packages/core`. When `tsup` bundles `packages/core/dist/index.js`, external dependencies are not inlined in the library bundle.
- In webpack / Size Limit simulation, Handlebars runtime is ~20 KB brotlied. Added to NotifyKit's current 1.78 KB brotlied size, the total remains well under the **60 KB** budget.

---

## 7. Testing Strategy & Measurable Verification

### 7.1 Unit & Edge-Case Tests (`packages/core/tests/templates.test.ts`)

| Test ID | Test Scenario | Expected Outcome |
|:---:|:---|:---|
| **TC-TPL-01** | Simple variable substitution (`{{name}}` with `{ name: 'John' }`) | Returns `'John'`. (Master Spec DoD) |
| **TC-TPL-02** | Multiple variables & nested object paths (`{{user.firstName}} {{user.lastName}}`) | Correctly resolves nested properties. |
| **TC-TPL-03** | Built-in helper `uppercase` (`{{uppercase name}}`) | Transforms string to uppercase (`'JOHN'`). |
| **TC-TPL-04** | Built-in helper `formatDate` | Formats Date object, timestamp, or ISO string to standard formatted date string. |
| **TC-TPL-05** | Missing top-level variable validation (`{{name}}` with `{}`) | Throws `MissingVariableError` with `code: 'E_MISSING_VARIABLE'` and actionable hint identifying missing variable `'name'`. (Master Spec DoD) |
| **TC-TPL-06** | Missing nested path validation (`{{user.address.city}}` with `{ user: {} }` or `{}`) | Throws `MissingVariableError` with `code: 'E_MISSING_VARIABLE'` identifying missing nested path `'user.address.city'`. |
| **TC-TPL-07** | Missing template retrieval in `TemplateStore` | `store.get('unknown')` throws `MissingTemplateError` with `code: 'E_MISSING_TEMPLATE'`. (Master Spec DoD) |
| **TC-TPL-08** | Missing template render via `store.render('unknown', {})` | Throws `MissingTemplateError` with `code: 'E_MISSING_TEMPLATE'`. |
| **TC-TPL-09** | Malformed template syntax (e.g., unclosed tag `{{name` or mismatched blocks `{{#if x}}...{{/unless}}`) | Throws `NotifyKitError` with syntax error details, cause, and actionable hint. |
| **TC-TPL-10** | Store lifecycle operations (`has`, `register`, `delete`, `clear`) | State transitions verify template registration, existence, removal, and clearing. |
| **TC-TPL-11** | Template caching verification | Modifying or re-accessing cached template uses the pre-compiled delegate without re-parsing. |
| **TC-TPL-12** | Optional filesystem loading (`loadFromDirectory`) | Loads `.hbs` files from a temporary directory, registers them by filename, and renders correctly. |
| **TC-TPL-13** | Conditional block with explicit boolean/falsy value (`{{#if hasDiscount}}Discount{{else}}Regular{{/if}}` with `{ hasDiscount: false }`) | Evaluates cleanly to `'Regular'` without throwing. |
| **TC-TPL-14** | Conditional `#if` and `#unless` with missing property (`{{#if hasDiscount}}Discount{{/if}}` with `{}`) | Asserts expected behavior per resolved conditional policy: throws `MissingVariableError` under strict presence (Option A), or evaluates to falsy/empty output under falsy branch evaluation (Option B). |

### 7.2 Performance Benchmark Test (`packages/core/tests/templates-perf.test.ts`)
- **Benchmark Target (Master Spec §8 line 2680 & DoD line 2689):**
  - Render 1,000 pre-registered templates with dynamic data payloads.
  - Assert total duration < 5.0 seconds (< 5,000 ms).
  - Calculate p99 latency across all 1,000 executions and assert **p99 < 5.0 ms per template**.

### 7.3 Test Coverage Requirement
- `packages/core/vitest.config.ts` will enforce a dedicated threshold:
  ```typescript
  'src/templates/**': {
    lines: 90,
    branches: 90,
    functions: 90,
    statements: 90,
  }
  ```
- All statements, branches, functions, and lines in `src/templates/` must meet or exceed 90%.

---

## 8. Verification Commands

All checks must be executed from the monorepo root using `npm`:

```bash
# 1. Install dependencies
npm install

# 2. Check code formatting
npm run format:check

# 3. Run linter (module boundaries, no console.log)
npm run lint

# 4. TypeScript compilation across all workspaces
npm run typecheck

# 5. Unit and performance test suite
npm test

# 6. Test coverage verification (must meet >=90% for src/templates/**)
npm run test:coverage

# 7. Build ESM, CJS, and DTS artifacts
npm run build

# 8. Size Limit check (core bundle <= 60 KB)
npm run size-limit
```

---

## 9. Definition of Done Checklist

- [ ] Rendering a template with `{{name}}` and `{ name: 'John' }` produces `'John'`.
- [ ] Missing template throws `MissingTemplateError` with code `E_MISSING_TEMPLATE` and actionable hint.
- [ ] Missing variable throws `MissingVariableError` with code `E_MISSING_VARIABLE` and actionable hint.
- [ ] Render performance benchmark meets < 5ms per template at p99 (1,000 templates in < 5s total).
- [ ] Test coverage for `packages/core/src/templates/` is ≥ 90% across statements, branches, functions, and lines.
- [ ] Core bundle size remains within the **60 KB** budget (`npm run size-limit` passes).
- [ ] All linting, formatting, typechecking, build, and test gates pass with exit code 0.

---

## 10. Risks, Assumptions, and Blocker Assessment

1. **Missing Variable & Syntax Semantics (Supported Handlebars Mechanisms):**
   - *Handlebars Mechanics:* Handlebars does not provide a custom property-lookup interceptor hook. Instead, two supported mechanisms exist in Handlebars to achieve strict detection:
     - **Mechanism 1 (AST Pre-Scan via `Handlebars.parse` / `Handlebars.Visitor`):** Walk the parsed AST, traverse `MustacheStatement` and `PathExpression` nodes to collect required interpolation paths, and validate them against `data` before execution.
     - **Mechanism 2 (Handlebars Native Strict Mode with Error Translation):** Compile with `Handlebars.compile(source, { strict: true })`. At render time, Handlebars throws an internal `Error` when a referenced property is missing in `data`; the renderer catches and re-wraps it into `MissingVariableError` (`E_MISSING_VARIABLE`).
   - *Defined Behavior by Category:*
     - **Missing top-level variables:** If an output variable (e.g., `{{name}}`) is missing or undefined in `data`, rendering strictly fails and throws `MissingVariableError` (`E_MISSING_VARIABLE`) with actionable hint. Explicit values like `null`, `false`, `0`, or `""` are defined and do not throw.
     - **Missing nested paths:** If a nested path (e.g., `{{user.address.city}}`) references missing parent objects or undefined properties (e.g., `{ user: {} }` or `{}`), rendering strictly fails and throws `MissingVariableError` (`E_MISSING_VARIABLE`), identifying the unresolved path.
     - **Missing properties in `#if` and `#unless` (Narrow Ambiguity Flagged):**
       - *Master Spec Ambiguity:* Master Specification §8 DoD specifies *"Missing variable throws `MissingVariableError` at enqueue time"*, but does not explicitly state whether this applies to conditional branch expressions (`#if`, `#unless`) or exclusively to rendered interpolation outputs.
       - *Option A (Strict Presence / Native `{ strict: true }`):* Any property queried in `#if`/`#unless` must be explicitly present in `data` (even if `false` or `null`); omitted properties throw `MissingVariableError`. Matches native Handlebars strict mode.
       - *Option B (Falsy Evaluation for Conditionals):* Missing properties in `#if`/`#unless` evaluate to falsy (rendering the `else` branch or omitting content) without throwing. Requires Mechanism 1 (AST visitor) to differentiate conditional blocks from output interpolations.
       - *Decision Flag:* This narrow ambiguity is flagged for human owner confirmation. In both options, the master specification DoD requirement that missing output variables fail-fast with `MissingVariableError` is strictly preserved.
     - **Malformed template syntax:** Unclosed delimiters (e.g., `{{name`), mismatched blocks (e.g., `{{#if x}}...{{/unless}}`), or invalid syntax fail during compilation (`Handlebars.compile` or `Handlebars.parse`). The error is caught and wrapped into `NotifyKitError` (with error message, cause, and actionable hint), failing fast before enqueue.
2. **Filesystem Loading Security & Portability:**
   - *Detail:* `loadFromDirectory` reads local templates from disk.
   - *Design Solution:* Use standard `node:fs/promises` (`readdir`, `readFile`) with normalized paths. No external globbing library is introduced. Confining filesystem reads to the explicit method ensures the core in-memory store remains pure and lightweight.
3. **Blockers:**
   - **Zero genuine blockers.** All Phase 2 specifications are clear, self-contained, and fully compatible with the existing Phase 0 and Phase 1 foundation.

---

## 11. Expected File Changes Summary

| Action | Path | Description |
|---|---|---|
| **Modified** | `packages/core/package.json` | Add `handlebars: "^4.7.8"` under `dependencies` |
| **Modified** | `package-lock.json` | Synchronized via `npm install` (Handlebars bundles its own types; no `@types/handlebars` added) |
| **New** | `packages/core/src/templates/errors.ts` | `MissingTemplateError` and `MissingVariableError` classes |
| **New** | `packages/core/src/templates/helpers.ts` | `uppercase` and `formatDate` Handlebars helpers |
| **New** | `packages/core/src/templates/render.ts` | `renderTemplate()` function with variable validation |
| **New** | `packages/core/src/templates/store.ts` | `TemplateStore` class with in-memory cache & filesystem loader |
| **New** | `packages/core/src/templates/index.ts` | Module entrypoint re-exporting template APIs and types |
| **Modified** | `packages/core/src/errors/index.ts` | Re-export `MissingTemplateError` and `MissingVariableError` |
| **Modified** | `packages/core/src/index.ts` | Export `renderTemplate`, `TemplateStore`, and template errors |
| **New** | `packages/core/tests/templates.test.ts` | Unit tests for rendering, store, helpers, and error cases |
| **New** | `packages/core/tests/templates-perf.test.ts` | Performance benchmark test (1,000 renders < 5s) |
| **Modified** | `packages/core/vitest.config.ts` | Add `'src/templates/**'` 90% threshold |
