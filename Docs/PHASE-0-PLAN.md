# NotifyKit — Phase 0 (Foundation & Tooling) Implementation Plan

> **Document Type:** Master Implementation Plan (Revision 7 — Planning Only)  
> **Status:** Awaiting human review and explicit implementation authorization.  
> **Canonical Plan File:** `Docs/PHASE-0-PLAN.md`  
> **Phase Target:** Phase 0 — Foundation & Tooling  
> **Repository Target:** `/home/sadik-khan/SadikWork/Projects/Notifykit`  
> **Author:** Antigravity AI (Pair Programming Assistant)  
> **Execution Constraint:** Planning Only — No implementation, package installation, or Git operations authorized.

---

## 1. Document Control & Specification Authority

### 1.1 Specification Source of Truth
This plan is derived directly and exclusively from the project's single consolidated master document:
- **Master Specification Document:** [`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/NOTIFYKIT-MASTER-SPECIFICATION.md) (265,069 bytes, 5,913 lines).

No standalone `ARCHITECTURE.md`, `PHASES.md`, or `AGENTS.md` files exist in the repository; all architectural rules, phase definitions, and agent constraints reside within embedded sections of this consolidated file.

- **Embedded Source Sections Incorporated:**
  1. **Section 1: Product Requirements Document (PRD) v1.0** (Lines 33–636)
  2. **Section 2: Consolidated System Architecture Document v1.1** (Lines 637–2349)
  3. **Section 3: Implementation Phases & Build Flow v1.0 (`PHASES.md`)** (Lines 2350–3448)
  4. **Section 4: AI Development Rules (`AGENTS.md`) v1.0** (Lines 3449–4024)
  5. **Section 5: Source Appendix A — Original Architecture v1.0** (Lines 4025–5095)
  6. **Section 6: Source Appendix B — Architecture Addendum v1.0** (Lines 5096–5913)

### 1.2 Hierarchy of Rules & Section Priority
Per `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md Section 4 (AGENTS.md v1.0 §13)`, conflicting statements adhere to the following priority hierarchy:
1. **Priority 1: Section 4 (AGENTS.md v1.0)** — Mandatory behavior rules, execution limits, dependency bans, verification commands.
2. **Priority 2: Section 3 (Implementation Phases & Build Flow v1.0 / PHASES.md)** — Build sequence, task checklists, Definition of Done, release gates.
3. **Priority 3: Section 2 (Consolidated System Architecture Document v1.1)** — Component structure, module boundaries, technology stack.
4. **Priority 4: Section 1 (Product Requirements Document v1.0 / PRD.md)** — Product goals, market context, non-goals.

Where cross-section conflicts exist, they are preserved in the **Documentation Conflict Register (§4)** and resolved via documented human-approved project decisions.

---

## 2. Human-Approved Project Decisions

The following binding project decisions have been confirmed by the human owner and govern this plan:

### Decision A: Package Management Standard — `npm` and `npm workspaces`
- **Resolution:** NotifyKit standardizes on **`npm` (≥10)** and **`npm workspaces`**.
- **Context:** Resolves the discrepancy between Section 2 (Architecture v1.1 §7, line 1001: specifying `npm >=10`) and Section 3 / Section 4 (`PHASES.md` / `AGENTS.md`, which used `pnpm` command syntax).
- **Enforcement in this Plan:**
  - Root workspace configuration uses `"workspaces": ["packages/*"]` inside root `package.json`.
  - All proposed scripts, execution steps, and verification procedures use valid `npm` commands (`npm run <cmd> --workspaces`, `npm test --workspaces`).
  - `pnpm` is completely removed as a required tool for this repository. It will not be introduced alongside `npm`.
  - The text in `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md` remains untouched. Section passages mentioning `pnpm` are logged in the Conflict Register (§4) for a future authorized documentation update.

### Decision B: Deferral of Architecture Addendum Part D Optional Tasks
- **Resolution:** All five candidate tasks from Section 6 (`Architecture Addendum Part D §D.1`, lines 5809–5815) are **deferred** from Phase 0:
  1. `docs/openapi.yaml` placeholder
  2. `spectral` CLI configuration
  3. `openapi-diff` CI integration
  4. Docker Compose Redis 7 configuration (`docker-compose.yml`)
  5. Root `.env.example` template
- **Enforcement in this Plan:** None of these five files or configurations will be created in Phase 0. No substitute tasks under alternate names will be added. They are preserved in the Deferred Tasks Register (§12) for scheduling in their appropriate future phases.

---

## 3. Current Repository State & Canonical Plan File

Based strictly on previously collected inspection evidence:
- **Directory Path:** `/home/sadik-khan/SadikWork/Projects/Notifykit`
- **Existing File Tree:**
  ```
  /home/sadik-khan/SadikWork/Projects/Notifykit/
  └── Docs/
      ├── NOTIFYKIT-MASTER-SPECIFICATION.md
      └── PHASE-0-PLAN.md
  ```
- **Canonical Plan Designation:** [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md) is the sole canonical implementation plan document.
- **Git State:** Not initialized (`fatal: not a git repository`).
- **Environment:** Node.js v24.21.0, npm v11.19.0, pnpm v12.4.2, and Docker v29.8.0 are installed on the host system.
- **Integrity Rule:** `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md` must remain strictly untouched.

---

## 4. Documentation Conflict Register

| ID | Issue & Source Location | Human-Approved Resolution / Recommendation | Remaining Ambiguity / Notes | Master Spec Sections Requiring Future Update |
| :--- | :--- | :--- | :--- | :--- |
| **CR-01** | **Package Manager Tooling**<br>• Master Spec Sec 2 §7 (L1001): `npm >=10`<br>• Master Spec Sec 2 §19.1 (L2093): `npm or pnpm deferred`<br>• Master Spec Sec 3 §6 (L2545, L2587): `pnpm -r`<br>• Master Spec Sec 4 §3.1, §11: `pnpm lint`, etc. | **Approved Decision A:** Use `npm >=10` and `npm workspaces`. All Phase 0 scripts adapted to `npm`. | None for Phase 0 execution. | `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`<br>• Section 4 (AGENTS.md v1.0 §3.1 MUST-09, §4.2, §11)<br>• Section 3 (PHASES.md v1.0 §6 DoD). |
| **CR-02** | **Addendum Part D Tasks**<br>• Master Spec Sec 6 §D.1 (L5809): 5 tasks proposed for Phase 0.<br>• Master Note (L17): Not silently merged. | **Approved Decision B:** Defer all 5 tasks from Phase 0 baseline scope. | None. Retained in Deferred Register (§12). | `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`<br>• Section 3 (PHASES.md v1.0 §6) to confirm deferrals. |
| **CR-03** | **Dual ESM/CJS Output Scope**<br>• Master Spec Sec 3 §6 (L2572): `Configure tsup for dual ESM+CJS output`.<br>• Master Spec Sec 2 §15.1: Dual format via `tsup`. | **Technical Resolution:** Apply dual ESM+CJS to `packages/core` (library package). `packages/cli` is ESM-only executable. | Section wording does not explicitly limit dual output to core, but Section 2 §4.1 clarifies CLI is executable tool. | None required. |
| **CR-04** | **`@notifykit/test-utils` Publication**<br>• Master Spec Sec 2 §4: Lists core, cli, adapters as artifacts.<br>• Master Spec Sec 2 §19.1 & Sec 3 §17: Lists `packages/test-utils`. | **Recommendation:** Treat `@notifykit/test-utils` as an internal workspace package skeleton in Phase 0. | Whether it is ever published to npm registry is unstated in Section 1 or Section 2. Flagged for Phase 11. | `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`<br>• Section 2 §15 and Section 3 §17. |
| **CR-05** | **Redis Namespace Convention**<br>• Master Spec Sec 2 §8.1 vs Sec 6 §A.4.1 (`notifykit:*` vs `bull:notifykit:*`). | **Flagged:** Does not affect Phase 0 (no Redis code). Must be settled before Phase 3. | Unresolved in master specification text. | `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`<br>• Section 2 §8 and Section 3 §9. |

---

## 5. Exact Baseline Phase 0 Checklist

The baseline scope from `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md Section 3 (PHASES.md v1.0 §6, lines 2562–2579)` consists of the following 18 tasks, adapted to the human-approved `npm` package manager decision:

- [ ] **TASK-P0-01**: Create GitHub repo `notifykit` *(Human-owned)*
- [ ] **TASK-P0-02**: Initialize monorepo with `packages/` directory
- [ ] **TASK-P0-03**: Add npm `workspaces` in root `package.json`
- [ ] **TASK-P0-04**: Create shared `tsconfig.base.json` (strict, `moduleResolution: bundler`, `target: ES2022`)
- [ ] **TASK-P0-05**: Create `packages/core/package.json` with correct `exports` map
- [ ] **TASK-P0-06**: Create `packages/cli/package.json` skeleton
- [ ] **TASK-P0-07**: Create `packages/test-utils/package.json` skeleton
- [ ] **TASK-P0-08**: Install ESLint + Prettier + plugins
- [ ] **TASK-P0-09**: Configure `import/no-cycle` and `no-console`
- [ ] **TASK-P0-10**: Configure Vitest with coverage thresholds (85%)
- [ ] **TASK-P0-11**: Configure `tsup` for dual ESM+CJS output (core)
- [ ] **TASK-P0-12**: Add `size-limit` with core budget (60 KB)
- [ ] **TASK-P0-13**: Create GitHub Actions workflow `.github/workflows/ci.yml`
- [ ] **TASK-P0-14**: Configure Changesets (`.changeset/config.json`)
- [ ] **TASK-P0-15**: Add `LICENSE` (MIT)
- [ ] **TASK-P0-16**: Add `.gitignore` (`node_modules`, `dist`, `.env`, `coverage`)
- [ ] **TASK-P0-17**: Add `CONTRIBUTING.md` (basic)
- [ ] **TASK-P0-18**: Verify CI passes on an empty commit *(Human commit/push + Local verification)*

---

## 6. npm Workspace Configuration & Command Conventions

### 6.1 Root Workspace Definition (`package.json`)
```json
{
  "name": "notifykit-monorepo",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "test:coverage": "npm run test:coverage --workspace=packages/core && npm run test:coverage --workspace=packages/cli",
    "lint": "eslint .",
    "typecheck": "npm run typecheck --workspaces",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "size-limit": "size-limit"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

### 6.2 Workspace Command Validation & Failure Propagation

To ensure robust execution across npm workspaces without relying on unsupported flags or risking silent skips, every root script has been audited:

| Root Command | Invocation Method | Packages Covered | Script Existence Guarantee | Failure Propagation Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`npm run build`** | Runs `npm run build --workspaces` | `core`, `cli`, `test-utils` | **Mandatory in all workspaces.** Every package manifest defines `"build": "tsup"`. | If `tsup` fails in any package, npm stops and exits with non-zero code. |
| **`npm test`** | Runs `npm test --workspaces` *(or `npm run test --workspaces`)* | `core`, `cli`, `test-utils` | **Mandatory in all workspaces.** Every package manifest defines `"test": "vitest run"`. | If any test fails in any workspace, npm stops and exits with non-zero code. |
| **`npm run test:coverage`** | Runs `npm run test:coverage --workspace=packages/core && npm run test:coverage --workspace=packages/cli` | `core`, `cli` *(packages with prescribed thresholds)* | **Mandatory in `core` and `cli`.** `packages/test-utils` intentionally has no coverage script. | The shell `&&` operator guarantees that if `core` coverage fails or script is missing, command terminates immediately. CLI runs only if Core passes. Both must succeed. |
| **`npm run typecheck`** | Runs `npm run typecheck --workspaces` | `core`, `cli`, `test-utils` | **Mandatory in all workspaces.** Every package manifest defines `"typecheck": "tsc --noEmit"`. | If type diagnostics fail in any package, npm exits with non-zero code. |
| **`npm run lint`** | Runs `eslint .` from root context | Entire repository | Root execution. Does not depend on individual workspace package scripts. | If any lint error occurs anywhere in monorepo, ESLint exits with code 1. |
| **`npm run size-limit`** | Runs `size-limit` from root context | `packages/core` bundle | Root execution. Targets `.size-limit.json`. | If bundle size exceeds 60 KB, size-limit exits with non-zero code. |
| **`npm run format:check`** | Runs `prettier --check .` from root context | Entire repository | Root execution. | If any file is unformatted, Prettier exits with non-zero code. |

---

## 7. Package, Build, and Export Configuration

### 7.1 `packages/core` (`notifykit`)
- **Manifest (`packages/core/package.json`):** Matches Section 2 (Architecture v1.1 §15.2, lines 1904–1923):
  ```json
  {
    "name": "notifykit",
    "version": "0.0.1",
    "type": "module",
    "sideEffects": false,
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
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
    },
    "scripts": {
      "build": "tsup",
      "test": "vitest run",
      "test:coverage": "vitest run --coverage",
      "typecheck": "tsc --noEmit"
    },
    "files": ["dist", "README.md", "LICENSE"],
    "engines": { "node": ">=20.0.0" }
  }
  ```
- **Build Configuration (`packages/core/tsup.config.ts`):**
  ```typescript
  import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: {
      index: 'src/index.ts',
      'interfaces/index': 'src/interfaces/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.js' : '.cjs',
      };
    },
  });
  ```

### 7.2 Core Export-Verification Contract & Build Artifact Inventory
To eliminate ambiguity between package contracts and build artifacts:

1. **Declared Export Target Contract (The 6 Package-Contract Files):**
   These are the exact 6 files declared in `packages/core/package.json` (`main`, `module`, `types`, and `exports`) that must physically exist for the package to be consumable:
   - `dist/index.js` (Main package ESM entrypoint)
   - `dist/index.cjs` (Main package CommonJS entrypoint)
   - `dist/index.d.ts` (Main package TypeScript declaration file)
   - `dist/interfaces/index.js` (Subpath `./interfaces` ESM entrypoint)
   - `dist/interfaces/index.cjs` (Subpath `./interfaces` CommonJS entrypoint)
   - `dist/interfaces/index.d.ts` (Subpath `./interfaces` TypeScript declaration file)
2. **Accompanying JavaScript Source Maps:**
   `tsup.config.ts` enables `sourcemap: true`, which produces `.js.map` and `.cjs.map` files alongside compiled JavaScript files. While expected in development, their presence is not enforced as a rigid file-count gate.
3. **No Strict Total File Count Gate:**
   The build verification does not require an exact fixed count of files in `dist/` (which can vary depending on bundler chunking and map output). Instead, it enforces the **6 declared export contract files** strictly.
4. **Implementation-Time Export Verification Script:**
   During Step 5 of implementation, the following script will verify that every declared export target exists and report missing files with clear errors:
   ```bash
   node -e "
   const fs = require('fs');
   const pkg = JSON.parse(fs.readFileSync('packages/core/package.json', 'utf8'));
   const requiredTargets = [
     pkg.exports['.'].import,
     pkg.exports['.'].require,
     pkg.exports['.'].types,
     pkg.exports['./interfaces'].import,
     pkg.exports['./interfaces'].require,
     pkg.exports['./interfaces'].types
   ];
   const missing = requiredTargets.filter(p => !fs.existsSync('packages/core/' + p));
   if (missing.length > 0) {
     console.error('Export target verification failed. Missing files:\n' + missing.join('\n'));
     process.exit(1);
   }
   console.log('All ' + requiredTargets.length + ' declared packages/core export targets verified on disk.');
   "
   ```
   *Note: This check is an implementation verification procedure; it has not been run during planning.*

---

### 7.3 `packages/cli` (`notifykit-cli`)
- **Format:** ESM-only with Node shebang banner (`#!/usr/bin/env node`) per Section 2 §4.1 and Section 1 §11.
- **Manifest (`packages/cli/package.json`):**
  ```json
  {
    "name": "notifykit-cli",
    "version": "0.0.1",
    "type": "module",
    "bin": {
      "notifykit": "./dist/index.js"
    },
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "scripts": {
      "build": "tsup",
      "test": "vitest run",
      "test:coverage": "vitest run --coverage",
      "typecheck": "tsc --noEmit"
    },
    "files": ["dist"],
    "engines": { "node": ">=20.0.0" }
  }
  ```
- **Build Configuration (`packages/cli/tsup.config.ts`):**
  ```typescript
  import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    dts: true,
    clean: true,
    sourcemap: true,
    outExtension() {
      return { js: '.js' };
    },
  });
  ```
- **Expected Artifacts on Disk:** `dist/index.js`, `dist/index.js.map`, `dist/index.d.ts`.

---

### 7.4 `packages/test-utils` (`@notifykit/test-utils`)
- **Manifest (`packages/test-utils/package.json`):**
  ```json
  {
    "name": "@notifykit/test-utils",
    "version": "0.0.1",
    "type": "module",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "scripts": {
      "build": "tsup",
      "test": "vitest run",
      "typecheck": "tsc --noEmit"
    },
    "files": ["dist"],
    "engines": { "node": ">=20.0.0" }
  }
  ```
- **Build Configuration (`packages/test-utils/tsup.config.ts`):**
  ```typescript
  import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    outExtension() {
      return { js: '.js' };
    },
  });
  ```
- **Expected Artifacts on Disk:** `dist/index.js`, `dist/index.d.ts`.

---

## 8. Vitest Behavior & Test Discovery Across All Workspaces

By default, Vitest fails with exit code 1 if a workspace contains no matching test files (`No test files found`). Because `npm test --workspaces` executes `vitest run` in `core`, `cli`, and `test-utils`, the test pipeline must deterministically succeed in every workspace.

### 8.1 Required Phase 0 Smoke Tests
To ensure test discovery succeeds and validates the temporary tooling fixtures, every package includes a minimum smoke test:

1. **`packages/core/tests/index.test.ts`:**
   Tests the baseline `hello()` tooling fixture and the subpath interface type:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { hello } from '../src/index';
   import type { BaseEvent } from '../src/interfaces/index';

   describe('core tooling smoke test', () => {
     it('validates hello fixture', () => {
       expect(hello()).toBe('world');
     });
     it('validates interface fixture type', () => {
       const event: BaseEvent = { test: true };
       expect(event).toBeDefined();
     });
   });
   ```
2. **`packages/cli/tests/index.test.ts`:**
   Tests the CLI version fixture:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { cliVersion } from '../src/index';

   describe('cli tooling smoke test', () => {
     it('validates cli entry fixture', () => {
       expect(cliVersion).toBe('0.0.1');
     });
   });
   ```
3. **`packages/test-utils/tests/index.test.ts`:**
   Tests the test-utils skeleton fixture:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { isTestUtils } from '../src/index';

   describe('test-utils tooling smoke test', () => {
     it('validates test-utils skeleton fixture', () => {
       expect(isTestUtils).toBe(true);
     });
   });
   ```

### 8.2 Vitest Configuration & Strict Test Discovery Enforcement
In each workspace's `vitest.config.ts`, `test.passWithNoTests: false` is strictly enforced (matching Vitest default behavior):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false, // Guarantees npm test fails if zero tests are discovered in any workspace
    // ...
  },
});
```
- **Strict Anti-Silent-Pass Guarantee:** Setting `passWithNoTests: false` guarantees that the full-workspace test command (`npm test --workspaces`) **cannot silently pass** if a workspace contains no discovered tests (e.g., if a test file is missing, misnamed, or omitted).
- **Affirmative Verification Requirement:** Because each package includes an affirmative smoke test (`packages/core/tests/index.test.ts`, `packages/cli/tests/index.test.ts`, and `packages/test-utils/tests/index.test.ts`), test discovery will succeed in all three packages. If any smoke test is absent or fails to match the discovery pattern, the command exits with a non-zero code.
- **Reporting Rule:** No tests are reported as passing during planning. Test results will be proven solely through actual terminal execution logs during Phase 0 implementation.

---

## 9. Temporary Fixture Catalog & Lifecycle

| Fixture File | Content | Purpose | Lifecycle & Milestone |
| :--- | :--- | :--- | :--- |
| `packages/core/src/index.ts` | `export const hello = (): string => 'world';` | Tooling verification | **Temporary.** Replaced in **Phase 4** (`PHASES.md §10`) by production `createNotifier()` API. |
| `packages/core/src/interfaces/index.ts` | `export type BaseEvent = Record<string, unknown>;` | Subpath export verification | **Temporary placeholder.** Replaced in **Phase 1** (`PHASES.md §7`) by formal provider interfaces (`EmailProvider`, etc.). |
| `packages/cli/src/index.ts` | `export const cliVersion = '0.0.1';` | Binary packaging verification | **Temporary skeleton.** Replaced in **Phase 10** (`PHASES.md §16`) by interactive setup wizard. |
| `packages/test-utils/src/index.ts` | `export const isTestUtils = true;` | Workspace linkage verification | **Temporary skeleton.** Replaced in **Phase 11** (`PHASES.md §17`) by provider contract suite. |

---

## 10. Coverage Scope & Enforcement

### 10.1 Prescribed Thresholds (from Section 4: `AGENTS.md v1.0 §7.1`)
- **`notifykit` (Core):** Line ≥85%, Branch ≥80%, Function ≥85%, Statements aligned to 85%.
- **`notifykit-cli`:** Line ≥70%, Branch ≥65%, Function ≥70%, Statements aligned to 70%.
- **`@notifykit/test-utils`:** No prescribed threshold in Section 4 (`AGENTS.md §7.1`).

### 10.2 Configuration & Rules
- **Configuration:** Defined in `packages/core/vitest.config.ts` and `packages/cli/vitest.config.ts` under `test.coverage.thresholds`.
- **Inclusion / Exclusion:**
  - Includes: `src/**/*.ts` with `coverage.all: true` (untested files penalize coverage).
  - Excludes: `**/*.test.ts`, `dist/**`, `node_modules/**`, `**/*.d.ts`.
- **Passing Rule:** Coverage will be evaluated during implementation using `npm run test:coverage`. Passing status will be established only through actual terminal test output.

---

## 11. Size-Limit Configuration

Enforces Section 1 (PRD §4.1) and Section 2 (Architecture §15.4) budget (Core ≤ 60 KB).

- **Root Configuration (`.size-limit.json`):**
  Targets the exact planned ESM build artifact:
  ```json
  [
    {
      "name": "notifykit (core)",
      "path": "packages/core/dist/index.js",
      "limit": "60 KB"
    }
  ]
  ```
- **Execution:** Run via `npm run size-limit` following `npm run build`.

---

## 12. Official Definition of Done & Supplementary Validation

### 12.1 Official Phase 0 Definition of Done
Adapted from `Docs/NOTIFYKIT-MASTER-SPECIFICATION.md Section 3 (PHASES.md v1.0 §6, lines 2586–2592)` to reflect the human-approved `npm` decision:

```markdown
**Definition of Done:**
- [ ] `npm run build` succeeds across all workspaces
- [ ] `npm test` succeeds across all workspaces
- [ ] `npm run lint` succeeds with zero errors
- [ ] CI is green on GitHub Actions
- [ ] A trivial `export const hello = () => 'world'` in core builds, tests, and lints correctly
```

### 12.2 Release Gate 1 → 2 Criteria (Section 3: `PHASES.md §23`, line 3342)
- **Gate 1 → 2 (Foundation → Interfaces):** Monorepo builds, CI green, no lint errors.

### 12.3 Supplementary Validation Checklist
Internal quality safeguards under Section 4 (`AGENTS.md`):
1. **Typechecking:** `npm run typecheck` exits with code 0 across all workspaces.
2. **Coverage Enforcement:** `npm run test:coverage` proves thresholds met for Core and CLI.
3. **Bundle Budget:** `npm run size-limit` confirms `packages/core/dist/index.js` ≤ 60 KB.
4. **Export Integrity Check:** Verification script confirms all 6 declared core export targets physically exist in `dist/`.
5. **Formatting:** `npm run format:check` passes cleanly.

---

## 13. Deferred Addendum Part D Tasks Register

In accordance with **Human Decision B**, the following 5 tasks are deferred from Phase 0:

| ID | Task Description | Planned Milestone | Rationale for Deferral |
| :--- | :--- | :--- | :--- |
| **DEF-01** | Create `docs/openapi.yaml` placeholder | Phase 15 (v1.1) | Core library v1.0 is stateless with no HTTP endpoints (ADR-011). |
| **DEF-02** | Add `spectral` CLI configuration | Phase 15 (v1.1) | No OpenAPI spec exists in v1.0. |
| **DEF-03** | Add `openapi-diff` CI integration | Phase 15 (v1.1) | Breaking change detection is relevant only when HTTP routes exist. |
| **DEF-04** | Add Redis 7 via `docker-compose.yml` | Phase 3 (Queue) | BullMQ producer is implemented in Phase 3. Redis is not needed in Phase 0. |
| **DEF-05** | Add root `.env.example` template | Phase 1 (Config) | Config schema and Zod validation are built in Phase 1. |

---

## 14. CI Verification, Execution Sequencing & Human Ownership

To maintain strict boundaries, the implementation and verification sequence is divided into local pre-validation (executable without Git) and remote CI verification (requiring human Git actions):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGE 1: LOCAL IMPLEMENTATION & PRE-VALIDATION       │
│                   (Can be fully executed without Git or GitHub)        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Antigravity generates monorepo files, manifests, and tooling.       │
│ 2. Run: npm install (installs approved devDependencies).               │
│ 3. Run: npm run lint (verifies 0 ESLint errors).                       │
│ 4. Run: npm run typecheck (verifies 0 TypeScript errors).              │
│ 5. Run: npm test (verifies Vitest test discovery & smoke tests pass).   │
│ 6. Run: npm run test:coverage (verifies Core ≥85% & CLI ≥70%).         │
│ 7. Run: npm run build (verifies tsup builds all packages).             │
│ 8. Run: Export integrity check (verifies 6 core export targets exist). │
│ 9. Run: npm run size-limit (verifies core bundle ≤ 60 KB).             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Local pre-validation 100% complete
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGE 2: HUMAN-OWNED GIT & REMOTE ACTIONS            │
│                   (Executed ONLY by Human Owner upon approval)         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Human runs: git init -b main (in /home/sadik-khan/.../Notifykit).   │
│ 2. Human creates empty remote repository on GitHub.                    │
│ 3. Human connects remote: git remote add origin <url>.                 │
│ 4. Human stages local files: git add .                                 │
│ 5. Human commits: git commit -m "chore: initialize phase 0 tooling".   │
│ 6. Human pushes: git push -u origin main.                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Remote webhook triggers GitHub Actions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGE 3: REMOTE CI GATING & PHASE 0 EXIT             │
├────────────────────────────────────────────────────────────────────────┤
│ 1. GitHub Actions executes .github/workflows/ci.yml on Node 20, 22, 24.│
│ 2. Human inspects GitHub Actions tab and confirms green run.           │
│ 3. Definition of Done line 4 ("CI is green") is marked complete.       │
│ 4. Release Gate 1 → 2 passes; Phase 0 officially complete.             │
└────────────────────────────────────────────────────────────────────────┘
```

*Note:* The human owner is **not required** to perform any Git setup merely to review this plan. Git operations are only required during Stage 2 after implementation is authorized and completed.

---

## 15. Investigation of Plan Files in the Repository

An inspection of the workspace was conducted to resolve the question regarding duplicate plan files:

1. **Workspace Directory (`/home/sadik-khan/SadikWork/Projects/Notifykit`):**
   - Contains only one plan file: [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md).
   - There is **no** `phase_0_plan.md` in the user's workspace root or inside `Docs/`.
2. **IDE Brain Artifact Directory (`~/.gemini/antigravity-ide/brain/...`):**
   - The file named `phase_0_plan.md` exists exclusively in the IDE's internal application data folder (`~/.gemini/antigravity-ide/brain/6aa81c26-61d3-4c52-9e62-5d93e7df4299/phase_0_plan.md`), created automatically as an interactive IDE artifact for UI viewing.
3. **Canonical Status:**
   - [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md) is the **sole canonical plan document** for the NotifyKit project.
   - No project files were deleted, moved, or renamed.

---

## 16. Explicit Confirmation of Non-Modification

- **Zero Project Code Implemented:** No packages, source modules, or configuration files have been scaffolded.
- **Specification Integrity Preserved:** [`Docs/NOTIFYKIT-MASTER-SPECIFICATION.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/NOTIFYKIT-MASTER-SPECIFICATION.md) remains 100% untouched.
- **Zero Git Operations:** Antigravity has not executed any Git commands.
- **Plan File Updated:** This document [`Docs/PHASE-0-PLAN.md`](file:///home/sadik-khan/SadikWork/Projects/Notifykit/Docs/PHASE-0-PLAN.md) is the only file modified.

---

## Status

**Awaiting human review and explicit authorization.**
