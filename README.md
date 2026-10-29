# NotifyKit

> Code-first, stateless notification orchestration library for Node.js and TypeScript.

[![CI Status](https://github.com/Sadikkhan02/notifykit/workflows/CI/badge.svg)](https://github.com/Sadikkhan02/notifykit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](tsconfig.base.json)

NotifyKit is a developer-centric, multi-channel notification engine. It provides a single unified `notify()` API that fail-fast pre-renders templates in memory, buffers jobs into Redis queues via BullMQ, and delivers across **Email**, **SMS**, and **Push** channels with durable exponential retries, automatic error classification, and Dead-Letter Queue (DLQ) protection.

---

## Key Features

- **Unified Multi-Channel API:** Send Email, SMS, and Push notifications through a single method call.
- **Fail-Fast In-Memory Pre-Rendering (ADR-004):** Templates render _before_ queueing, catching syntax errors or missing variables in `< 2ms` before contacting Redis.
- **Zero Database Requirement:** 100% stateless. Requires no PostgreSQL, MongoDB, or MySQL. Redis handles queue durability and backpressure.
- **Pluggable Adapter Architecture:** First-class adapters for Nodemailer (SMTP), Twilio, MSG91, and Firebase Cloud Messaging (FCM).
- **Enterprise Resilience:** Automatic retries for transient glitches (exponential backoff with jitter) and instant DLQ routing for unrecoverable errors.
- **Interactive CLI Setup:** Get up and running in minutes with `npx notifykit init`.
- **End-to-End Tracing:** Automatic UUIDv7 trace ID propagation and PII/credential redaction in structured Pino logs.

---

## 10-Line Quick Start

```bash
npm install notifykit @notifykit/adapter-nodemailer nodemailer
```

```typescript
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

// 1. Initialize orchestrator with provider adapter
const notifier = createNotifier({
  providers: {
    email: {
      type: 'nodemailer',
      adapter: new NodemailerEmailProvider({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: 587,
        auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
      }),
      from: 'noreply@yourdomain.com',
    },
  },
});

// 2. Register template
notifier.registerTemplate('welcome', '<h1>Hello {{name}}! Welcome to NotifyKit.</h1>');

// 3. Enqueue notification (returns immediately with jobId)
const { jobId } = await notifier.notify({
  to: { email: 'user@example.com' },
  channels: ['email'],
  template: 'welcome',
  data: { name: 'Alex' },
});

// 4. Start background worker
notifier.startWorker({ channels: ['email'] });
```

---

## Supported Channels & Adapter Matrix

| Channel   | Adapter Package                                                | Backing Provider                               | Peer Dependencies       | Contract Suite |
| :-------- | :------------------------------------------------------------- | :--------------------------------------------- | :---------------------- | :------------: |
| **Email** | [`@notifykit/adapter-nodemailer`](packages/adapter-nodemailer) | Universal SMTP, SES, Gmail, Mailtrap, SendGrid | `nodemailer`            |    Verified    |
| **SMS**   | [`@notifykit/adapter-twilio`](packages/adapter-twilio)         | Twilio Messaging API (Global, 10DLC)           | `twilio`                |    Verified    |
| **SMS**   | [`@notifykit/adapter-msg91`](packages/adapter-msg91)           | MSG91 Flow API (India DLT Compliant)           | _None_ (Native `fetch`) |    Verified    |
| **Push**  | [`@notifykit/adapter-fcm`](packages/adapter-fcm)               | Firebase Cloud Messaging (Android, iOS, Web)   | `firebase-admin`        |    Verified    |

All adapters conform to the universal adapter contracts verified by [`@notifykit/test-utils`](packages/test-utils).

---

## Performance & Verified Benchmarks

NotifyKit is engineered for sub-millisecond in-memory template compilation and high-throughput Redis stream ingestion. Measured via `npm run benchmark` (`benchmarks/load-test.ts`) across 1,000 notifications:

| Benchmark Metric                   | Specification Target | Measured Result |  Status  |
| :--------------------------------- | :------------------- | :-------------- | :------: |
| **`notify()` Enqueue p50 Latency** | —                    | **1.11 ms**     | Observed |
| **`notify()` Enqueue p95 Latency** | —                    | **1.93 ms**     | Observed |
| **`notify()` Enqueue p99 Latency** | `< 10.0 ms`          | **2.37 ms**     | **PASS** |
| **Enqueue Throughput**             | —                    | **845.9 msg/s** | Observed |
| **Worker Processing Throughput**   | `>= 50.0 msg/s`      | **710.7 msg/s** | **PASS** |
| **Heap Memory Overhead**           | —                    | **+20.55 MB**   |  Stable  |

_(Tested on Node.js v24.21.0, Linux x64, 8 vCPUs with Redis 7-alpine container)._

> **Redis Topology Notice:** NotifyKit supports standalone Redis, Redis Sentinel, and managed single-cluster instances (AWS ElastiCache, GCP Memorystore). Standalone multi-node Redis Cluster mode is currently not supported due to cross-slot Lua script requirements. See [Architecture Guide](docs/architecture.md#8-redis-topology--standalone-cluster-limitation).

---

## Interactive Setup Wizard (`notifykit-cli`)

Initialize NotifyKit in any project with one command:

```bash
npx notifykit init
```

The interactive wizard configures channels, captures provider credentials with masked inputs, checks Redis connectivity, safely writes `.env` and `.env.example`, and installs only the necessary adapters.

For automated Docker builds and CI/CD pipelines, use non-interactive mode:

```bash
npx notifykit init --channels=email --email=nodemailer --smtp-host=smtp.mailtrap.io --yes
```

> See the full CLI documentation in [`packages/cli/README.md`](packages/cli/README.md).

---

## Documentation Index

Explore our comprehensive documentation:

- **[Getting Started Tutorial](docs/getting-started.md):** Complete walkthrough from installation to production delivery.
- **[Architecture & Design](docs/architecture.md):** System architecture, lifecycle stages, retry backoff, and DLQ mechanics.
- **[Provider Configuration Guide](docs/providers.md):** Exhaustive setup, credentials, and regulatory requirements (10DLC, DLT).
- **[Troubleshooting & Operations](docs/troubleshooting.md):** Diagnostic recipes for Redis, SMTP, SMS, FCM, and DLQ errors.
- **[Authoring Custom Adapters](docs/adapters.md):** Guide to creating custom provider adapters with `@notifykit/test-utils`.
- **[Redis Data Model](docs/redis.md):** Complete reference of Redis key layouts, namespaces, and retention policies.

---

## Runnable Examples

Inspect or run the self-contained examples in [`examples/`](examples/):

- **[`examples/email-only/`](examples/email-only/):** Standalone email delivery using Nodemailer and worker lifecycle.
- **[`examples/sms-only/`](examples/sms-only/):** SMS delivery supporting both Twilio and MSG91 with E.164 formatting.
- **[`examples/both-channels/`](examples/both-channels/):** Multi-channel dispatch (Email, SMS, Push) with concurrency and signal traps.
- **[`examples/ci-mode/`](examples/ci-mode/):** Deterministic mock delivery and non-interactive setup for CI environments.

---

## Monorepo Development

To contribute or build NotifyKit locally:

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Run typecheck across all workspaces
npm run typecheck

# 4. Run linter
npm run lint

# 5. Run test suite (480+ unit and contract tests)
npm test

# 6. Run test coverage
npm run test:coverage

# 7. Verify bundle size budgets
npm run size-limit
```

---

## License

[MIT](LICENSE)
