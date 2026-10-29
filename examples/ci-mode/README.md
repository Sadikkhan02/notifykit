# NotifyKit CI Mode Example

This example demonstrates automated non-interactive CLI setup and deterministic mock notification execution suitable for automated testing and CI/CD pipelines.

---

## What This Example Demonstrates

1. **Non-Interactive Setup Wizard:** Running `npx notifykit init` in automated mode with `--yes`, `--dry-run`, and configuration flags.
2. **Deterministic Mock Providers:** Using `@notifykit/test-utils` mock adapters (`createMockEmailProvider`, `createMockSmsProvider`) to verify delivery without external network access or real credentials.
3. **Offline Resilience:** Safe handling of offline/sandbox test environments.
4. **Zero Secrets in CI:** Eliminates the need to inject production tokens or credentials into CI pipelines.

---

## Setup & Running

### 1. Run the Non-Interactive Setup Script

```bash
bash run-ci.sh
```

### 2. Run the Deterministic Mock Suite

```bash
npx tsx index.ts
```
