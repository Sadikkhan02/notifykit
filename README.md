# NotifyKit

> Code-first, stateless notification orchestration library for Node.js and TypeScript.

## Architecture & Monorepo Layout

NotifyKit is organized as a modular npm workspaces monorepo:

- `packages/core` (`notifykit`): Core library offering a single unified `notify()` API.
- `packages/cli` (`notifykit-cli`): Interactive setup wizard (`npx notifykit init`).
- `packages/test-utils` (`@notifykit/test-utils`): Internal test utilities and contract test suite.

## Development Setup

```bash
# Install dependencies
npm install

# Run typecheck across all packages
npm run typecheck

# Run linter
npm run lint

# Run unit tests across all packages
npm test

# Run coverage report
npm run test:coverage

# Build all packages
npm run build

# Verify bundle size budget
npm run size-limit
```

## License

[MIT](LICENSE)
