# Contributing to NotifyKit

Thank you for contributing to NotifyKit!

## Code Style & Conventions

- **TypeScript Strictness:** Strict mode is always enabled (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`). Avoid `any`; use `unknown` with narrowing.
- **Imports:** Group external imports, internal imports, and relative imports. Circular dependencies (`import/no-cycle`) are prohibited.
- **Logging:** Use the shared logger; `console.log` is strictly forbidden in runtime code (`no-console`).
- **Commit Messages:** Follow Conventional Commits format:
  - `feat(core): ...`
  - `fix(queue): ...`
  - `test(config): ...`
  - `chore(repo): ...`

## Verification Before Submitting PRs

Run the compound verification check before opening a PR:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
