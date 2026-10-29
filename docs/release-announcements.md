# NotifyKit v1.0.0 — Release Notes & Launch Announcements

> [!IMPORTANT]
> **Pre-Launch Notice**: These announcements and release notes are prepared drafts for human publication. Do NOT publish, post, or distribute them until beta verification and explicit approval are completed.

---

## 1. GitHub Release Notes (Draft for v1.0.0)

**Release Title:** `NotifyKit v1.0.0: The Enterprise-Ready Transactional Notification Engine for Node.js`  
**Target Tag:** `v1.0.0`  
**Git Branch:** `main`

### Overview

NotifyKit is an open-source, production-grade notification delivery engine designed for Node.js backends. It provides unified, multi-channel dispatch (Email, SMS, Push) over an asynchronous Redis BullMQ queue, complete with exponential backoff retries, dead letter queue (DLQ) isolation, and enterprise-grade security.

### What's Included

- **Core Dispatch Engine (`notifykit`)**:
  - Asynchronous background queue backed by Redis BullMQ
  - Multi-channel routing: Email, SMS, Push
  - Idempotent delivery tracking
  - Configurable exponential backoff retries and Dead Letter Queue (DLQ)
  - Automatic template rendering using Handlebars
  - Strict sensitive credential redaction (`[REDACTED]`) up to 5 levels deep
  - High-performance throughput (>700 msg/s, p99 latency <2.5 ms)

- **Provider Adapters**:
  - `@notifykit/adapter-nodemailer`: Production SMTP transport with TLS and attachments
  - `@notifykit/adapter-twilio`: Twilio REST API SMS with Messaging Service SID
  - `@notifykit/adapter-msg91`: MSG91 Flow API SMS adapter with DLT compliance
  - `@notifykit/adapter-fcm`: Firebase Cloud Messaging push via Firebase Admin SDK

- **CLI Setup Wizard (`notifykit-cli` / `npx notifykit init`)**:
  - Zero-config interactive setup wizard
  - Headless/CI automation flags
  - Automatic package installation and `.env` generation

- **Testing Suite (`@notifykit/test-utils`)**:
  - Contract compliance test suite (`runAdapterContractTests`)
  - Deterministic in-memory mock providers for Email, SMS, and Push

### Quickstart

```bash
npm install notifykit
npx notifykit init
```

### Tarball Integrity & Checksum Verification

To generate and verify reproducible SHA-256 checksums for the published release packages:

```bash
# In the repository root after building:
for pkg in core cli test-utils adapter-nodemailer adapter-twilio adapter-msg91 adapter-fcm; do
  tarball=$(npm pack --workspace=packages/$pkg --pack-destination=/tmp)
  sha256sum "/tmp/$tarball"
done
```

---

## 2. Human Publication Instructions

### A. Publishing Beta Packages (Terminal Workflow)

Run from an authenticated local terminal with npm 2FA, strictly adhering to the topological dependency order (publishing `notifykit-cli` before `notifykit` to ensure core's dependency can resolve on npm):

```bash
# 1. Ensure clean build & test validation
npm run build
npm test

# 2. Publish all packages under the 'beta' tag in topological order:
# 2a. CLI (leaf dependency for core binary delegation)
npm publish --workspace=packages/cli --tag beta --access public

# 2b. Core engine (depends on notifykit-cli)
npm publish --workspace=packages/core --tag beta --access public

# 2c. Test utilities (peer-depends on notifykit)
npm publish --workspace=packages/test-utils --tag beta --access public

# 2d. Provider adapters (peer-depend on notifykit)
npm publish --workspace=packages/adapter-nodemailer --tag beta --access public
npm publish --workspace=packages/adapter-twilio --tag beta --access public
npm publish --workspace=packages/adapter-msg91 --tag beta --access public
npm publish --workspace=packages/adapter-fcm --tag beta --access public
```

### B. Beta Verification Window (15–30 Minutes)

In a clean directory completely outside the monorepo workspace (to guarantee all packages install directly from the public npm registry rather than local workspace links or tarballs):

```bash
mkdir /tmp/notifykit-beta-verify && cd /tmp/notifykit-beta-verify
npm init -y

# Install core and CLI beta versions from npm registry
npm install notifykit-cli@beta notifykit@beta

# Verify binary and setup wizard
npx notifykit --version
npx notifykit --help
npx notifykit init --yes --dry-run --skip-install --channels=email --email=nodemailer --smtp-host=smtp.test.com --smtp-port=587 --smtp-user=test --smtp-password=pass

# Install official adapters and test utilities from npm registry
npm install @notifykit/adapter-nodemailer@beta @notifykit/adapter-twilio@beta @notifykit/adapter-msg91@beta @notifykit/adapter-fcm@beta @notifykit/test-utils@beta

# Confirm no workspace symlinks exist
npm ls --depth=0
```

Verify:
1. `node -e "import('notifykit').then(m => console.log('Loaded core:', typeof m.createNotifier))"`
2. Verify adapter imports and contract compliance.
3. Run each example in `examples/` against beta versions.

### C. Promoting to `latest` (Explicit Human Approval Required)

Only after the 15–30 minute beta window passes with zero errors:

```bash
# Promote in topological order:
npm dist-tag add notifykit-cli@1.0.0 latest
npm dist-tag add notifykit@1.0.0 latest
npm dist-tag add @notifykit/test-utils@1.0.0 latest
npm dist-tag add @notifykit/adapter-nodemailer@1.0.0 latest
npm dist-tag add @notifykit/adapter-twilio@1.0.0 latest
npm dist-tag add @notifykit/adapter-msg91@1.0.0 latest
npm dist-tag add @notifykit/adapter-fcm@1.0.0 latest
```

### D. Creating Git Release Tag

After human verification:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 -F docs/release-notes-v1.0.0.md --title "NotifyKit v1.0.0"
```

---

## 3. Public Announcement Drafts

### A. Hacker News (Show HN)

**Title:** Show HN: NotifyKit – Open-source transactional notifications engine for Node.js

**URL / Text:**
```markdown
Hey HN!

We're launching NotifyKit v1.0.0, an open-source, MIT-licensed transactional notification engine for Node.js.

Most developers start transactional alerts by dropping a one-off nodemailer or twilio call directly inside an HTTP handler. When traffic spikes or third-party APIs experience downtime, requests fail, latency explodes, and users end up receiving duplicate messages.

We built NotifyKit to provide a standardized, enterprise-ready delivery pipeline:
- Asynchronous BullMQ background worker backed by Redis
- Multi-channel routing: Email (Nodemailer/SMTP), SMS (Twilio, MSG91), Push (FCM)
- Built-in exponential backoff retries with dead-letter queue (DLQ) isolation
- Deterministic idempotency tracking
- Zero secret leakage: automatic 5-level deep credential redaction in logs
- Fast: 700+ msg/sec worker throughput, p99 dispatch latency < 2.5ms
- Single-command setup wizard: `npm install notifykit && npx notifykit init`

GitHub: https://github.com/Sadikkhan02/notifykit
Docs & Quickstart: https://github.com/Sadikkhan02/notifykit#readme

We'd love your feedback on the architecture and adapter contract design!
```

---

### B. Reddit (r/node)

**Title:** NotifyKit v1.0.0: An open-source, Redis-backed transactional notification engine for Node.js

**Post Body:**
```markdown
Hi r/node,

Today we're releasing **NotifyKit v1.0.0**, an open-source framework designed to solve transactional notification dispatch (Email, SMS, Push) in Node.js applications.

### The Problem
Calling vendor SDKs directly in express/fastify route handlers creates tight coupling, blocks request cycles, and causes lost or duplicated notifications during network glitches or provider outages.

### What NotifyKit does:
1. **Queued Architecture**: Queues messages via BullMQ and Redis with worker concurrency.
2. **Provider Agnostic**: Swappable adapters for Nodemailer (SMTP), Twilio (SMS), MSG91 (SMS), and FCM (Push).
3. **Fault Tolerance**: Automatic exponential retries, DLQ for poison pills, and Redis-backed idempotency.
4. **Security by Default**: PII masking in queues and multi-level credential redaction in Pino logs.
5. **Interactive Setup Wizard**: `npx notifykit init` configures channels, generates `.env`, and installs required adapters automatically.

### Quick Example:
```ts
import { createNotifier } from 'notifykit';
import { NodemailerEmailProvider } from '@notifykit/adapter-nodemailer';

const notifier = createNotifier({
  email: new NodemailerEmailProvider({
    host: 'smtp.example.com',
    port: 587,
    auth: { user: 'user', pass: 'secret' },
  }),
});

await notifier.notify({
  channel: 'email',
  recipient: 'user@example.com',
  template: 'welcome',
  data: { name: 'Alice' },
});
```

Check it out on GitHub: https://github.com/Sadikkhan02/notifykit  
Feedback, PRs, and suggestions are welcome!
```

---

### C. Twitter/X Launch Thread

```text
🧵 1/6
Today we're open-sourcing NotifyKit v1.0.0 🚀

The unified, enterprise-ready transactional notification delivery engine for Node.js.

Handle Email, SMS, and Push notifications with Redis queueing, retries, and zero secret leakage.

GitHub: https://github.com/Sadikkhan02/notifykit 👇

2/6
Why NotifyKit?
Directly calling provider SDKs inside API routes leads to timeouts, lost messages, and duplicate delivery.
NotifyKit provides an asynchronous, BullMQ-backed queue that delivers p99 latency < 2.5ms and 700+ msg/sec throughput.

3/6
📦 Modular Adapter Ecosystem:
✉️ Email: @notifykit/adapter-nodemailer
📱 SMS: @notifykit/adapter-twilio & @notifykit/adapter-msg91
🔔 Push: @notifykit/adapter-fcm
🧪 Test utilities: @notifykit/test-utils

4/6
🔒 Security First:
- Deep recursive credential redaction ([REDACTED])
- PII-safe queue payloads
- Actionable error diagnostics on every failure

5/6
⚡️ Setup in 30 seconds:
$ npm install notifykit
$ npx notifykit init

The interactive wizard configures channels, sets up .env, and installs adapters automatically.

6/6
NotifyKit is 100% open-source under MIT.
Star us on GitHub: https://github.com/Sadikkhan02/notifykit
Docs & Examples: https://github.com/Sadikkhan02/notifykit/tree/main/examples
```

---

### D. dev.to Article

**Title:** Introducing NotifyKit: A Production-Ready Transactional Notification Framework for Node.js

**Cover Tag:** `#nodejs #javascript #webdev #opensource`

**Article Body:**
```markdown
# Introducing NotifyKit: A Production-Ready Transactional Notification Framework for Node.js

Every backend project eventually needs to send transactional notifications: password resets, verification codes, invoice emails, or push alerts.

Too often, this starts as a raw `nodemailer.sendMail()` call in a controller. As the application grows, edge cases emerge:
- What happens when SMTP rate limits you?
- How do you prevent duplicate SMS sends during HTTP retries?
- How do you isolate poison pills without blocking the queue?

Today, we are releasing **NotifyKit v1.0.0**, an open-source, MIT-licensed framework to handle notification pipelines with enterprise rigor.

## Key Features
- **Queue-Backed Dispatch**: Powered by BullMQ and Redis.
- **Provider Adapters**: Swap Nodemailer, Twilio, MSG91, or FCM without rewriting business logic.
- **Resilience**: Configurable exponential backoff, dead letter queue (DLQ), and idempotency keys.
- **Zero Configuration Setup**: `npm install notifykit && npx notifykit init`.

Get started today: https://github.com/Sadikkhan02/notifykit
```

---

## 4. Post-Launch Operations

### A. Issue Triage Routine (First 7 Days)
1. **Triage SLA**: Acknowledge bug reports and questions within 4 hours.
2. **Issue Labels**:
   - `bug`: Reproducible flaw; create patch branch immediately.
   - `adapter`: Issue specific to a third-party SDK (Twilio, FCM, etc.).
   - `docs`: Clarification needed in `README.md` or `docs/`.
   - `question`: Redirect to Discussions if non-actionable.
3. **Emergency Patch Policy**: If a blocker or crash is reported, ship a `1.0.1` patch within 24 hours.

### B. 48-Hour Metrics Monitoring Checklist
- [ ] Monitor npm registry downloads via `npm-stat.com` or npm CLI.
- [ ] Target: 10+ installations within first 48 hours.
- [ ] Review GitHub traffic (unique cloners and visitors) in Insights.
- [ ] Monitor Redis load and memory under representative workloads.
- [ ] Track GitHub Star velocity and new issues/discussions.
