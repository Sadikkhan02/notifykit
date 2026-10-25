# NotifyKit — Master Specification

**Master document version:** 1.0  
**Prepared:** October 2026  
**Purpose:** A single Markdown file containing all NotifyKit documentation supplied so far, including the consolidated Architecture v1.1 and the complete original source documents.

## How to use this master file

- **Product requirements:** Section 1 (`PRD.md` v1.0).
- **Current consolidated architecture draft:** Section 2 (`ARCHITECTURE-v1.1.md`).
- **Build sequence, tasks, dependencies, and release gates:** Section 3 (`PHASES.md` v1.0).
- **Mandatory AI-agent workflow and coding rules:** Section 4 (`AGENTS.md` v1.0).
- **Verbatim source preservation:** Sections 5 and 6 retain the original Architecture v1.0 and Architecture Addendum v1.0 for traceability. They intentionally repeat material incorporated into Section 2.

### Important document-governance note

This master file is a **documentation bundle**, not an assertion that every cross-document conflict has been resolved. The consolidated Architecture v1.1 flags the known Redis namespace and idempotency-scope conflicts for human review. The addendum's proposed task and release-gate changes to `PHASES.md` are retained in Section 6, Part D, but are not silently merged into the original phase checklist in Section 3. Review and approve those changes before implementation. The source files themselves remain unchanged.

## Master table of contents

1. [Product Requirements Document (PRD) v1.0](#section-1-product-requirements-document-prd-v10)
2. [Consolidated System Architecture Document v1.1](#section-2-consolidated-system-architecture-document-v11)
3. [Implementation Phases & Build Flow v1.0](#section-3-implementation-phases--build-flow-v10)
4. [AI Development Rules (AGENTS.md) v1.0](#section-4-ai-development-rules-agentsmd-v10)
5. [Source Appendix A — Original System Architecture v1.0](#section-5-source-appendix-a--original-system-architecture-v10)
6. [Source Appendix B — Architecture Addendum v1.0](#section-6-source-appendix-b--architecture-addendum-v10)

---


---

# 1. Product Requirements Document (PRD) v1.0

## 📄 Product Requirements Document (PRD)

**Product Name:** NotifyKit (working title — final name TBD; check npm availability)
**Document Version:** 1.0 (Complete)
**Status:** Ready for Review
**Owner:** [Your Name]
**Last Updated:** October 2026
**Document Purpose:** A single, self-contained specification that fully explains the product to any engineer, designer, investor, or AI assistant. Anyone reading this document should understand **what** the product is, **why** it exists, **how** it works, **who** it is for, and **how** it earns money.

---

### Table of Contents

1. Executive Summary
2. Vision & Positioning
3. Problem Statement
4. Goals & Non-Goals
5. Target Users & Personas
6. Market Analysis
7. Competitive Landscape
8. Product Overview (What It Is / What It Is Not)
9. System Architecture
10. Core Library Specification
11. CLI Setup Wizard Specification
12. Provider Catalog (v1)
13. Licensing & Ownership Model
14. Monetization Model (Open-Core)
15. Security & Compliance
16. Success Metrics
17. Roadmap & Milestones
18. Risks & Mitigations
19. Open Questions
20. Appendix (Glossary & Example Code)

---

### 1. Executive Summary

**NotifyKit** is a code-first, stateless notification orchestration library for Node.js and TypeScript, distributed as an npm package and paired with an interactive setup wizard.

It solves a specific gap in the developer tooling market: teams that want unified multi-channel notification logic (Email, SMS, Push) that lives **inside their own codebase** — versioned with their code, testable in CI/CD, and free of platform lock-in — but who do not want to rebuild the same orchestration boilerplate for every project.

The library exposes a single `notify()` API, backed by a BullMQ job queue that uses the developer's own Redis instance for reliable, retry-backed delivery. The setup wizard (`npx notifykit init`) guides the developer through channel and provider selection, writes their `.env` file, and installs **only the SDKs they actually need**.

**Core differentiator:** A guided, interactive onboarding experience that no current competitor emphasizes, with a specific wedge for the Indian market (Twilio vs. MSG91 cost and DLT compliance guidance).

**Business model:** The core library and wizard are open source (MIT) and free, distributed at zero cost to the creator via npm. Revenue is generated through an open-core model: premium wizard features, enterprise support, and an optional hosted control plane.

---

### 2. Vision & Positioning

#### 2.1 Vision Statement

> "Notification logic should live in the developer's codebase — not in someone else's dashboard — and setting it up should take five minutes, not five days."

#### 2.2 Positioning Statement

| Attribute | NotifyKit Position |
| :--- | :--- |
| **Category** | Developer infrastructure — notification orchestration library |
| **Form factor** | npm package (library), like Express.js — not a hosted service |
| **Deployment** | Runs inside the user's own Node.js process |
| **Infrastructure cost to creator** | $0 (npm hosts the package for free) |
| **Infrastructure cost to user** | Their own Redis + their own provider accounts (Twilio, SMTP, FCM) |
| **License** | MIT (open source core) |
| **Revenue model** | Open-core: premium wizard features + enterprise support + optional hosted control plane |

#### 2.3 The "Express.js Analogy"

The product is **exactly like Express.js in its distribution and ownership model**:

| Aspect | Express.js | NotifyKit |
| :--- | :--- | :--- |
| What it is | Library you `npm install` | Library you `npm install` |
| Where it runs | Inside the user's server process | Inside the user's server process |
| Who pays for runtime infrastructure | The user | The user |
| Cost to creator to distribute | $0 | $0 |
| Who owns the original code | The Express team (copyright holders) | You (copyright holder) |
| Can others fork it? | Yes (MIT license) | Yes (MIT license) |
| Can others claim they wrote it? | No | No |

---

### 3. Problem Statement

#### 3.1 The Developer's Dilemma

Developers building notification features face a painful trade-off between two imperfect options:

| Approach | Strength | Weakness |
| :--- | :--- | :--- |
| **Cloud platforms** (Novu Cloud, Courier, Knock) | Managed orchestration, visual workflows, delivery analytics | Logic lives in *their* dashboard — not versioned with code, not testable in CI, vendor lock-in at the architecture level |
| **Raw provider libraries** (Nodemailer, `twilio`, `firebase-admin`) | Excellent at the delivery step, full control | Solve only the *send* step. Every team rebuilds validation, templating, retries, and provider abstraction from scratch |

#### 3.2 The Missing Middle

There is no widely-adopted, lightweight package that provides **typed orchestration logic inside the codebase** with a **frictionless setup experience**.

#### 3.3 The Setup Friction Problem

Configuring notifications requires the developer to answer several questions before writing any code:

- Which provider should I use for email? SMS? Push?
- Which plan do I have, and where do I get the API keys?
- Where should the credentials go (`.env`? config file?)?
- Which SDK do I install, and how do I avoid bloating my dependencies?

Today this knowledge is scattered across provider documentation. A guided wizard collapses this into a single interactive session.

---

### 4. Goals & Non-Goals

#### 4.1 Goals (v1)

1. Ship a working core library (`notifykit`) with a single `notify()` API.
2. Ship a separate CLI wizard (`npx notifykit init`) that selects channels/providers, captures credentials, writes `.env`, and installs only the selected SDKs.
3. Support **three channels** end-to-end: Email (Nodemailer/SMTP), SMS (Twilio + MSG91), Push (FCM).
4. Guarantee reliable delivery via BullMQ + Redis (user-owned), with retries and dead-letter handling.
5. Keep the core package dependency-light — no bundled vendor SDKs.
6. Support non-interactive/CI environments via CLI flags.
7. Publish clear documentation and example projects.

#### 4.2 Non-Goals (v1)

1. A web dashboard or visual workflow builder.
2. A hosted SaaS control plane.
3. Owning any database or persistent infrastructure.
4. Building raw SMS/email/telecom infrastructure.
5. Supporting every provider (a curated list of 4–5 is sufficient).
6. A/B testing, marketing campaign management, or CRM features.
7. Chat channels (Slack, Discord, WhatsApp) — deferred to v1.x.

---

### 5. Target Users & Personas

| Persona | Description | Primary Need |
| :--- | :--- | :--- |
| **Solo full-stack dev / indie hacker** | Building a SaaS or side project in Node.js | Fast setup, no vendor lock-in, low cost |
| **Small startup team (2–10 devs)** | Needs notifications across email + SMS + push | Code-first, testable, versioned in the repo |
| **India-focused product team** | Serving Indian users, needs SMS OTP/delivery | Clear guidance on Twilio vs. MSG91, DLT compliance |
| **Platform/DevOps engineer** | Evaluating notification libraries | Lightweight footprint, no forced cloud dependency |

---

### 6. Market Analysis

| Market | Size | Growth |
| :--- | :--- | :--- |
| Notification Infrastructure Software | ~$3.6B (2025) → ~$6.3B (2031) | CAGR ~8.3% |
| Mass Notification Systems (broader) | ~$30B (2026) | CAGR ~15% |

**Interpretation:** The demand is not speculative. Notification infrastructure is a proven, high-growth category with room for multiple players. The library form factor (code-first, in-repo) is an underserved segment within this market.

---

### 7. Competitive Landscape

| Competitor | Type | Strength | Gap NotifyKit Exploits |
| :--- | :--- | :--- | :--- |
| **Novu** | Open-source platform | Full orchestration, in-app inbox component | Heavy to self-host; not a drop-in npm library |
| **Courier / Knock** | SaaS | Visual workflow builder | Platform lock-in; no code-first option |
| **`notifme-sdk`** | npm library | Fallback strategies, mature | Dated DX; no guided onboarding |
| **`@thinwrap/notifications`** | npm library | Zero-SDK, 35 providers, very lightweight | No workflow engine; no wizard |
| **`better-notify`** | npm library | Typed, channel-split packages | Manual multi-package assembly; no wizard |

**NotifyKit's position:** Lightweight orchestration + best-in-class onboarding wizard + India-market focus.

---

### 8. Product Overview (What It Is / What It Is Not)

#### 8.1 What It Is

- A **library** (`notifykit`) installed via `npm install notifykit`.
- A **CLI wizard** invoked via `npx notifykit init`.
- A **stateless orchestration engine** that runs inside the user's Node.js process.
- **Code-first**: the developer defines notification logic in their codebase, versioned with Git.
- **Pluggable**: providers are swappable through a stable adapter interface.
- **Reliable**: delivery is backed by BullMQ + the user's Redis, with retries and dead-letter queues.

#### 8.2 What It Is Not

- ❌ Not a hosted SaaS platform.
- ❌ Not a web dashboard or visual workflow builder.
- ❌ Not a database or persistence layer.
- ❌ Not a raw SMS/email/telecom infrastructure provider.
- ❌ Not a wrapper around Novu or any other notification platform.
- ❌ Does not bundle every vendor SDK — only the ones the user selects.

---

### 9. System Architecture

#### 9.1 Package Structure

```
notifykit                      → core library (small, dependency-light)
notifykit-cli                  → wizard, invoked via `npx notifykit init`
@notifykit/adapter-nodemailer  → Email via SMTP
@notifykit/adapter-twilio      → SMS via Twilio
@notifykit/adapter-msg91       → SMS via MSG91 (India focus)
@notifykit/adapter-fcm         → Push via Firebase Cloud Messaging
```

Adapters are separate packages (or optional peer dependencies) so the core stays lean.

#### 9.2 Runtime Flow

```
Developer code
      │
      ▼
notifykit.notify({...})           ← your IP (orchestration logic)
      │
      ▼
Validate event + resolve channels + render template
      │
      ▼
Enqueue BullMQ job(s)             ← user's own Redis
      │
      ▼
BullMQ Worker (runs in user's process)
      │
      ▼
Provider adapter (Nodemailer / Twilio / MSG91 / FCM)
      │
      ▼
External delivery (SMTP server / Twilio API / MSG91 API / FCM)
      │
      ▼
On success: job removed from Redis
On failure: retried with exponential backoff
After max retries: moved to dead-letter queue
```

**Key principle:** No database is owned by NotifyKit. The user's Redis provides durability only for the delivery lifetime of each job.

#### 9.3 Tech Stack

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| Runtime | Node.js 20+ | Modern LTS baseline |
| Language | TypeScript (strict) | Type safety across provider adapters |
| HTTP surface (optional) | Express.js | Familiar to target users |
| Queue | BullMQ + ioredis | Industry standard for Node.js job queues |
| Template engine | Handlebars | Simple, widely understood |
| CLI | `prompts`, `chalk`, `execa` | Standard interactive CLI tooling |
| Logging | Pino | Structured, fast, redaction support |
| Testing | Vitest + Testcontainers | Unit + integration against real Redis |
| Optional persistence (v1.1) | MongoDB (user-supplied connection string) | Deferred — not in v1 core |

---

### 10. Core Library Specification

#### 10.1 Public API

```typescript
import { createNotifier } from 'notifykit';

const notifier = createNotifier({
  redis: process.env.REDIS_URL,
  providers: {
    email: { type: 'nodemailer' },
    sms:   { type: 'twilio' },
    push:  { type: 'fcm' },
  },
});

await notifier.notify({
  to: { email: 'user@example.com', phone: '+919876543210', pushToken: 'fcm-token' },
  channels: ['email', 'sms'],
  template: 'welcome-message',
  data: { name: 'John' },
});
```

#### 10.2 Provider Interfaces (Own IP)

```typescript
export interface SmsProvider {
  readonly name: string;
  sendSms(opts: {
    to: string;
    from?: string;
    body: string;
    templateId?: string;          // e.g., MSG91 Flow ID or Twilio template SID
    variables?: Record<string, string>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface PushProvider {
  readonly name: string;
  sendPush(opts: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
```

#### 10.3 Functional Requirements

| ID | Requirement |
| :--- | :--- |
| CORE-01 | `notify()` must validate input against a typed schema and throw a clear error on invalid input. |
| CORE-02 | Jobs must be enqueued to BullMQ; `notify()` returns immediately with a job ID. |
| CORE-03 | Worker retries failed jobs with exponential backoff (configurable; default: 3 retries). |
| CORE-04 | Failed jobs after max retries must be moved to a dead-letter queue. |
| CORE-05 | Provider adapters must be swappable without touching core code. |
| CORE-06 | The core package must not statically import any vendor SDK. |
| CORE-07 | Templates must be rendered with Handlebars using the `data` payload. |
| CORE-08 | Structured logs via Pino, with a stable `jobId` correlation key. |
| CORE-09 | Full TypeScript types exported for all public APIs. |
| CORE-10 | The library must be usable with zero configuration beyond the wizard's `.env` output. |

---

### 11. CLI Setup Wizard Specification

#### 11.1 Invocation

```bash
npm install notifykit
npx notifykit init
```

#### 11.2 Interactive Flow

1. **Channel selection** (multi-select): Email, SMS, Push. *Validation: at least one required.*
2. **Provider selection per channel:**
   - Email → Nodemailer (SMTP), Resend, Amazon SES, SendGrid
   - SMS → Twilio, MSG91, Plivo, Telnyx
   - Push → Firebase Cloud Messaging
3. **Plan / credential capture** — e.g., Twilio Account SID + Auth Token; MSG91 Auth Key + Flow ID.
4. **Env file handling** — write new variables to `.env`, preserving existing entries; update `.env.example`.
5. **SDK installation** — run `npm install <sdk>` only for selected providers.
6. **Summary screen** — show what was written, what was installed, and a code snippet to start using.

#### 11.3 Non-Interactive Mode (CI/CD)

```bash
npx notifykit init --channels=sms --sms=twilio \
  --twilio-sid=... --twilio-token=... --yes
```

#### 11.4 Wizard Requirements

| ID | Requirement |
| :--- | :--- |
| CLI-01 | The wizard must **never** run via `postinstall`. It is always an explicit `init` command. |
| CLI-02 | The wizard must detect non-TTY environments and require `--yes` with all flags, or exit gracefully. |
| CLI-03 | `.env` writes must not overwrite unrelated variables. |
| CLI-04 | Only the selected provider SDKs may be installed. |
| CLI-05 | Credentials must not be logged to stdout or written to any file other than `.env`. |
| CLI-06 | The wizard must be idempotent — re-running offers to reconfigure. |
| CLI-07 | The wizard must print a clear "what to do next" summary with a code example. |

#### 11.5 Why Not `postinstall`?

npm 7+ suppressed interactive install scripts, and **npm v12 (July 2026) disabled install scripts by default** (`allowScripts` must be explicitly opted in). An interactive `postinstall` prompt would also fail in every CI/CD pipeline, Docker build, and automated deployment. The explicit `npx notifykit init` pattern respects developer agency and works everywhere.

---

### 12. Provider Catalog (v1)

| Channel | Provider | Notes |
| :--- | :--- | :--- |
| Email | Nodemailer (SMTP) | Universal; works with any SMTP server |
| Email | Resend / SES / SendGrid | Optional in v1; add if time allows |
| SMS | Twilio | Global reliability; ~$0.0083/msg US |
| SMS | MSG91 | India-focused; ~₹0.15/OTP; requires DLT registration |
| Push | Firebase Cloud Messaging | Free; only practical path for Android/iOS/web push |

**India wedge:** The wizard should include guidance on the Twilio vs. MSG91 trade-off (cost, DLT compliance) for users targeting Indian numbers.

---

### 13. Licensing & Ownership Model

#### 13.1 What You Own as the Creator

1. **Copyright** of the original source code — nobody can claim they wrote it.
2. **The npm package name** (`notifykit`) — you control that name on the registry.
3. **The GitHub repository** (under your account or organization).
4. **The right to license it** however you choose.

#### 13.2 What an MIT License Means

| Permission | Allowed? |
| :--- | :--- |
| Anyone can use it for free (personal, commercial) | ✅ Yes |
| Anyone can read the source code | ✅ Yes |
| Anyone can fork it and publish their own version | ✅ Yes (with a different package name) |
| Anyone can claim *you* didn't write the original | ❌ No |
| You can stop someone from forking | ❌ No — this is the price of open source |

**Precedent:** This is exactly how Express.js works. It is MIT-licensed, used by millions, forked occasionally — but the Express team retains authorship, the npm package name, and the community trust.

#### 13.3 Why Open Source Is the Correct Choice

- Adoption is the only path to relevance for a developer library.
- Developers do not install closed-source npm packages they cannot inspect.
- Open source does **not** mean you cannot earn money — it means the *core* is free, while the *commercial layers* generate revenue (see Section 14).

---

### 14. Monetization Model (Open-Core)

The free npm package is the **distribution engine** — it gets NotifyKit into thousands of codebases. Revenue comes from layers built on top.

| Layer | What It Is | Who Pays | Revenue Potential |
| :--- | :--- | :--- | :--- |
| **Core library** (free, MIT) | `notify()` API, provider interfaces, BullMQ integration | Nobody | $0 (drives adoption) |
| **Free CLI wizard** | Basic channel/provider selection, `.env` setup | Nobody | $0 (drives adoption) |
| **Premium wizard features** | Cost calculator (Twilio vs. MSG91 by region/volume), DLT compliance checklist, provider recommendation engine, team config sync | Developers / teams | Subscription (~$10–50/month) |
| **Enterprise support** | SLAs, guaranteed adapter maintenance, priority bug fixes | Companies | Annual contracts ($5K–50K/year) |
| **Hosted control plane** (optional, later) | Dashboard for template management and delivery analytics — sending still runs in the user's infrastructure | Teams wanting visibility | Subscription (~$29–199/month) |

**Precedent:** This is how Novu, Supabase, and Grafana Labs earn money. The core is open source; the commercial layers (cloud hosting, enterprise features, support) generate revenue.

---

### 15. Security & Compliance

| Area | Requirement |
| :--- | :--- |
| Credential storage | Only in the user's own `.env`. NotifyKit never stores credentials. |
| Telemetry | None collected in v1. |
| Logging | Pino must redact credential fields by default. |
| Browser safety | The Twilio Node.js SDK must never be used in browser contexts — documented explicitly. |
| India SMS | DLT registration is the user's responsibility; the wizard links to official docs and provides a checklist. |
| Dependency hygiene | Regular audits; adapters isolated so a compromised SDK cannot affect other channels. |

---

### 16. Success Metrics

| Metric | Target (first 6 months) |
| :--- | :--- |
| npm weekly downloads | 1,000+ |
| GitHub stars | 500+ |
| Wizard completion rate | >70% of installs |
| Issues resolved within 7 days | >80% |
| Average channels adopted per user | ≥1.5 |
| Community adapter contributions | ≥1 external adapter |

---

### 17. Roadmap & Milestones

| Phase | Deliverable |
| :--- | :--- |
| **M1** | Core library skeleton: `notify()`, provider interfaces, BullMQ producer/worker, Nodemailer adapter |
| **M2** | Twilio + MSG91 adapters |
| **M3** | CLI wizard (interactive + non-interactive modes) |
| **M4** | FCM adapter; documentation; example projects |
| **M5** | Publish to npm; launch on Show HN / r/node |
| **M6** | Optional MongoDB delivery-log adapter (v1.1) |
| **M7** | Premium wizard features (cost calculator, DLT guidance) — first commercial tier |

#### Recommended Build Order (Detailed)

1. **Core library first**: `notify()` API, provider interfaces, BullMQ integration, one working adapter (Nodemailer). Prove reliable delivery using only the user's Redis.
2. **Second adapter** (Twilio or MSG91): prove provider-swapping works end-to-end with a completely different vendor.
3. **CLI wizard**: `prompts` flow, `.env` writing, selective `npm install`. Test in a fresh project and in a CI environment.
4. **Publish both packages** to npm. Document the two-step flow prominently in the README.
5. **FCM adapter**: complete the core multi-channel promise.
6. **Community feedback**: Show HN / r/node. The wizard experience is the primary talking point.

---

### 18. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| npm `postinstall` limitation | Wizard cannot run automatically | Design around it — explicit `init` command only |
| Provider SDK churn | Adapters break | Thin adapter layer; each adapter isolated |
| Competition moves fast | Loss of differentiation | Differentiate on wizard UX + India focus |
| BullMQ scaling concerns | Performance at high volume | Document Redis sizing guidance; support Redis Cluster |
| User expects DB persistence | Feature requests | Document that Redis is the state layer; offer MongoDB adapter in v1.1 |
| Free package generates no revenue | Business sustainability | Open-core model from day one; premium tier in M7 |

---

### 19. Open Questions

1. Final package name (`notifykit` is a placeholder — verify npm availability).
2. Whether to publish adapters as separate packages or optional peer dependencies from day one.
3. Whether v1 should include Resend/SES or defer to v1.1.
4. Which hosting for the docs site (GitHub Pages, Vercel, etc.).
5. Whether the CLI wizard should also support a `--dry-run` mode.

---

### 20. Appendix

#### 20.1 Glossary

| Term | Definition |
| :--- | :--- |
| **Orchestration** | The logic that decides *when*, *to whom*, and *through which channel* a notification is sent |
| **Provider adapter** | A module that translates NotifyKit's standard interface into a specific vendor's API call |
| **BullMQ** | A Redis-backed job queue library for Node.js |
| **Dead-letter queue** | A queue where jobs go after exhausting all retries, for manual inspection |
| **DLT** | Distributed Ledger Technology — India's mandatory SMS sender registration system |
| **CPaaS** | Communications Platform as a Service (e.g., Twilio, MSG91) |
| **Open-core** | A business model where the core product is open source and commercial features are paid |
| **Stateless** | The library does not own or require a database; state lives in the user's infrastructure |

#### 20.2 Example: Full Developer Flow

**Step 1 — Install**

```bash
npm install notifykit
```

**Step 2 — Run the wizard**

```bash
npx notifykit init
```

*Wizard asks: Email, SMS, or Push? → User selects SMS → Twilio or MSG91? → User selects MSG91 → Enters Auth Key + Flow ID → Wizard writes `.env` and runs `npm install @notifykit/adapter-msg91`.*

**Step 3 — Use in code**

```typescript
import { createNotifier } from 'notifykit';

const notifier = createNotifier({
  redis: process.env.REDIS_URL,
  providers: {
    sms: { type: 'msg91' },
  },
});

await notifier.notify({
  to: { phone: '+919876543210' },
  channels: ['sms'],
  template: 'otp',
  data: { otp: '482913' },
});
```

**Result:** The job is enqueued to the user's Redis. A BullMQ worker picks it up, calls the MSG91 adapter, delivers the SMS via MSG91's API, and removes the job on success. On failure, it retries with backoff.

#### 20.3 Example: What the Wizard Writes

`.env`

```env
NOTIFYKIT_SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your-auth-key
MSG91_FLOW_ID=your-flow-id
```

`package.json` (dependencies added by the wizard)

```json
{
  "dependencies": {
    "notifykit": "^1.0.0",
    "@notifykit/adapter-msg91": "^1.0.0"
  }
}
```

---

**End of PRD v1.0**

---

This document is self-contained and can be handed to any engineer, designer, investor, or AI assistant. It explains the product's purpose, architecture, ownership model, monetization strategy, and build plan without requiring prior context.

Would you like me to next:
1. Draft the **exact `prompts` question flow** for the wizard (with TypeScript skeleton), or
2. Draft the **full TypeScript interfaces** for `notify()`, the config object, and the event schema, or
3. Draft the **README.md** for the npm package launch?




---

# 2. Consolidated System Architecture Document v1.1

## 🏗️ NotifyKit — System Architecture Document

**Document Version:** 1.1
**Status:** v1.1 merged architecture baseline
**Companion Documents:** PRD v1.0, PHASES.md, AGENTS.md
**Last Updated:** October 2026
**Scope:** Complete system design for the NotifyKit library, CLI wizard, and provider adapter ecosystem.

---

### Table of Contents

1. Architecture Overview
2. Architectural Style Decision
3. High-Level System Context
4. Component Architecture (Container View)
5. Module Design (Component View)
6. Data Flow & Sequence Diagrams
7. Tech Stack (Complete)
8. Queue & Job Architecture (BullMQ)
9. Provider Adapter Architecture
10. Error Handling & Retry Strategy
10.5 API-First Design Principles
11. Configuration & Credential Management
12. Observability & Logging
13. Security Architecture
13.5 Database & State Strategy
14. Testing Architecture
15. Build, Packaging & Distribution
16. Versioning & Release Strategy
17. Performance & Scaling Considerations
18. Deployment Topology (User Side)
19. Directory Structure
20. Architectural Decision Records (ADRs) — includes ADR-001 through ADR-011
21. Non-Functional Requirements
22. Future Evolution (v1.1 → v2)
23. Glossary

---

### 1. Architecture Overview

NotifyKit is a **distributed library system** — not a hosted service. It has no central server. It consists of three deployable artifacts that are consumed inside the **user's own Node.js process**:

| Artifact | Type | Deployed Where |
| :--- | :--- | :--- |
| **`notifykit`** (core) | npm library | Imported into the user's application code |
| **`notifykit-cli`** (wizard) | npm CLI | Run once via `npx notifykit init` |
| **`@notifykit/adapter-*`** | npm libraries (one per provider) | Installed into the user's project |

The **runtime architecture** is a **producer-consumer pattern** built on BullMQ + Redis (owned by the user), with a **pluggable provider adapter layer** that isolates all vendor SDKs from the core.

The **architecture philosophy** is:

- **Zero owned infrastructure** — NotifyKit never runs a server, database, or queue on your behalf.
- **Zero vendor lock-in** — the core is vendor-agnostic; adapters are swappable.
- **Zero forced dependencies** — the core is lean; provider SDKs are opt-in.
- **Reliable by default** — every notification is durable until delivered (or dead-lettered).

---

### 2. Architectural Style Decision

#### 2.1 Chosen Style: **Modular Monolith (Library Form)**

**Decision:** The core library will be built as a **modular monolith** — a single deployable npm package with strict internal module boundaries.

#### 2.2 Why Not Microservices?

| Option | Consideration | Decision |
| :--- | :--- | :--- |
| Microservices | Requires network calls between components; impossible inside a user's process; adds operational burden to the user | ❌ Rejected |
| Modular monolith | Single package; clear internal module boundaries; no network hops; easy to consume | ✅ Chosen |
| Unstructured monolith | No boundaries; tightly coupled code; hard to swap providers | ❌ Rejected |

**Rationale:** A library must be importable as a single package. Microservices require infrastructure that the user does not want to run. A **modular monolith** gives you the **internal separation of concerns** of microservices (clear module boundaries, dependency rules, swap-able adapters) without the operational cost — which is exactly the right trade-off for a distributable npm library.

#### 2.3 Module Boundary Rules (Enforced)

The modular monolith is governed by **strict dependency rules**:

```
┌─────────────────────────────────────────────┐
│  PUBLIC API (index.ts)                      │  ← only this is exported
└─────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌────────────┐   ┌──────────┐
│orchestr.│   │  queue     │   │config    │
└─────────┘   └────────────┘   └──────────┘
     │               │               │
     └───────┬───────┴───────┬───────┘
             ▼               ▼
     ┌──────────────┐ ┌──────────────┐
     │ interfaces   │ │ templates    │
     └──────────────┘ └──────────────┘
             │
             ▼
     ┌──────────────┐
     │  adapters    │  ← NEVER imported by core; injected at runtime
     └──────────────┘
```

**Rules:**

1. `interfaces/` has **no dependencies** on any other internal module. It is the foundation.
2. `orchestrator`, `queue`, `config`, `templates` depend on `interfaces` only.
3. `adapters` depend on `interfaces` only — **never** on the core.
4. The **core never imports a concrete adapter**. Adapters are **injected** at runtime via `createNotifier()`.
5. The **public API (`index.ts`)** is the only entry point — everything else is internal.
6. No circular dependencies allowed (enforced by ESLint `import/no-cycle`).

This gives you the **modularity benefits of microservices** (replaceability, testability, isolation) inside a **single npm package**.

---

### 3. High-Level System Context

The following C4-context diagram shows how NotifyKit sits in the user's world:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER'S NODE.JS APPLICATION                     │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                     NotifyKit (library)                      │   │
│   │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │   │
│   │  │Orchestrator│→ │  Queue   │→ │  Worker  │→ │  Adapters  │ │   │
│   │  └────────────┘  └──────────┘  └──────────┘  └────────────┘ │   │
│   └──────────────────────────────────────────────────────────────┘   │
│            │                  │                    │                  │
│            ▼                  ▼                    ▼                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐         │
│   │  User's .env │   │  User's Redis│   │ User's provider  │         │
│   │              │   │  (BullMQ)    │   │ credentials      │         │
│   └──────────────┘   └──────────────┘   └──────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────┐
                    ▼               ▼               ▼                   ▼
             ┌──────────┐   ┌──────────┐   ┌──────────┐        ┌──────────┐
             │ Twilio   │   │ MSG91    │   │  SMTP    │        │   FCM    │
             │ (SMS)    │   │ (SMS)    │   │ (Email)  │        │  (Push)  │
             └──────────┘   └──────────┘   └──────────┘        └──────────┘
```

**Actors and dependencies:**

| Actor | Role | Owned By |
| :--- | :--- | :--- |
| User's Node.js app | Hosts the library; calls `notify()` | User |
| User's Redis | Durable job queue (BullMQ) | User |
| User's `.env` | Credentials for providers | User |
| Provider APIs (Twilio, MSG91, SMTP, FCM) | Actual delivery | Third party |

**NotifyKit owns nothing at runtime. It orchestrates what the user already has.**

---

### 4. Component Architecture (Container View)

The system has **five containers** (packages), each with a distinct responsibility:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NotifyKit Ecosystem                          │
│                                                                      │
│  ┌────────────────────┐   ┌─────────────────────┐                   │
│  │  notifykit         │   │  notifykit-cli      │                   │
│  │  (core library)    │◄──│  (setup wizard)     │                   │
│  │                    │   │                     │                   │
│  │  - Orchestrator    │   │  - Prompts          │                   │
│  │  - BullMQ producer │   │  - Env writer       │                   │
│  │  - BullMQ worker   │   │  - SDK installer    │                   │
│  │  - Interfaces      │   │  - Validator        │                   │
│  │  - Templates       │   └─────────────────────┘                   │
│  └─────────┬──────────┘                                              │
│            │                                                         │
│            │ (interface contracts, loaded dynamically)              │
│            ▼                                                         │
│  ┌──────────────┬──────────────┬──────────────┬────────────────┐    │
│  │@notifykit/   │@notifykit/   │@notifykit/   │@notifykit/     │    │
│  │adapter-      │adapter-      │adapter-      │adapter-fcm     │    │
│  │nodemailer    │twilio        │msg91         │                │    │
│  └──────────────┴──────────────┴──────────────┴────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4.1 Container Responsibilities

| Container | Responsibility | Must NOT |
| :--- | :--- | :--- |
| **`notifykit`** (core) | Public API, orchestration, queue management, template rendering, interfaces | Import vendor SDKs; own a database; run HTTP server |
| **`notifykit-cli`** | Interactive setup, credential capture, `.env` writing, selective SDK install | Send notifications; modify runtime behavior |
| **`@notifykit/adapter-*`** | Translate standard interface → vendor API call | Contain business logic; access the queue; know about templates |

---

### 5. Module Design (Component View)

The **core library** (`notifykit`) is internally divided into **six modules** with strict boundaries.

#### 5.1 Module Map

```
src/
├── index.ts              ← public API surface
├── interfaces/           ← provider contracts (zero deps)
├── orchestrator/         ← the brain
├── queue/                ← BullMQ producer + worker
├── config/               ← env loading & validation
├── templates/            ← Handlebars rendering
└── logging/              ← Pino instance & redaction
```

#### 5.2 Module Specifications

##### Module 1: `interfaces/`

- **Purpose:** Define the contracts that all adapters implement.
- **Contains:** `EmailProvider`, `SmsProvider`, `PushProvider`, `NotificationEvent`, `NotificationResult`, `NotifierConfig`.
- **Dependencies:** **None.** This module is the foundation.
- **Rule:** Adding a field to an interface is a **breaking change** → major version bump.

##### Module 2: `config/`

- **Purpose:** Load `.env` variables, validate them against a Zod schema, and expose a typed config object.
- **Contains:** `loadConfig()`, `validateConfig()`, Zod schemas.
- **Dependencies:** `interfaces`, `dotenv`, `zod`.
- **Rule:** Invalid config must fail fast at `createNotifier()` time — never at delivery time.

##### Module 3: `templates/`

- **Purpose:** Load, cache, and render Handlebars templates with user data.
- **Contains:** `renderTemplate()`, `registerTemplate()`, `TemplateStore`.
- **Dependencies:** `interfaces`, `handlebars`.
- **Rule:** Templates can be registered in-memory or loaded from the filesystem. No external template service.

##### Module 4: `orchestrator/`

- **Purpose:** The brain. Validates events, resolves channel → adapter mapping, renders templates, and enqueues jobs.
- **Contains:** `notify()`, `validateEvent()`, `resolveChannels()`, `buildJobs()`.
- **Dependencies:** `interfaces`, `config`, `templates`, `queue`, `logging`.
- **Rule:** The orchestrator **never** calls a provider directly. It only enqueues.

##### Module 5: `queue/`

- **Purpose:** Manage the BullMQ producer (enqueue) and worker (process) lifecycle.
- **Contains:** `enqueueJob()`, `createWorker()`, `QueueRegistry`, `retryPolicy`.
- **Dependencies:** `interfaces`, `config`, `logging`, `bullmq`, `ioredis`.
- **Rule:** The worker is started by the user (via `notifier.startWorker()`) — never auto-started on import.

##### Module 6: `logging/`

- **Purpose:** Central Pino logger with credential redaction.
- **Contains:** `logger`, `redactPaths`.
- **Dependencies:** `pino`.
- **Rule:** All modules must use this logger. `console.log` is forbidden (ESLint rule).

#### 5.3 Module Dependency Matrix

| From ↓ / To → | interfaces | config | templates | queue | orchestrator | logging |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **interfaces** | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| **config** | ✅ | — | ❌ | ❌ | ❌ | ✅ |
| **templates** | ✅ | ❌ | — | ❌ | ❌ | ✅ |
| **queue** | ✅ | ✅ | ❌ | — | ❌ | ✅ |
| **orchestrator** | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **logging** | ❌ | ❌ | ❌ | ❌ | ❌ | — |

**Reading:** `orchestrator` depends on everything except `interfaces` (which it depends on) and `logging` (which it uses). `interfaces` depends on nothing. This is what keeps the module boundaries clean.

---

### 6. Data Flow & Sequence Diagrams

#### 6.1 Enqueue Flow (`notify()` call)

```
User Code          Orchestrator       Templates       Queue (BullMQ)      Redis
    │                   │                 │                 │                 │
    │ notify(event)     │                 │                 │                 │
    ├──────────────────►│                 │                 │                 │
    │                   │ validateEvent   │                 │                 │
    │                   ├──┐              │                 │                 │
    │                   │  │ zod parse    │                 │                 │
    │                   │◄─┘              │                 │                 │
    │                   │                 │                 │                 │
    │                   │ renderTemplate  │                 │                 │
    │                   ├────────────────►│                 │                 │
    │                   │                 │                 │                 │
    │                   │◄────────────────┤                 │                 │
    │                   │  rendered body  │                 │                 │
    │                   │                 │                 │                 │
    │                   │ enqueueJob       │                 │                 │
    │                   ├──────────────────────────────────►│                 │
    │                   │                 │                 │ addJob          │
    │                   │                 │                 ├────────────────►│
    │                   │                 │                 │                 │
    │                   │◄──────────────────────────────────┤                 │
    │◄──────────────────┤ { jobId }        │                 │                 │
```

**Key property:** `notify()` returns as soon as the job is durably in Redis. It does **not** wait for delivery.

#### 6.2 Delivery Flow (BullMQ worker)

```
Redis           Worker           Adapter (e.g. Twilio)      External API
  │               │                     │                        │
  │ job ready     │                     │                        │
  ├──────────────►│                     │                        │
  │               │ sendSms(opts)       │                        │
  │               ├────────────────────►│                        │
  │               │                     │ POST /Messages         │
  │               │                     ├───────────────────────►│
  │               │                     │                        │
  │               │                     │◄───────────────────────┤
  │               │                     │  200 OK                │
  │               │◄────────────────────┤                        │
  │               │ { success: true }   │                        │
  │               │                     │                        │
  │               │ ack job             │                        │
  │◄──────────────┤                     │                        │
  │  remove       │                     │                        │
```

#### 6.3 Failure & Retry Flow

```
Redis        Worker        Adapter        External API
  │            │              │                │
  │ job ready  │              │                │
  ├───────────►│              │                │
  │            │ send()       │                │
  │            ├─────────────►│                │
  │            │              │ POST           │
  │            │              ├───────────────►│
  │            │              │                │
  │            │              │◄───────────────┤
  │            │              │ 500 Error      │
  │            │◄─────────────┤                │
  │            │ { success:false, error }      │
  │            │              │                │
  │            │ retry (3x with backoff)       │
  │◄───────────┤ move to delayed queue         │
  │            │              │                │
  │  ... after max retries ...                 │
  │◄───────────┤ move to DLQ (dead-letter)     │
```

**Retry policy:** exponential backoff — 1s, 5s, 25s (configurable). After 3 attempts, the job moves to a dead-letter queue for manual inspection.

---

### 7. Tech Stack (Complete)

| Layer | Technology | Version | Rationale |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | ≥20 LTS | Modern async, stable `fetch`, native test runner |
| **Language** | TypeScript | ≥5.4 | Type safety across adapters; strict mode on |
| **Package manager** | npm | ≥10 | Universal; no need for pnpm/yarn |
| **HTTP framework** | Express.js | ≥4.19 | Familiar to target users; optional — only used if the user wants an HTTP trigger endpoint |
| **Queue** | BullMQ | ≥5 | Industry-standard Node.js job queue; Redis-backed |
| **Redis client** | ioredis | ≥5 | BullMQ's dependency; supports Redis Cluster |
| **Validation** | Zod | ≥3.23 | Runtime schema validation for events and config |
| **Templating** | Handlebars | ≥4.7 | Simple, widely understood, no heavy runtime |
| **Logging** | Pino | ≥9 | Fast, structured, built-in redaction |
| **Env loading** | dotenv | ≥16 | Standard `.env` support |
| **HTTP client** | Native `fetch` | Node 20+ | Zero-dependency; avoids `axios` bloat |
| **CLI prompts** | prompts | ≥2.4 | Interactive wizard |
| **CLI colors** | chalk | ≥5 | Terminal output |
| **CLI process** | execa | ≥9 | Safe `npm install` invocation |
| **Testing** | Vitest | ≥2 | Fast, ESM-native, TypeScript-first |
| **Integration tests** | Testcontainers | ≥10 | Real Redis in Docker for tests |
| **Lint/format** | ESLint + Prettier | latest | `import/no-cycle`, `no-console`, `@typescript-eslint/strict` |
| **Build** | tsup | ≥8 | Fast ESM+CJS dual output |
| **CI** | GitHub Actions | — | Matrix test on Node 20, 22, 24 |

#### 7.1 Dependency Policy (Critical)

The **core library** must remain **dependency-light**. Rules:

1. **Allowed in `dependencies`:** `bullmq`, `ioredis`, `zod`, `handlebars`, `pino`, `dotenv`.
2. **Forbidden in `dependencies`:** Any vendor SDK (`twilio`, `nodemailer`, `firebase-admin`).
3. **Vendor SDKs** live in adapter packages as `peerDependencies` — the user installs them explicitly (via the wizard).
4. **Dev dependencies** are unbounded but never shipped.

---

### 8. Queue & Job Architecture (BullMQ)

#### 8.1 Queue Topology

NotifyKit uses **four queues**, one per channel plus a dead-letter queue:

| Queue | Purpose | Concurrency |
| :--- | :--- | :--- |
| `notifykit:email` | Email delivery jobs | Configurable (default 5) |
| `notifykit:sms` | SMS delivery jobs | Configurable (default 5) |
| `notifykit:push` | Push delivery jobs | Configurable (default 10) |
| `notifykit:dlq` | Dead-letter (failed after retries) | Manual inspection only |

**Why one queue per channel?** Different channels have different rate limits and failure characteristics. Twilio's rate limit is per-number; FCM allows much higher throughput. Independent queues let the user scale concurrency per channel.

#### 8.2 Job Payload Schema

```typescript
interface NotificationJob {
  id: string;                  // uuid v7 (sortable)
  channel: 'email' | 'sms' | 'push';
  provider: string;            // adapter name
  to: Recipient;
  templateId: string;
  renderedBody: string;        // already rendered; worker doesn't re-render
  variables?: Record<string, string>;
  metadata: {
    enqueuedAt: number;
    userId?: string;
    traceId: string;           // correlation id
  };
}
```

**Design decision:** The job stores the **rendered body**, not the raw template + data. This means the worker does no rendering — it just calls the adapter. **Why?** Rendering at enqueue time catches template errors early (fail fast), and reduces worker CPU work, making the worker cheap to scale.

#### 8.3 Worker Lifecycle

Workers are **explicitly started** by the user:

```typescript
const notifier = createNotifier({ redis, providers });

notifier.startWorker({ channels: ['sms', 'email'] });  // explicit
```

**Why explicit?** Importing the library must never spin up workers as a side effect. That would break testing, violate the principle of least surprise, and cause unexpected Redis connections.

#### 8.4 BullMQ Configuration

| Setting | Default | Configurable |
| :--- | :--- | :--- |
| `attempts` | 3 | ✅ |
| `backoff.type` | `exponential` | ✅ |
| `backoff.delay` | 1000 ms | ✅ |
| `removeOnComplete` | `{ count: 1000 }` | ✅ |
| `removeOnFail` | `false` (kept for DLQ inspection) | ✅ |
| `limiter` | none (channel-specific) | ✅ |
| `concurrency` | per-channel default | ✅ |

---

### 9. Provider Adapter Architecture

#### 9.1 Adapter Contract

Every adapter must:

1. Export a class implementing `EmailProvider` | `SmsProvider` | `PushProvider`.
2. Export a `metadata` object declaring its name and required env vars.
3. **Never** import from the core library (only from `interfaces`).
4. Have zero side effects on import.

#### 9.2 Adapter Example (Skeleton)

```typescript
// @notifykit/adapter-twilio/src/index.ts
import type { SmsProvider } from 'notifykit/interfaces';

export const metadata = {
  name: 'twilio',
  channel: 'sms',
  requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
};

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';

  async sendSms(opts) {
    const client = getTwilioClient(); // lazy init
    try {
      const message = await client.messages.create({
        to: opts.to,
        from: opts.from,
        body: opts.body,
      });
      return { success: true, messageId: message.sid };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

#### 9.3 Adapter Loading Mechanism

The core resolves adapters via a **registry pattern** — adapters register themselves through the user's config:

```typescript
createNotifier({
  providers: {
    sms: { type: 'twilio', adapter: new TwilioSmsProvider() },
  },
});
```

**Why explicit injection instead of `require('@notifykit/adapter-twilio')`?** Explicit injection means:

- The core has **zero knowledge** of adapter package names.
- The user can swap adapters without changing the core.
- Testing is trivial — pass a mock adapter.
- Tree-shaking works: only the adapters the user imports end up in the bundle.

---

### 10. Error Handling & Retry Strategy

#### 10.1 Error Taxonomy

| Error Class | Retryable? | Example |
| :--- | :--- | :--- |
| **Validation error** | ❌ No | Invalid phone number format |
| **Auth error** | ❌ No | Wrong Twilio credentials (retrying won't fix) |
| **Transient provider error** | ✅ Yes | Twilio 500, FCM timeout |
| **Rate limit error** | ✅ Yes (delayed) | Twilio 429 |
| **Network error** | ✅ Yes | DNS failure, connection refused |
| **Unknown** | ✅ Yes (conservative) | Retry to be safe, escalate to DLQ |

#### 10.2 Error Classification (Adapter Responsibility)

Adapters must return a structured result:

```typescript
interface ProviderResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;   // ← adapter classifies
  retryAfterMs?: number; // ← for rate limits
}
```

The **worker** reads `retryable` and decides whether to retry. If `retryable === false`, the job moves straight to the DLQ.

#### 10.3 Retry Flow Summary

```
Attempt 1 → fail (retryable) → wait 1s
Attempt 2 → fail (retryable) → wait 5s
Attempt 3 → fail (retryable) → move to DLQ
```

Non-retryable errors skip straight to DLQ on attempt 1.

---


### 10.5 API-First Design Principles

#### B.2 What "API-First" Means for a Library (and What It Does Not)



"API-first" is often used as a buzzword. For a library like NotifyKit, it means **four concrete disciplines**:

1. **The public type surface (`interfaces/`) is the contract.** It is designed before implementation, documented with TSDoc, and versioned independently of internal modules.
2. **Every public API change is a deliberate, versioned decision.** No accidental breaking changes. Ever.
3. **Every public API method has a contract test** that runs against the published type surface — not against an internal mock.
4. **An optional HTTP surface, if ever built, is specified by an OpenAPI document first** — the code is generated from or validated against the spec, not the reverse.

**What "API-first" does NOT mean for a library:**

- ❌ It does not mean "build a REST API before the library." The library is the primary artifact; the HTTP surface is optional and deferred.
- ❌ It does not mean "add OpenAPI to a TypeScript type." TypeScript already gives us the type surface; OpenAPI is only for the HTTP layer.
- ❌ It does not mean "expose every internal module." The public surface is *deliberately* narrow (`src/index.ts` + `src/interfaces/index.ts`).
- ❌ It does not mean "version every function." Only the package version matters; individual functions are versioned via semver of the whole package.

---

#### B.3 The Two APIs (Library API + Optional HTTP API)

NotifyKit has **two distinct API surfaces**, with different governance:

| Surface | What It Is | Status in v1 | Versioned By |
| :--- | :--- | :--- | :--- |
| **Library API** | The TypeScript types and functions exported from `notifykit` | ✅ Primary | npm package version (semver) |
| **HTTP API** | REST endpoints for triggering notifications from any language | ⏸ Deferred to v1.1 | URL path prefix (`/v1/`, `/v2/`) |

Both are "first-class" when they exist. The HTTP API is deferred, not deprioritized — it is deferred precisely so v1 can be excellent at the library surface.

---

#### B.4 Library API Versioning

##### B.4.1 Semver Rules

The `notifykit` package follows **strict semver**:

| Change Type | Version Bump | Examples |
| :--- | :--- | :--- |
| **Patch** | `1.0.0` → `1.0.1` | Bug fix that does not change any type signature |
| **Minor** | `1.0.0` → `1.1.0` | Add a new optional field to an interface; add a new exported helper |
| **Major** | `1.0.0` → `2.0.0` | Rename or remove an interface field; change a function signature; change error class hierarchy |

##### B.4.2 What Counts as "Public"

Only these are public and subject to semver guarantees:

| Public | Path |
| :--- | :--- |
| Main entry | `notifykit` (`dist/index.js`, `dist/index.d.ts`) |
| Interfaces entry | `notifykit/interfaces` (`dist/interfaces/index.js`, `dist/interfaces/index.d.ts`) |
| Package metadata | `package.json` `exports`, `peerDependencies`, `engines` |

**Everything else is internal.** Internal modules (`orchestrator/`, `queue/`, `config/`, `templates/`, `logging/`) can change freely between versions — they are not exported from `index.ts`.

##### B.4.3 Deprecation Policy

When a public API is deprecated:

1. Add `@deprecated` TSDoc tag with a migration example.
2. Ship the deprecation in a **minor** release.
3. Keep the deprecated API working for **one major release** (e.g., deprecated in `1.5.0`, removed in `2.0.0`).
4. Log a deprecation warning at runtime (Pino `warn` level) — but only once per process.
5. Document in `CHANGELOG.md` with a `### Deprecated` section.

##### B.4.4 Adapter Versioning

Each adapter is its own npm package, versioned **independently**:

- `@notifykit/adapter-twilio@2.0.0` can require `notifykit@^2.0.0`.
- Adapters declare their compatible core range via `peerDependencies`.
- A breaking change to `interfaces/` requires a major bump on **core and every adapter**.

**This is a real maintenance cost.** It is the price of the modular architecture — but it is what keeps adapters isolated.

---

#### B.5 Library API Contract Testing

##### B.5.1 What Contract Testing Means Here

Every public type and function in `interfaces/` and `index.ts` must have a **contract test** that verifies:

1. The type signature compiles as documented.
2. The runtime behavior matches the documented contract.
3. The error class hierarchy is correct.
4. No public API returns `any` or `unknown` without narrowing.

##### B.5.2 Where Contract Tests Live

```
packages/core/tests/contract/
├── interfaces.test-d.ts        ← type-level contract test (via tsd or vitest typecheck)
├── notify.test.ts              ← runtime contract of notify()
├── create-notifier.test.ts     ← runtime contract of createNotifier()
├── start-worker.test.ts        ← runtime contract of startWorker()
├── errors.test.ts              ← error class hierarchy contract
└── provider-interfaces.test-d.ts  ← type-level contract of EmailProvider, SmsProvider, PushProvider
```

##### B.5.3 Contract Test Requirements

| Test | Tool | What It Verifies |
| :--- | :--- | :--- |
| Type-level tests | `vitest` with `expectTypeOf` or `tsd` | Public types match the spec |
| Runtime tests | `vitest` | `notify()` enqueues; error classes exist; etc. |
| Error envelope | `vitest` | Every thrown error has `code`, `message`, `hint`, `traceId` |

##### B.5.4 When Contract Tests Run

- **On every PR** (in CI, via `pnpm test`).
- **Before every publish** (in CI, via `pnpm test && pnpm publish`).
- **Against the published package** (a separate "sanity" job that installs the beta tag in a clean project and runs the contract tests).

**If a contract test fails, the PR cannot be merged and the publish cannot proceed.**

---

#### B.6 HTTP API Specification (OpenAPI 3.1)

**Status:** Deferred to v1.1. This section specifies *how* the HTTP API will be designed when it is built — not that it is being built now.

##### B.6.1 Why OpenAPI

When the HTTP API is built, it must be **specified before implementation**, using **OpenAPI 3.1** (the current standard, with JSON Schema 2020-12 support).

**Reasons:**

1. **Language-agnostic.** Any client (Python, Go, Rust, PHP) can generate a typed client from the spec.
2. **Contract testing.** The server can be validated against the spec in CI (via `spectral` or `openapi-diff`).
3. **Documentation is free.** Tools like Redoc or Scalar generate beautiful docs from the spec.
4. **Backward compatibility is checkable.** `openapi-diff` in CI flags breaking changes automatically.

##### B.6.2 Proposed Endpoints (v1.1)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/v1/notify` | Enqueue a notification (mirrors `notify()`) |
| `GET` | `/v1/jobs/{id}` | Get job status by ID |
| `GET` | `/v1/queues` | List queue metadata (depth, concurrency) |
| `GET` | `/v1/health` | Health check |
| `GET` | `/v1/metrics` | Prometheus metrics (opt-in) |

**All endpoints are authenticated** via a bearer token that the user provides (typically their Redis connection token or a custom API key). NotifyKit does not run an auth service — it validates the token against a config the user supplies.

##### B.6.3 Spec Location

The spec will live at:

- **Repository:** `docs/openapi.yaml`
- **Published URL:** `https://notifykit.dev/openapi.yaml` (once the docs site exists)
- **In the npm package:** `@notifykit/http/openapi.yaml` (so clients can be regenerated from the installed package)

##### B.6.4 Spec Authoring Rules

1. Every endpoint has a `summary` and a `description`.
2. Every request/response body is a `$ref` to a component schema.
3. Every error response uses the standard envelope (B.8).
4. Every endpoint declares `operationId` (for SDK generation).
5. The spec is **validated in CI** via `spectral lint docs/openapi.yaml`.
6. The spec is **diffed against the previous release** via `openapi-diff` — breaking changes fail the build.

---

#### B.7 HTTP API Versioning

##### B.7.1 URL Prefix Strategy

The HTTP API is versioned via **URL path prefix**: `/v1/`, `/v2/`.

**Why URL prefix, not headers?** It is the simplest to debug (visible in logs, browser address bar, and curl commands). Header-based versioning is more "elegant" but harder to inspect.

##### B.7.2 What Version Bumps Mean

| Change | Version |
| :--- | :--- |
| Add a new endpoint | No version bump (additive) |
| Add an optional field to a response | No version bump |
| Add a required field to a request | **Major bump** (`/v2/`) |
| Remove or rename a field | **Major bump** |
| Change the semantics of an existing field | **Major bump** |
| Deprecate an endpoint | Announce 2 releases ahead; keep working until next major |

##### B.7.3 API Deprecation Policy

When an endpoint is deprecated:

1. Add `deprecated: true` in the OpenAPI spec.
2. Return a `Deprecation` header and a `Sunset` header (RFC 8594) with the removal date.
3. Document the migration path in `CHANGELOG.md`.
4. Keep the endpoint working for **at least 6 months** after deprecation.

---

#### B.8 Standard Error Envelope

Every error returned by the library or the HTTP API follows the same shape. This is the single most important API-first decision — it makes errors *predictable* and *debuggable*.

##### B.8.1 Library Error Shape

All errors thrown by NotifyKit extend `NotifyKitError`, which has:

```typescript
class NotifyKitError extends Error {
  readonly code: string;       // Stable machine-readable code, e.g. "E_INVALID_EVENT"
  readonly message: string;    // Human-readable, includes a fix hint
  readonly hint: string;       // Actionable "how to fix" text
  readonly traceId: string;    // Correlates with log lines
  readonly cause?: unknown;    // Original error, if wrapped
}
```

##### B.8.2 HTTP Error Shape

Every HTTP error response uses the same JSON envelope:

```json
{
  "error": {
    "code": "E_INVALID_EVENT",
    "message": "Field 'to.phone' is required when channel 'sms' is selected.",
    "hint": "Pass { to: { phone: '+919876543210' } } or remove 'sms' from channels.",
    "traceId": "0192a4c1-7f3e-7b2a-9d1c-2e5f8a9b0c3d"
  }
}
```

##### B.8.3 Standard Error Codes (Initial Set)

| Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `E_INVALID_EVENT` | 400 | Event schema validation failed |
| `E_MISSING_ADAPTER` | 400 | Channel requested but no adapter configured |
| `E_MISSING_TEMPLATE` | 400 | Template ID not registered |
| `E_MISSING_VARIABLE` | 400 | Template variable not provided |
| `E_CONFIG_INVALID` | 500 | `.env` or config object invalid at startup |
| `E_REDIS_UNAVAILABLE` | 503 | Cannot reach Redis |
| `E_QUEUE_FULL` | 503 | Redis `maxmemory` reached |
| `E_PROVIDER_AUTH` | 502 | Adapter returned auth error from provider |
| `E_PROVIDER_RATE_LIMIT` | 429 | Adapter hit provider rate limit |
| `E_PROVIDER_UNAVAILABLE` | 502 | Adapter returned transient error |
| `E_INTERNAL` | 500 | Unexpected error (should never happen) |

**Rule:** Error codes are **stable**. `E_INVALID_EVENT` will never mean something else. New codes are added in minor versions; existing codes are never removed.

---

#### B.9 Idempotency

**Status:** v1.1 (HTTP API only). Not in v1 library.

When a client calls `POST /v1/notify` twice with the same `Idempotency-Key` header, the second call returns the **same response** as the first — including the same `jobId`. The notification is **not** sent twice.

**Implementation (v1.1):**

- Client provides `Idempotency-Key: <uuid>` header.
- Server stores `idempotency:<key>` → `{ jobId, response, ttl }` in Redis.
- TTL: 24 hours (configurable).
- If the key exists, return the cached response.
- If not, process the request and store the response.

**Library equivalent (future):** `notify({ ..., idempotencyKey: 'uuid' })` — but this is **not in v1**. The v1 answer is "wrap `notify()` in your own idempotency check if you need it."

---

#### B.10 The `@notifykit/http` Package (Optional, v1.1)

When the HTTP API is built, it is a **separate package**, not folded into core.

**Why separate:**

1. **Keeps core lean.** Core is a library; HTTP is a service. Users who only want the library never install Express or HTTP dependencies.
2. **Different deployment story.** The library runs inside the user's app; the HTTP server may run as a separate process or container.
3. **Different scaling story.** HTTP servers scale on request rate; workers scale on queue depth. They should be independently scalable.
4. **Optional Express dependency.** The HTTP package depends on Express (or Fastify — TBD). Core does not.

**Package structure (v1.1):**

```
@notifykit/http/
├── src/
│   ├── server.ts          ← Express app factory
│   ├── routes/
│   │   ├── notify.ts      ← POST /v1/notify
│   │   ├── jobs.ts        ← GET /v1/jobs/:id
│   │   ├── queues.ts      ← GET /v1/queues
│   │   ├── health.ts      ← GET /v1/health
│   │   └── metrics.ts     ← GET /v1/metrics
│   ├── middleware/
│   │   ├── auth.ts        ← Bearer token validation
│   │   ├── error.ts       ← Error envelope formatter
│   │   └── tracing.ts     ← Trace ID propagation
│   └── index.ts
├── openapi.yaml           ← OpenAPI 3.1 spec
├── tests/
└── package.json
```

**Peer dependencies:** `notifykit`, `express`.

---

#### B.11 Why HTTP is Deferred to v1.1

The HTTP API is deferred for five reasons:

1. **v1 must be excellent at one thing.** The library surface is the primary artifact. Splitting focus would compromise both.
2. **HTTP requires auth.** A public HTTP endpoint requires authentication, rate limiting, and abuse prevention — all of which are non-trivial and out of scope for v1.
3. **HTTP requires deployment guidance.** The library runs in-process; HTTP runs as a service. That is a new deployment story to document, test, and support.
4. **HTTP requires Express or Fastify.** Both are opinionated choices that some users will reject. Shipping the library first lets users choose their own HTTP framework when integrating.
5. **The demand signal is not yet proven.** If library users ask for HTTP in the first 6 months, it is validated demand. If they do not, building it early was wasted effort.

**Trigger to build `@notifykit/http` (v1.1):**
- ≥ 20 users request a language-agnostic HTTP interface.
- ≥ 5 users specifically ask for "an HTTP endpoint for non-Node.js clients."
- The core library has ≥ 1,000 weekly downloads (proves v1 is stable).

---

### 11. Configuration & Credential Management

#### 11.1 Config Sources (Priority Order)

1. Explicit config object passed to `createNotifier()`
2. Environment variables (`.env`)
3. Defaults

#### 11.2 Validation Rules

- All credentials validated at `createNotifier()` time via Zod.
- Missing required env vars → **immediate throw** with a clear message (e.g., "Twilio selected but `TWILIO_AUTH_TOKEN` is missing. Run `npx notifykit init` or set it in `.env`").
- No credential is ever logged; Pino redacts paths matching `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`.

#### 11.3 `.env` Contract

```env
NOTIFYKIT_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
NOTIFYKIT_EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

The **wizard writes this file**; the **core reads it**; **nothing else touches it**.

---

### 12. Observability & Logging

#### 12.1 Logging (Pino)

Every log line includes:

- `traceId` (UUID per `notify()` call)
- `jobId`
- `channel`
- `provider`
- `durationMs` (for worker logs)

**Log levels:**

| Level | Used For |
| :--- | :--- |
| `info` | Job enqueued, job completed |
| `warn` | Retry attempt, rate limit |
| `error` | Job failed, DLQ entry |
| `debug` | Config resolved, adapter loaded |

#### 12.2 Metrics (Opt-in)

Optional Prometheus exporter (v1.1) exposing:

- `notifykit_jobs_enqueued_total{channel}`
- `notifykit_jobs_completed_total{channel,provider}`
- `notifykit_jobs_failed_total{channel,provider,reason}`
- `notifykit_job_duration_seconds{channel,provider}`
- `notifykit_queue_depth{queue}`

**Not in v1** — but the logging hooks are designed to make it trivial to add.

#### 12.3 Tracing

- `traceId` propagated from `notify()` → job metadata → adapter call.
- OpenTelemetry hook deferred to v1.1.

---

### 13. Security Architecture

| Threat | Mitigation |
| :--- | :--- |
| **Credential leakage in logs** | Pino redaction of `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*` |
| **Credential leakage in errors** | Adapters catch errors and sanitize before returning |
| **Credential leakage in git** | Wizard writes `.env`; documentation instructs `.gitignore` |
| **Accidental browser usage** | No adapter ships a browser build; Twilio SDK explicitly documented as server-only |
| **Malicious adapter** | Adapters are sandboxed via the interface — they receive only what they need |
| **Supply chain attack on core deps** | Minimal dependencies; `npm audit` in CI; Dependabot enabled |
| **Redis credential exposure** | `REDIS_URL` handled like any other credential; redacted in logs |
| **Replay attacks on jobs** | Job IDs are UUID v7; idempotency key support in v1.1 |

---


### 13.5 Database & State Strategy

#### A.2 The Stateless Principle (Formal Statement)



> **NotifyKit owns zero durable state. It borrows the user's Redis exclusively as a BullMQ backing store, for the lifetime of each notification job. It never reads, writes, or scans any key outside the `notifykit:*` namespace. It never requires a relational database, document store, or object store in v1.**

This principle is the reason the core library can be:

- **Distributed at zero cost** to the creator (npm is free, no servers to run).
- **Installed in seconds** (no migrations, no schema setup, no DB provisioning).
- **Tested in CI** (Testcontainers spins up Redis; no DB state to seed).
- **Deleted cleanly** (removing the package leaves no orphaned data in the user's infrastructure beyond what BullMQ already manages).

If a future feature cannot satisfy this principle, it must be added as a **separate optional package** (e.g., `@notifykit/mongo-log`, `@notifykit/http`) — never folded into the core.

---

#### A.3 Complete State Inventory

This table is the authoritative list of every piece of state NotifyKit touches at runtime. If a future phase introduces new state, this table MUST be updated in the same PR.

| State | Where It Lives | Owned By | Lifetime | TTL / Retention |
| :--- | :--- | :--- | :--- | :--- |
| **Pending job** | Redis `bull:notifykit:<channel>:*` | User's Redis | Until picked up by a worker | Deleted on completion (see A.4) |
| **Active job** (in-flight) | Redis | User's Redis | Duration of the adapter call | Deleted on success or retry scheduling |
| **Delayed job** (retry backoff) | Redis `bull:notifykit:<channel>:delayed` | User's Redis | 1s → 5s → 25s backoff | Deleted when promoted to active |
| **Completed job** | Redis `bull:notifykit:<channel>:completed` | User's Redis | Configurable | Default: keep last 1,000 per channel (`removeOnComplete: { count: 1000 }`) |
| **Failed job** (awaiting retry) | Redis `bull:notifykit:<channel>:failed` | User's Redis | Until max retries exhausted | Promoted to DLQ on terminal failure |
| **Dead-letter job** (terminal) | Redis `bull:notifykit:dlq:*` | User's Redis | Until user inspects | **No default TTL** — user must configure |
| **Template source** | In-memory `TemplateStore` | User's process memory | Lifetime of the process | Cleared on `stopWorker()` / process exit |
| **Provider config** | User's `.env` file | User's filesystem | Until user changes it | N/A (not NotifyKit's concern) |
| **Logs** | stdout (Pino JSON) | User's log aggregator | User-defined | User-defined |
| **Trace ID** | In-memory propagation | User's process memory | Duration of one `notify()` call | Discarded on return |
| **Metrics** (v1.1) | Prometheus endpoint | User's monitoring | User-defined | User-defined |

**Nothing in this table lives on infrastructure owned by the creator of NotifyKit.** Every row belongs to the user.

---

#### A.4 Redis Data Model

##### A.4.1 Key Naming Convention

BullMQ is opinionated about its key structure. NotifyKit does not override it — but must **document** it so users can inspect Redis confidently.

| Key pattern | Purpose | Example |
| :--- | :--- | :--- |
| `bull:notifykit:<channel>:<jobId>` | Job payload (hash) | `bull:notifykit:sms:0192a4...` |
| `bull:notifykit:<channel>:wait` | Queue of pending job IDs (list) | `bull:notifykit:sms:wait` |
| `bull:notifykit:<channel>:active` | In-flight job IDs (list) | `bull:notifykit:sms:active` |
| `bull:notifykit:<channel>:delayed` | Delayed jobs (sorted set) | `bull:notifykit:sms:delayed` |
| `bull:notifykit:<channel>:completed` | Completed job IDs (sorted set) | `bull:notifykit:sms:completed` |
| `bull:notifykit:<channel>:failed` | Failed job IDs (sorted set) | `bull:notifykit:sms:failed` |
| `bull:notifykit:dlq:<jobId>` | Dead-letter job payload | `bull:notifykit:dlq:0192a4...` |
| `bull:notifykit:<channel>:meta` | Queue metadata (paused, concurrency) | `bull:notifykit:sms:meta` |

**Rule:** NotifyKit never touches any key that does not start with `bull:notifykit:`. Any code that scans, reads, or deletes a key outside this namespace is a defect.

##### A.4.2 TTL and Retention Policy

BullMQ does **not** set TTLs by default. Without configuration, Redis will grow indefinitely. NotifyKit must set safe defaults and document them.

| Queue | `removeOnComplete` | `removeOnFail` | Rationale |
| :--- | :--- | :--- | :--- |
| `notifykit:email` | `{ count: 1000, age: 86400 }` | `{ count: 5000, age: 604800 }` | Keep 1,000 completed jobs (24h) and 5,000 failed jobs (7d) for debugging |
| `notifykit:sms` | `{ count: 1000, age: 86400 }` | `{ count: 5000, age: 604800 }` | Same as email |
| `notifykit:push` | `{ count: 5000, age: 86400 }` | `{ count: 10000, age: 604800 }` | Push is higher volume; keep more history |
| `notifykit:dlq` | `{ count: 0 }` (never auto-remove) | N/A | DLQ must be inspected manually |

**All values are overridable** by the user via `startWorker({ retention: {...} })`. The defaults are the **safe maximum** — users with high volume should lower them.

**Why these numbers?**

- 1,000 completed jobs at ~1 KB each = ~1 MB. Trivial.
- 5,000 failed jobs at ~1 KB each = ~5 MB. Trivial, but plenty for post-mortem debugging.
- After 7 days, failed jobs older than that are assumed irrelevant — the user should have triaged them.

##### A.4.3 What BullMQ Also Creates

BullMQ also uses these auxiliary keys under the same prefix:

- `bull:notifykit:<channel>:id` — monotonic job ID counter
- `bull:notifykit:<channel>:stalled-check` — lock for stalled-job detection
- `bull:notifykit:<channel>:events` — event stream (used by `QueueEvents`)

These are managed by BullMQ. NotifyKit does not touch them directly, but they contribute to the memory footprint (see A.5).

##### A.4.4 Job Payload Size

The `NotificationJob` schema from `ARCHITECTURE.md §8.2` is deliberately small. Measured values:

| Field | Typical Size |
| :--- | :--- |
| `id` (UUID v7) | 36 bytes |
| `channel` | 5 bytes |
| `provider` | 6–8 bytes |
| `to` (recipient object) | ~100 bytes |
| `templateId` | ~20 bytes |
| `renderedBody` | ~500 bytes – 5 KB (depends on template) |
| `variables` | ~100 bytes |
| `metadata` | ~100 bytes |
| **Total per job** | **~1 KB – 6 KB** |

**Rendered body dominates the payload size.** For email templates with HTML, expect ~5 KB per job. For SMS (140 chars), expect ~200 bytes.

**Design decision (already made in ADR-004):** Rendering at enqueue time means we store the rendered body instead of the raw template + data. This is ~3–4× larger per job but makes the worker dramatically simpler and cheaper to scale.

---

#### A.5 Memory Sizing & Retention

##### A.5.1 Redis Memory Estimates

| Jobs in flight | Pending | Completed | Memory (approx) |
| :--- | :--- | :--- | :--- |
| 1,000 | 1,000 × 1 KB = 1 MB | 1,000 × 1 KB = 1 MB | **~3 MB** (with overhead) |
| 10,000 | 10 MB | 10 MB | **~30 MB** |
| 100,000 | 100 MB | 100 MB | **~300 MB** |
| 1,000,000 | 1 GB | 1 GB | **~3 GB** |

**Rule of thumb:** Each in-flight job costs **~3 KB of Redis memory** (payload + indexes + overhead). For email with HTML bodies, assume **~7 KB per job**.

##### A.5.2 Recommended Redis Sizing (Documentation for Users)

NotifyKit's docs must include this table so users size their Redis correctly:

| Daily volume | Peak in-flight | Recommended Redis RAM |
| :--- | :--- | :--- |
| < 10,000 | < 100 | 64 MB |
| 10,000 – 100,000 | < 1,000 | 256 MB |
| 100,000 – 1,000,000 | < 10,000 | 512 MB – 1 GB |
| > 1,000,000 | > 10,000 | 2 GB+ (consider Redis Cluster) |

**Note:** These are minimums for NotifyKit alone. The user's Redis is shared with their app, so add their existing footprint.

---

#### A.6 Redis Failure Semantics

The user must understand what happens when Redis is unavailable. Documented behavior:

| Scenario | What Happens | Recovery |
| :--- | :--- | :--- |
| **Redis down at `notify()` time** | `notify()` throws `RedisConnectionError` with a clear message. No job is enqueued. | User retries after Redis recovers. |
| **Redis down while worker is running** | Worker reconnects with exponential backoff (ioredis default). In-flight jobs are retried when Redis returns. | Automatic. |
| **Redis data lost** (flush, volume gone) | All pending, delayed, and in-flight jobs are lost. Delivered jobs are unaffected (they are gone). | **Notification loss is possible.** This is a known limitation. |
| **Redis restart** (data persisted) | BullMQ recovers the queue. Stalled jobs are retried. | Automatic. |
| **Redis restart** (no persistence) | Same as data loss. | **Documentation must warn: enable Redis persistence (`AOF` or `RDB`) in production.** |
| **Redis full** (`maxmemory` reached) | `notify()` throws `OOM command not allowed` error. | User must increase `maxmemory` or enable `maxmemory-policy allkeys-lru` (with caveat: LRU may evict pending jobs). |

**Critical documentation requirement:** The README must state clearly:

> "NotifyKit uses your Redis as a durable queue. Enable Redis persistence (`appendonly yes`) in production. If Redis is lost, pending notifications are lost. Delivered notifications are not NotifyKit's responsibility — they are already delivered."

---

#### A.7 The "Good Citizen" Rules

Because NotifyKit uses the user's Redis (which they share with their own app), it must follow strict rules to avoid disrupting their infrastructure.

| Rule | Reason |
| :--- | :--- |
| **Only use the `bull:notifykit:*` namespace.** | Never collide with the user's keys. |
| **Never run `KEYS *`, `SCAN *`, or `FLUSHDB`.** | These operations block Redis and can delete the user's data. |
| **Never change Redis server configuration.** | NotifyKit is a guest, not an admin. |
| **Never use `SELECT` to switch databases.** | Use Redis DB 0 (the default), like every BullMQ user. |
| **Use a dedicated `ioredis` connection per process, not per queue.** | One connection serves all four queues. Reduces connection overhead. |
| **Close the Redis connection on `stopWorker()` and process exit.** | Never leak connections. |
| **Document the `maxRetriesPerRequest` setting (BullMQ requires `null`).** | BullMQ blocks indefinitely on `BRPOPLPUSH`; the ioredis client must be configured with `maxRetriesPerRequest: null`. |
| **Never exceed the user's `maxmemory` by design.** | Retention limits (A.4.2) prevent unbounded growth. |
| **Never use Redis Pub/Sub for internal signaling.** | BullMQ already handles events; adding Pub/Sub would mix concerns. |

These rules are enforced by code review and by an ESLint custom rule (future) that greps for forbidden Redis commands.

---

#### A.8 The v1.1 MongoDB Trigger (Explicit Criteria)

The v1.1 roadmap mentions an optional MongoDB adapter. This section defines the **exact criteria** that must be met before it is built, so it is not added prematurely.

**The MongoDB adapter (`@notifykit/mongo-log`) will be built ONLY when ALL of these are true:**

1. **≥ 100 users have requested persistent delivery history** (via GitHub issues, npm comments, or community channels).
2. **≥ 10 users have asked for it specifically by name** (MongoDB, not "a database").
3. **The BullMQ `completed` queue is proven insufficient** for post-mortem debugging in at least 3 real-world cases.
4. **The adapter can be built as a peer package** that adds MongoDB as a `peerDependency` — never bundled in core.
5. **The adapter respects the stateless principle** — it writes to the user's own MongoDB instance, not to any NotifyKit-owned database.

**What the adapter will do (when built):**

- Listen to BullMQ `completed` and `failed` events.
- Write a delivery record to the user's MongoDB.
- Record schema: `{ jobId, channel, provider, recipient, status, deliveredAt, error?, traceId }`.
- Never block delivery — writes are fire-and-forget (async, with its own retry).

**What the adapter will NOT do:**

- ❌ Store templates.
- ❌ Store user preferences.
- ❌ Become a source of truth for job state.
- ❌ Replace BullMQ.

**Until all five criteria are met, the answer to "can I persist delivery logs?" is: "Configure the BullMQ `completed` retention to a higher value, or consume the `QueueEvents` stream in your own code."**

---

#### A.9 Why No PostgreSQL / MySQL / SQLite in v1

An honest evaluation of why the other common databases are excluded:

| Database | Why Not |
| :--- | :--- |
| **PostgreSQL** | Overkill for job queueing. Would require the user to provision a Postgres instance (or add one), run migrations, and manage schema versioning. BullMQ + Redis is simpler and faster. Postgres also has higher operational overhead than Redis for this use case. |
| **MySQL** | Same as Postgres. Also, the Node.js MySQL ecosystem is less ergonomic than the Postgres one. |
| **SQLite** | Single-writer bottleneck. Cannot serve as a job queue for a server process under load. Also, SQLite on networked filesystems is unreliable. |
| **MongoDB** | Would be the *only* DB if any were included — but the reasoning in A.8 applies: it is not needed for v1, and adding it as an optional peer package is the correct path. |
| **DynamoDB / Firestore** | Tied to a specific cloud. Violates the vendor-neutral principle. |
| **Embedded (LevelDB, LMDB)** | Not suitable for multi-process or multi-machine deployments. Would lock users into single-process setups. |

**Conclusion:** Redis (via BullMQ) is the correct and only state layer for v1. It is simple, fast, user-owned, and requires no schema management.

---

#### A.10 Compatibility with the User's Own Database

**Important clarification (worth stating explicitly):** NotifyKit is **fully compatible** with any database the user already has. It simply **does not use it**.

| User's existing setup | NotifyKit's interaction |
| :--- | :--- |
| **User has MongoDB** | NotifyKit does not touch it. MongoDB is used by their app; NotifyKit uses their Redis. |
| **User has PostgreSQL** | Same — NotifyKit ignores it. |
| **User has MySQL** | Same. |
| **User has no database** | Fine — NotifyKit requires only Redis. |
| **User uses Redis for their app's caching** | Fine — NotifyKit uses a `notifykit:*` key namespace that does not collide. |
| **User has no Redis** | NotifyKit cannot function. The user must provision Redis (Docker, Upstash, Redis Cloud, or their own). |

**The wizard (`npx notifykit init`) should ask:** "Where is your Redis?" and provide options:
- I have a Redis URL → prompt for it
- I use Docker → provide a `docker run` snippet
- I use a cloud provider → link to Upstash / Redis Cloud / Railway

**The wizard MUST NOT ask about MongoDB, Postgres, or any other database.** Those are out of scope for NotifyKit.

---

### 14. Testing Architecture

#### 14.1 Test Pyramid

```
        ┌──────────────┐
        │   E2E (5%)   │   Real Redis + mock providers via Testcontainers
        ├──────────────┤
        │Integration   │   Worker + queue + adapter contract tests (25%)
        │    (25%)     │
        ├──────────────┤
        │ Unit tests   │   Orchestrator, config, templates, adapters (70%)
        │    (70%)     │
        └──────────────┘
```

#### 14.2 Test Types

| Type | Tool | Scope |
| :--- | :--- | :--- |
| **Unit** | Vitest | Orchestrator logic, template rendering, config validation |
| **Adapter contract** | Vitest + shared test suite | Every adapter runs the same contract tests |
| **Integration** | Testcontainers + real Redis | BullMQ enqueue → worker → mock adapter |
| **Wizard** | Vitest + `execa` | Simulated prompts, `.env` writes, install invocations |
| **E2E (optional)** | Real Redis + real Twilio test account (daily) | One live SMS per day |

#### 14.3 Adapter Contract Test Suite

Every adapter must pass the same test suite (provided by the core as `@notifykit/test-utils`):

- `sendSms()` returns `{ success: boolean }`
- Invalid options return `{ success: false, retryable: false }`
- Network errors return `{ success: false, retryable: true }`
- No credential leaks in error messages

**Why?** This guarantees that any adapter — official or community — behaves consistently. A new adapter author can validate their work in minutes.

---

### 15. Build, Packaging & Distribution

#### 15.1 Build Output

- **Format:** Dual (ESM + CJS) via `tsup`.
- **Types:** `.d.ts` generated for both.
- **Tree-shakable:** `sideEffects: false` in `package.json`.
- **Bundler compatibility:** No `require()` of dynamic module names (breaks Webpack).

#### 15.2 `package.json` Exports

```json
{
  "name": "notifykit",
  "type": "module",
  "sideEffects": false,
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
  "files": ["dist", "README.md", "LICENSE"]
}
```

#### 15.3 Distribution Channels

| Channel | Purpose |
| :--- | :--- |
| **npm registry** | Primary distribution (public, free) |
| **GitHub Releases** | Changelog, source tag |
| **Docs site** (GitHub Pages / Vercel) | Guides, examples |
| **Example repo** | `notifykit-examples` — 4 examples (email-only, sms-only, both, CI mode) |

#### 15.4 Bundle Size Budget

| Package | Budget |
| :--- | :--- |
| `notifykit` (core) | ≤ 60 KB minified |
| Each adapter | ≤ 10 KB minified |
| `notifykit-cli` | ≤ 200 KB minified (not shipped at runtime) |

**Enforced in CI** via `size-limit`.

---

### 16. Versioning & Release Strategy

#### 16.1 Semantic Versioning

- **Core and adapters version independently.**
- Adapters declare a **compatible core range** via `peerDependencies`: `"notifykit": "^1.0.0"`.
- Breaking changes to `interfaces/` → **major version bump** on core; adapters follow.

#### 16.2 Release Channels

| Channel | npm tag | Purpose |
| :--- | :--- | :--- |
| Stable | `latest` | Production |
| Beta | `beta` | Early adopters |
| Canary | `canary` | Nightly, from `main` |

#### 16.3 Release Process

1. Changeset added to PR.
2. On merge to `main`, GitHub Actions builds and runs full test suite.
3. Changesets bot opens a version PR.
4. Maintainer merges → npm publish with provenance (`--provenance`).
5. Git tag created; release notes auto-generated.

**Provenance is mandatory** (npm's supply-chain attestation) — it proves the package was built from this repo's CI, not from a maintainer's laptop.

---

### 17. Performance & Scaling Considerations

#### 17.1 Core Library Overhead

| Operation | Budget |
| :--- | :--- |
| `createNotifier()` | < 50 ms (init time) |
| `notify()` (enqueue only) | < 10 ms |
| Template render | < 5 ms per template |
| Memory footprint | < 30 MB (excluding Redis) |

#### 17.2 Scaling Model

**Horizontal scaling:** The user runs multiple instances of their app; each instance creates its own BullMQ worker. BullMQ's Redis-based locking ensures each job is processed exactly once.

**Vertical scaling:** Increase `concurrency` per worker in config.

**High-volume guidance:**

- Redis Cluster supported via `ioredis` cluster mode.
- For > 10K notifications/minute, user should split channels across processes.
- Documentation provides sizing guidance (e.g., "1 worker with concurrency 5 handles ~50 SMS/sec against Twilio").

#### 17.3 Known Bottlenecks

| Bottleneck | Why | Mitigation |
| :--- | :--- | :--- |
| **Template rendering** | Handlebars CPU | Rendered at enqueue; not per-retry |
| **Redis connection per process** | Connection overhead | Single shared ioredis instance per process |
| **Adapter SDK latency** | Twilio API ~200 ms | Worker concurrency absorbs it |

---

### 18. Deployment Topology (User Side)

NotifyKit does not have its own deployment. The **user's** deployment looks like this:

```
┌─────────────────────────────────────────────────────┐
│               User's Node.js App (Container)         │
│                                                     │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐   │
│  │HTTP server  │  │Orchestrator│  │BullMQ worker│   │
│  │(Express)    │  │  (inproc)  │  │  (inproc)   │   │
│  └─────────────┘  └────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────┘
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌──────────┐     ┌──────────────┐
    │ Redis  │◄─────┤ Same app │     │ Provider APIs│
    │(external)│    └──────────┘     └──────────────┘
    └────────┘
```

**Recommended (production):** separate the HTTP server and BullMQ worker into **two processes** of the same Docker image, so they can scale independently.

The user can run:

- **All-in-one:** Single process (fine for small apps).
- **Split:** `web` container (HTTP) + `worker` container (BullMQ worker) sharing the same Redis.

The library supports both via the explicit `startWorker()` call.

---

### 19. Directory Structure

#### 19.1 Monorepo Layout

```
notifykit/                        # git monorepo
├── packages/
│   ├── core/                     # notifykit
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── interfaces/
│   │   │   ├── config/
│   │   │   ├── templates/
│   │   │   ├── orchestrator/
│   │   │   ├── queue/
│   │   │   └── logging/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                      # notifykit-cli
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prompts/
│   │   │   ├── env-writer.ts
│   │   │   ├── installer.ts
│   │   │   └── validator.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── adapter-nodemailer/       # @notifykit/adapter-nodemailer
│   ├── adapter-twilio/           # @notifykit/adapter-twilio
│   ├── adapter-msg91/            # @notifykit/adapter-msg91
│   ├── adapter-fcm/              # @notifykit/adapter-fcm
│   └── test-utils/               # @notifykit/test-utils (contract test suite)
│
├── examples/
│   ├── email-only/
│   ├── sms-only/
│   ├── both-channels/
│   └── ci-mode/
│
├── docs/
│   ├── getting-started.md
│   ├── architecture.md           # ← this document
│   ├── adapters.md
│   └── troubleshooting.md
│
├── .changeset/
├── pnpm-workspace.yaml            # or npm workspaces
├── turbo.json                     # optional, for build caching
└── README.md
```

**Monorepo tooling:** npm workspaces (simplest, no extra tools for users) or pnpm + Turborepo (faster builds). Decision deferred to build phase.

---

### 20. Architectural Decision Records (ADRs) — includes ADR-001 through ADR-011

#### ADR-001: Modular Monolith over Microservices

- **Decision:** Build the core as a modular monolith.
- **Reason:** Libraries must be single packages; microservices require infrastructure the user won't run.
- **Consequence:** Enforce module boundaries via ESLint to prevent drift.

#### ADR-002: BullMQ + Redis for Reliability

- **Decision:** Use BullMQ with the user's Redis.
- **Reason:** Provides durable retries without NotifyKit owning infrastructure.
- **Consequence:** User must have Redis. Documented clearly.

#### ADR-003: Adapters Injected, Not Imported

- **Decision:** The core never imports adapter packages; users inject them.
- **Reason:** Keeps core vendor-free; enables tree-shaking; simplifies testing.
- **Consequence:** Slightly more verbose user code (`new TwilioSmsProvider()`).

#### ADR-004: Render Templates at Enqueue Time

- **Decision:** Store rendered body in the job payload.
- **Reason:** Fail-fast on template errors; worker stays cheap.
- **Consequence:** If a template changes after enqueue, in-flight jobs use the old render (acceptable; notifications are point-in-time).

#### ADR-005: Explicit `startWorker()`, Not Implicit

- **Decision:** Worker must be started explicitly by the user.
- **Reason:** No side effects on import; respects testing and deployment topology.
- **Consequence:** Users must remember to call `startWorker()`. Documented in every example.

#### ADR-006: MIT License for Core

- **Decision:** MIT.
- **Reason:** Maximum adoption; developers trust permissive licenses.
- **Consequence:** Cannot prevent forking. Business model relies on premium features, not license control.

#### ADR-007: No `postinstall` Wizard

- **Decision:** Wizard invoked via `npx notifykit init`.
- **Reason:** npm v12 disables install scripts by default; interactive prompts break CI.
- **Consequence:** Users must run one extra command. Documented prominently.

#### ADR-008: Pino for Logging

- **Decision:** Pino everywhere; `console.log` forbidden via ESLint.
- **Reason:** Structured logs, redaction, and low overhead.
- **Consequence:** All contributors must use the shared logger.

---


---

#### ADR-009: Redis-Only State — No Database in v1

**Status:** Accepted

**Context:** NotifyKit is a library distributed via npm to developers. It must be installable in seconds, require no migrations, and impose no infrastructure burden beyond what the user already has.

**Decision:** NotifyKit will use **only Redis** (owned by the user) as its state layer. It will not require a relational database, document store, object store, or any other persistence layer in v1.

**Rationale:**

- Redis is already required for BullMQ.
- Adding a database would require the user to provision, configure, and maintain it.
- Schema migrations would create a maintenance burden for both the user and the maintainer.
- The "no database" promise is a key differentiator against heavier platforms (Novu, Courier).
- Any persistence beyond job queuing (e.g., delivery logs) can be added as an **optional peer package** in a future version.

**Consequences:**

- ✅ Zero infrastructure burden for users.
- ✅ Installable in seconds.
- ✅ Easy to test (Testcontainers only needs Redis).
- ⚠️ Users who want persistent delivery history must build it themselves (or wait for `@notifykit/mongo-log` in v1.1).
- ⚠️ If Redis is lost, pending jobs are lost. Mitigated by documenting Redis persistence requirements (A.6).

**Alternatives considered:**

- **PostgreSQL:** Rejected — overkill, requires migrations, slower for queuing.
- **MongoDB:** Rejected for v1 — no clear need; correct path is an optional peer package.
- **SQLite:** Rejected — single-writer bottleneck, unsuitable for server processes.

---

#### ADR-010: API-First — Dual-Surface Versioning Discipline

**Status:** Accepted

**Context:** NotifyKit exposes a library API today and may expose an HTTP API in the future. Both are "APIs" but with different consumers, different versioning strategies, and different contract-testing needs. Without a clear discipline, the two surfaces could drift apart.

**Decision:** NotifyKit commits to **API-first design for both surfaces**:

1. **Library API:** Versioned by npm semver, contract-tested via `vitest` + `expectTypeOf`, with strict deprecation policy (one major release of overlap).
2. **HTTP API (v1.1):** Specified by OpenAPI 3.1, validated in CI, versioned by URL prefix (`/v1/`, `/v2/`), with 6-month deprecation window.
3. **Shared error envelope:** Both surfaces use the same error shape (`code`, `message`, `hint`, `traceId`).
4. **Stable error codes:** Codes like `E_INVALID_EVENT` never change meaning.

**Rationale:**

- Predictability is the most valuable property of a developer tool.
- A stable error envelope makes debugging trivial (users can search for `E_INVALID_EVENT`).
- Contract testing catches accidental breaking changes before publish.
- OpenAPI-first prevents the HTTP API from becoming "whatever the code happened to do."

**Consequences:**

- ✅ Every public API change is a deliberate, documented decision.
- ✅ Users can rely on error codes in their own code.
- ✅ HTTP API (when built) can be consumed from any language.
- ⚠️ Maintenance burden: every breaking change requires a major version bump across core and all adapters.
- ⚠️ HTTP API deferred to v1.1 — v1 focuses on library API excellence.

**Alternatives considered:**

- **Ad-hoc versioning:** Rejected — leads to broken clients and unhappy users.
- **Header-based HTTP versioning:** Rejected — harder to debug than URL prefix.
- **No contract tests:** Rejected — the whole point is to catch breaking changes early.

---

#### ADR-011: `@notifykit/http` Deferred to v1.1

**Status:** Accepted

**Context:** Some notification libraries ship an HTTP endpoint out of the box. Should NotifyKit do the same in v1?

**Decision:** No. The HTTP API is deferred to v1.1, to be shipped as a **separate package** (`@notifykit/http`), not folded into core.

**Rationale:**

1. **v1 focus:** The library API is the primary artifact. Splitting effort across two surfaces would compromise both.
2. **Auth is non-trivial:** A public HTTP endpoint requires authentication, rate limiting, and abuse prevention — all out of scope for v1.
3. **Separate deployment:** The HTTP server runs as a service; the library runs in-process. Different deployment stories should ship in different packages.
4. **Avoid opinionated dependencies:** HTTP requires Express or Fastify. Users should choose their own framework when integrating.
5. **Demand not yet proven:** If library users ask for HTTP, that validates the investment. Building it speculatively may waste effort.

**Consequences:**

- ✅ Core stays lean (no Express dependency).
- ✅ v1 ships faster and with higher quality.
- ⚠️ Non-Node.js clients cannot use NotifyKit in v1. (Acceptable — v1 targets Node.js developers specifically.)
- ⚠️ Users who want an HTTP trigger must build it themselves (a ~30-line Express wrapper).

**Trigger to build:**

- ≥ 20 users request language-agnostic access.
- ≥ 5 users specifically ask for HTTP for non-Node clients.
- Core library reaches ≥ 1,000 weekly downloads.

**Alternatives considered:**

- **Ship HTTP in v1:** Rejected — scope creep, auth complexity, deployment overhead.
- **Ship HTTP as a wrapper around core in v1:** Same problems, deferred to v1.1.
- **Never ship HTTP:** Rejected — clear future need for polyglot environments.

---

### 21. Non-Functional Requirements

| Category | Requirement | Target |
| :--- | :--- | :--- |
| **Performance** | `notify()` latency | < 10 ms (p99) |
| **Performance** | Template render | < 5 ms (p99) |
| **Reliability** | At-least-once delivery | Guaranteed via BullMQ |
| **Reliability** | Retry on transient failure | 3 attempts, exponential backoff |
| **Reliability** | DLQ for terminal failures | 100% of failed jobs after retries |
| **Scalability** | Concurrent jobs per worker | Configurable (default 5–10) |
| **Scalability** | Redis Cluster | Supported |
| **Security** | Credential redaction | 100% of Pino logs |
| **Security** | Zero telemetry | No phone-home in v1 |
| **Compatibility** | Node.js versions | 20, 22, 24 (LTS + current) |
| **Compatibility** | ESM + CJS | Both |
| **Compatibility** | TypeScript | Strict mode, full types |
| **Maintainability** | Test coverage | ≥ 85% lines (core) |
| **Maintainability** | Adapter contract tests | 100% of official adapters |
| **Observability** | Structured logs | 100% of code paths |
| **Bundle size** | Core | ≤ 60 KB minified |

---

### 22. Future Evolution (v1.1 → v2)

#### v1.1 (Post-launch)

- Optional **MongoDB delivery-log adapter** (user-supplied connection string).
- **Prometheus metrics exporter**.
- **OpenTelemetry tracing** hook.
- **Idempotency keys** in `notify()`.
- **Additional providers**: Resend, SES, Plivo, Telnyx.

#### v1.5

- **Webhook delivery status tracking** (per job).
- **Template versioning** with rollback.
- **User preference engine** (opt-in/out, digests).
- **Scheduled notifications** (send at a future time).

#### v2.0 (Commercial tier)

- **Hosted control plane** (dashboard for templates + analytics) — sending still in user infra.
- **Multi-tenant support** (per-tenant configs).
- **Visual workflow builder** (optional GUI that compiles to code).
- **Enterprise SSO and audit logs**.

---

### 23. Glossary

| Term | Definition |
| :--- | :--- |
| **Adapter** | A package implementing a provider interface (e.g., `TwilioSmsProvider`) |
| **Orchestrator** | The module that validates events and enqueues jobs |
| **Producer** | The part of BullMQ that adds jobs to the queue |
| **Worker** | The part of BullMQ that processes jobs |
| **DLQ** | Dead-letter queue — where jobs go after exhausting retries |
| **Trace ID** | UUID correlating all logs for one `notify()` call |
| **Modular monolith** | A single deployable with strict internal module boundaries |
| **Peer dependency** | A dependency the user installs explicitly, not bundled by the parent |
| **Tree-shaking** | Build optimization that removes unused code |
| **Provenance** | npm's supply-chain proof that a package was built from CI |

---



### Merge Notes for v1.1

- The database/state strategy and API-first principles from `ARCHITECTURE-ADDENDUM.md` have been integrated into Sections 13.5 and 10.5, respectively. ADR-009 through ADR-011 have been added to Section 20.
- The addendum's Part D contains implementation-task and release-gate changes for `PHASES.md`; those changes are intentionally not inserted into this architecture document because they belong in the phase plan.
- **Review required before implementation — Redis namespace:** the addendum uses both `notifykit:*` and `bull:notifykit:*` to describe the Redis namespace. The Redis key table and BullMQ prefix use `bull:notifykit:*`; the intended namespace should be confirmed and made consistent. The retention table also names queues as `notifykit:email`, `notifykit:sms`, and `notifykit:push`, while the key table uses the `bull:notifykit:<channel>:...` prefix.
- **Review required before implementation — idempotency scope:** the original Section 22 says “Idempotency keys in `notify()`” for v1.1, while the addendum specifies idempotency for the v1.1 HTTP API only and explicitly excludes it from the v1 library. Confirm which statement is authoritative before implementing v1.1.
- **Placement clarification:** the source addendum referred to a “Core Library Specification” as Section 10, but the current Architecture v1.0 labels Section 10 “Error Handling & Retry Strategy.” API-first principles were therefore inserted as Section 10.5 after the existing Section 10, preserving existing section numbering.

**End of Architecture Document v1.1**




---

# 3. Implementation Phases & Build Flow v1.0

## 🗺️ NotifyKit — Implementation Phases & Build Flow

**Document Version:** 1.0
**Status:** Complete
**Companion Documents:** PRD v1.0, Architecture v1.0
**Last Updated:** October 2026
**Purpose:** The complete, ordered execution plan for building NotifyKit — phase by phase, task by task, with dependencies, deliverables, acceptance criteria, and estimated effort.

---

### Table of Contents

1. How to Read This Document
2. Phase Overview & Timeline
3. Phase Dependency Graph
4. The Critical Path
5. Assumptions & Effort Model
6. Phase 0 — Foundation & Tooling
7. Phase 1 — Provider Interfaces & Config
8. Phase 2 — Template Engine
9. Phase 3 — Queue Layer (BullMQ Producer)
10. Phase 4 — Orchestrator
11. Phase 5 — BullMQ Worker
12. Phase 6 — First Adapter (Nodemailer)
13. Phase 7 — Second Adapter (Twilio)
14. Phase 8 — Third Adapter (MSG91)
15. Phase 9 — Fourth Adapter (FCM)
16. Phase 10 — CLI Setup Wizard
17. Phase 11 — Test Utils & Adapter Contract Suite
18. Phase 12 — Documentation & Examples
19. Phase 13 — Hardening, Security & Performance
20. Phase 14 — Release & Launch
21. Phase 15 — Post-Launch (v1.1)
22. Phase 16 — Commercial Tier (v1.5+)
23. Release Gates (Go / No-Go Criteria)
24. Risk Register by Phase
25. Effort Summary Table

---

### 1. How to Read This Document

Each phase is a self-contained unit of work with:

| Field | Meaning |
| :--- | :--- |
| **Objective** | The single outcome this phase delivers |
| **Depends On** | Phases that must be complete before this one starts |
| **Scope** | What is in scope (and explicitly what is not) |
| **Tasks** | Ordered, checkable work items |
| **Deliverables** | What exists at the end of the phase |
| **Definition of Done** | Acceptance criteria — the phase is not complete until every line passes |
| **Estimated Effort** | Person-days for a solo developer |
| **Risk** | What could go wrong in this phase |

**Effort model:** All estimates assume **one experienced TypeScript/Node.js developer working full-time**. If working part-time (evenings/weekends), multiply by 2.5–3×.

---

### 2. Phase Overview & Timeline

| Phase | Name | Effort | Cumulative (FT solo) |
| :--- | :--- | :--- | :--- |
| **0** | Foundation & Tooling | 2 days | 2 days |
| **1** | Provider Interfaces & Config | 3 days | 5 days |
| **2** | Template Engine | 2 days | 7 days |
| **3** | Queue Layer (Producer) | 3 days | 10 days |
| **4** | Orchestrator | 4 days | 14 days |
| **5** | BullMQ Worker | 3 days | 17 days |
| **6** | Nodemailer Adapter | 3 days | 20 days |
| **7** | Twilio Adapter | 2 days | 22 days |
| **8** | MSG91 Adapter | 3 days | 25 days |
| **9** | FCM Adapter | 3 days | 28 days |
| **10** | CLI Setup Wizard | 6 days | 34 days |
| **11** | Test Utils & Contract Suite | 3 days | 37 days |
| **12** | Docs & Examples | 4 days | 41 days |
| **13** | Hardening & Security | 4 days | 45 days |
| **14** | Release & Launch | 3 days | 48 days |
| **Total to v1.0 Public Launch** | | **~48 days** | **~7 weeks** |

**Post-launch:**

| Phase | Name | Effort |
| :--- | :--- | :--- |
| **15** | v1.1 Features | 3–4 weeks |
| **16** | Commercial Tier (v1.5+) | 6–8 weeks |

**Realistic calendar estimate for a solo full-time dev:** **8–10 weeks to public launch**, accounting for learning, iteration, and real-world slippage.

---

### 3. Phase Dependency Graph

```
┌─────────────┐
│  Phase 0    │  Foundation & Tooling
│  (monorepo) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Phase 1    │  Interfaces & Config
│  (contracts)│
└──────┬──────┘
       │
       ├─────────────────────────────┐
       ▼                             ▼
┌─────────────┐              ┌─────────────┐
│  Phase 2    │              │  Phase 3    │
│  Templates  │              │ Queue (Prod)│
└──────┬──────┘              └──────┬──────┘
       │                            │
       └────────────┬───────────────┘
                    ▼
             ┌─────────────┐
             │  Phase 4    │  Orchestrator
             │  (the brain)│
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │  Phase 5    │  BullMQ Worker
             └──────┬──────┘
                    │
        ┌───────────┼───────────┬──────────┐
        ▼           ▼           ▼          ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Phase 6  │ │ Phase 7  │ │ Phase 8  │ │ Phase 9  │
  │Nodemailer│ │  Twilio  │ │  MSG91   │ │   FCM    │
  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
       │            │            │            │
       └────────────┴─────┬──────┴────────────┘
                          ▼
                  ┌─────────────┐
                  │  Phase 11   │  Test Utils & Contract Suite
                  └──────┬──────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Phase 10 │    │ Phase 12 │    │ Phase 13 │
  │   CLI    │    │  Docs    │    │ Hardening│
  └────┬─────┘    └────┬─────┘    └────┬─────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
                 ┌───────────┐
                 │ Phase 14  │  Release & Launch 🚀
                 └─────┬─────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        ┌──────────┐      ┌──────────┐
        │ Phase 15 │      │ Phase 16 │
        │  (v1.1)  │      │ (v1.5+)  │
        └──────────┘      └──────────┘
```

**Parallelizable work:**
- Phases 6–9 (adapters) can be built in parallel once Phase 5 is done.
- Phase 10 (CLI) can start once Phase 1 is done (it needs the interface metadata) but realistically after Phase 6.
- Phase 12 (docs) can be drafted incrementally from Phase 4 onward.

---

### 4. The Critical Path

The **critical path** (the sequence that cannot be shortened without changing dependencies) is:

```
Phase 0 → Phase 1 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 11 → Phase 14
```

**Meaning:**
- **Phases 0, 1, 3, 4, 5 are strictly sequential** — each is the foundation of the next.
- **Phase 6 (Nodemailer) is the first "vertical slice"** — the first point where end-to-end delivery works. **Do not move past Phase 6 until a real email is delivered from a real script.**
- **Phase 11 (contract suite) must precede release** — without it, adapters can silently diverge.
- **Phases 2 (templates) and 7–9 (other adapters)** can be scheduled in parallel to the critical path if you have help.

**Strategic advice:** **Ship the vertical slice first.** Phases 0 → 6 produce a working email-only library. That is a shippable artifact you could demo, get feedback on, and even soft-launch. Everything after is expansion.

---

### 5. Assumptions & Effort Model

| Assumption | Detail |
| :--- | :--- |
| **Solo developer** | One experienced TS/Node dev, full-time |
| **No external dependencies** | You are not waiting on APIs, partnerships, or reviews |
| **Provider test accounts available** | Twilio trial, MSG91 trial, Gmail SMTP, FCM project |
| **Redis running locally** | Via Docker |
| **No interruptions** | Ideal case; add 25–30% buffer for real life |
| **Familiarity with BullMQ** | If not, add 2–3 days of learning to Phase 3 |

---

### 6. Phase 0 — Foundation & Tooling

**Objective:** A working monorepo with TypeScript, linting, testing, and CI — so that every subsequent phase builds on solid ground.

**Depends On:** Nothing.

**Scope:**
- ✅ npm workspaces (or pnpm workspaces) monorepo
- ✅ TypeScript strict configuration shared across packages
- ✅ ESLint with `import/no-cycle`, `no-console`, strict rules
- ✅ Prettier
- ✅ Vitest configured per package
- ✅ GitHub Actions CI (lint + typecheck + test on Node 20/22/24)
- ✅ Changesets for versioning
- ✅ `size-limit` config (budget enforcement)
- ✅ Basic `README.md` skeleton

**Not in Scope:**
- ❌ Any business logic
- ❌ Any adapter code
- ❌ Documentation site

**Tasks:**

- [ ] Create GitHub repo `notifykit`
- [ ] Initialize monorepo with `packages/` directory
- [ ] Add `pnpm-workspace.yaml` (or npm `workspaces` in root `package.json`)
- [ ] Create shared `tsconfig.base.json` (strict, `moduleResolution: bundler`, `target: ES2022`)
- [ ] Create `packages/core/package.json` with correct `exports` map
- [ ] Create `packages/cli/package.json` skeleton
- [ ] Create `packages/test-utils/package.json` skeleton
- [ ] Install ESLint + Prettier + plugins
- [ ] Configure `import/no-cycle` and `no-console`
- [ ] Configure Vitest with coverage thresholds (85%)
- [ ] Configure `tsup` for dual ESM+CJS output
- [ ] Add `size-limit` with core budget (60 KB)
- [ ] Create GitHub Actions workflow `.github/workflows/ci.yml`
- [ ] Configure Changesets (`.changeset/config.json`)
- [ ] Add `LICENSE` (MIT)
- [ ] Add `.gitignore` (node_modules, dist, .env, coverage)
- [ ] Add `CONTRIBUTING.md` (basic)
- [ ] Verify CI passes on an empty commit

**Deliverables:**
- Working monorepo
- Green CI on the main branch
- All packages have a buildable (empty) `dist`

**Definition of Done:**
- [ ] `pnpm -r build` succeeds
- [ ] `pnpm -r test` succeeds
- [ ] `pnpm -r lint` succeeds
- [ ] CI is green
- [ ] A trivial `export const hello = () => 'world'` in core builds, tests, and lints correctly

**Estimated Effort:** 2 days

**Risk:** Over-engineering the tooling. **Mitigation:** Timebox to 2 days. If pnpm+Turborepo feels heavy, downgrade to npm workspaces alone.

---

### 7. Phase 1 — Provider Interfaces & Config

**Objective:** Define the complete type contracts (`EmailProvider`, `SmsProvider`, `PushProvider`, `NotificationEvent`, `ProviderResult`) and the Zod-validated config loader.

**Depends On:** Phase 0.

**Scope:**
- ✅ `interfaces/` module: all types and interfaces
- ✅ `config/` module: env loader + Zod validation
- ✅ Unit tests for config validation
- ✅ Public type exports from `dist/interfaces`

**Not in Scope:**
- ❌ Adapter implementations
- ❌ Any runtime behavior (orchestration)

**Tasks:**

**Interfaces module:**
- [ ] `interfaces/recipient.ts` — `Recipient { email?, phone?, pushToken? }`
- [ ] `interfaces/event.ts` — `NotificationEvent { to, channels, template, data }`
- [ ] `interfaces/providers.ts` — `EmailProvider`, `SmsProvider`, `PushProvider`
- [ ] `interfaces/result.ts` — `ProviderResult { success, messageId?, error?, retryable?, retryAfterMs? }`
- [ ] `interfaces/config.ts` — `NotifierConfig`, `ProviderConfig`
- [ ] `interfaces/adapter-metadata.ts` — `AdapterMetadata { name, channel, requiredEnv }`
- [ ] `interfaces/index.ts` — re-export all
- [ ] Write TSDoc comments on every public interface

**Config module:**
- [ ] Zod schema for `.env` variables (per provider)
- [ ] `loadConfig()` reading `process.env`
- [ ] `validateConfig()` producing typed config or throwing
- [ ] Redaction paths constant (`['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*']`)
- [ ] Unit tests: valid config, missing required var, malformed value

**Package exports:**
- [ ] Update `packages/core/package.json` exports to include `./interfaces`
- [ ] Verify `import type { SmsProvider } from 'notifykit/interfaces'` resolves from an external test project

**Deliverables:**
- Fully typed `interfaces/` module with zero runtime dependencies
- Fully typed `config/` module with Zod validation
- Both modules are independently testable

**Definition of Done:**
- [ ] `import type { SmsProvider } from 'notifykit/interfaces'` works in a fresh project
- [ ] Missing `TWILIO_AUTH_TOKEN` with `type: 'twilio'` throws a clear error at `createNotifier()` time
- [ ] Test coverage of config module ≥ 90%
- [ ] Zero imports from `interfaces/` to any other internal module

**Estimated Effort:** 3 days

**Risk:** Getting the interface **wrong** is expensive (it's a breaking change later). **Mitigation:** Before writing code, write 3 example adapters in a notebook: what would Twilio, Nodemailer, and FCM need? Design the interface so all three fit naturally without leaking vendor-specific fields.

---

### 8. Phase 2 — Template Engine

**Objective:** A Handlebars-based template renderer with caching and validation.

**Depends On:** Phase 1.

**Scope:**
- ✅ `templates/` module
- ✅ In-memory registration
- ✅ Filesystem loading (optional)
- ✅ Handlebars helpers (basic: `formatDate`, `uppercase`)
- ✅ Validation of missing variables
- ✅ Unit tests

**Not in Scope:**
- ❌ Template versioning (v1.1)
- ❌ Template from database (v1.1)

**Tasks:**

- [ ] `templates/render.ts` — `renderTemplate(source, data): string`
- [ ] `templates/store.ts` — `TemplateStore` class (register, get, has)
- [ ] `templates/helpers.ts` — basic Handlebars helpers
- [ ] `templates/errors.ts` — `MissingTemplateError`, `MissingVariableError`
- [ ] Unit tests: render simple, render missing var, render invalid syntax
- [ ] Performance test: render 1,000 templates < 5s total

**Deliverables:**
- `TemplateStore` usable directly via `notifier.registerTemplate()`

**Definition of Done:**
- [ ] Rendering a template with `{{name}}` and `{ name: 'John' }` produces `John`
- [ ] Missing template throws `MissingTemplateError` at enqueue time (fail-fast)
- [ ] Missing variable throws `MissingVariableError` at enqueue time
- [ ] Render performance meets < 5ms per template (p99)
- [ ] Coverage ≥ 90%

**Estimated Effort:** 2 days

**Risk:** Handlebars is synchronous and CPU-bound. **Mitigation:** Keep it out of the worker (already decided in ADR-004). If v1.1 needs streaming templates, revisit.

---

### 9. Phase 3 — Queue Layer (BullMQ Producer)

**Objective:** Enqueue jobs to BullMQ using the user's Redis, with proper typing and error handling.

**Depends On:** Phase 1.

**Scope:**
- ✅ `queue/` module (producer half only — worker is Phase 5)
- ✅ `enqueueJob()` API
- ✅ Queue registry (one queue per channel)
- ✅ ioredis connection factory (single instance per process)
- ✅ Job payload type
- ✅ Retry policy constants
- ✅ Unit tests with `ioredis-mock` (or Testcontainers Redis)

**Not in Scope:**
- ❌ Worker processing (Phase 5)
- ❌ DLQ inspection UI

**Tasks:**

- [ ] `queue/connection.ts` — `createRedisConnection(config)` returning a shared `ioredis` instance
- [ ] `queue/registry.ts` — `QueueRegistry` managing `email`, `sms`, `push`, `dlq` queues
- [ ] `queue/payload.ts` — `NotificationJob` type (from Architecture §8.2)
- [ ] `queue/enqueue.ts` — `enqueueJob(job, config): Promise<string>`
- [ ] `queue/retry-policy.ts` — default retry constants
- [ ] Graceful shutdown hook (`queue.close()`)
- [ ] Integration test: enqueue a job and verify it appears in Redis with the right key
- [ ] Integration test: two enqueues → two jobs in different queues

**Deliverables:**
- Working producer layer that can push jobs into Redis
- `QueueRegistry` handle used by orchestrator

**Definition of Done:**
- [ ] `enqueueJob()` returns a job ID within 10 ms (p99) in local test
- [ ] Queue name follows `notifykit:<channel>` convention
- [ ] Redis connection is shared across queues (verified via `CLIENT LIST`)
- [ ] `queue.close()` cleanly shuts down
- [ ] Testcontainers integration test passes in CI

**Estimated Effort:** 3 days

**Risk:** **You must understand BullMQ's retry semantics.** Do the BullMQ tutorial before starting. **Mitigation:** Read the BullMQ docs for `add()`, `backoff`, `removeOnComplete`, `removeOnFail` before writing code.

---

### 10. Phase 4 — Orchestrator

**Objective:** The `notify()` function — validates events, resolves channels, renders templates, and enqueues jobs.

**Depends On:** Phases 1, 2, 3.

**Scope:**
- ✅ `orchestrator/` module
- ✅ `notify(event)` implementation
- ✅ Event validation via Zod
- ✅ Channel → adapter mapping
- ✅ Trace ID generation (UUID v7)
- ✅ Pino logger integration (basic)

**Not in Scope:**
- ❌ Worker (Phase 5)
- ❌ Metrics (v1.1)

**Tasks:**

- [ ] `logging/logger.ts` — Pino instance with redaction
- [ ] `orchestrator/event-schema.ts` — Zod schema for `NotificationEvent`
- [ ] `orchestrator/validate.ts` — `validateEvent(event)` returning typed event or throwing
- [ ] `orchestrator/resolve.ts` — resolve `channels: ['email', 'sms']` to adapters
- [ ] `orchestrator/notify.ts` — main `notify()` function
- [ ] `index.ts` — `createNotifier()` factory returning `{ notify, registerTemplate, startWorker (stub) }`
- [ ] Trace ID propagation to log lines
- [ ] Unit tests: valid event → enqueued; invalid event → thrown; missing adapter → thrown
- [ ] Integration test: full path from `notify()` to a job in Redis

**Deliverables:**
- Public `createNotifier()` API usable in a script
- `notify()` enqueues jobs correctly

**Definition of Done:**
- [ ] `notify({ to: { email }, channels: ['email'], template: 'welcome', data: {} })` puts exactly one job in `notifykit:email` queue
- [ ] Invalid recipient (`{}`) throws `InvalidEventError`
- [ ] Requested channel with no adapter throws `MissingAdapterError`
- [ ] Every log line for a single `notify()` call shares one `traceId`
- [ ] `notify()` returns in < 10 ms (p99)
- [ ] Coverage ≥ 85%

**Estimated Effort:** 4 days

**Risk:** This is **the most important phase** — it is the brain of the product. **Mitigation:** Write the test suite **first** (TDD), then implement. Do not proceed until every edge case has a test.

---

### 11. Phase 5 — BullMQ Worker

**Objective:** The processing half — picks up jobs and calls adapters, with retries and DLQ handling.

**Depends On:** Phase 4.

**Scope:**
- ✅ `queue/worker.ts` — `startWorker()` implementation
- ✅ Adapter dispatch
- ✅ Retry-aware error classification
- ✅ DLQ routing
- ✅ Graceful shutdown

**Not in Scope:**
- ❌ Metrics (v1.1)

**Tasks:**

- [ ] `queue/worker.ts` — `Worker` instance per channel
- [ ] `queue/dispatch.ts` — map job → adapter call
- [ ] Error classification (retryable vs. not)
- [ ] On terminal failure: move to `notifykit:dlq` with original error
- [ ] `startWorker({ channels, concurrency })` API
- [ ] `stopWorker()` graceful shutdown
- [ ] Integration test: enqueue → worker picks up → mock adapter called → job removed
- [ ] Integration test: mock adapter throws retryable error → retries 3× → DLQ
- [ ] Integration test: mock adapter throws non-retryable → immediately DLQ

**Deliverables:**
- `notifier.startWorker()` works end-to-end with a mock adapter
- Full retry + DLQ behavior verified

**Definition of Done:**
- [ ] Enqueued job is processed by a mock adapter within 1s
- [ ] Transient failure is retried exactly 3 times with exponential backoff
- [ ] Terminal failure lands in `notifykit:dlq` with the original error in the job data
- [ ] Worker respects per-channel concurrency settings
- [ ] `stopWorker()` drains in-flight jobs before closing
- [ ] Integration tests pass in CI (Testcontainers)

**Estimated Effort:** 3 days

**Risk:** Worker lifecycle bugs (zombie jobs, infinite retries). **Mitigation:** Test the failure path **first** — most bugs hide there.

---

### 12. Phase 6 — First Adapter (Nodemailer) 🎯 **Vertical Slice**

**Objective:** The **first real, end-to-end notification delivery** — email via SMTP. **This is the phase where NotifyKit becomes a real product.**

**Depends On:** Phase 5.

**Scope:**
- ✅ `packages/adapter-nodemailer/` package
- ✅ `NodemailerEmailProvider implements EmailProvider`
- ✅ Metadata export
- ✅ SMTP config from env
- ✅ Unit tests with mocked SMTP
- ✅ **Manual integration test: send a real email**

**Not in Scope:**
- ❌ Published to npm yet (Phase 14)
- ❌ Other providers

**Tasks:**

- [ ] Scaffold `packages/adapter-nodemailer/`
- [ ] Add `nodemailer` as `peerDependency`
- [ ] `src/provider.ts` — `NodemailerEmailProvider` class
- [ ] `src/metadata.ts` — required env vars
- [ ] `src/index.ts` — exports
- [ ] Unit test: mocked `transporter.sendMail` returns success
- [ ] Unit test: mocked error with `code: 'EAUTH'` returns `{ retryable: false }`
- [ ] Unit test: mocked error with `code: 'ETIMEDOUT'` returns `{ retryable: true }`
- [ ] **Manual test script:** `examples/send-real-email.ts` — sends a real email via Gmail SMTP
- [ ] **Run the manual test and confirm inbox delivery**

**Deliverables:**
- Complete adapter package
- **A real email, in a real inbox, sent by NotifyKit**

**Definition of Done:**
- [ ] A script using `createNotifier()` + `NodemailerEmailProvider` sends a real email to a real address
- [ ] The email appears in the inbox within 30 seconds
- [ ] Auth failure is not retried (verified in test)
- [ ] Timeout is retried (verified in test)
- [ ] Adapter bundle < 10 KB (excluding nodemailer)

**Estimated Effort:** 3 days

**🏁 Strategic Milestone:** At the end of this phase you have **a working email notification library**. You can:
- Demo it to others
- Publish a v0.1.0 to npm (private beta)
- Start writing the README and getting early feedback
- Soft-launch on r/node or in a Discord to gauge interest

**Risk:** SMTP quirks (Gmail app passwords, TLS). **Mitigation:** Use a Gmail account with an App Password, not your real password.

---

### 13. Phase 7 — Second Adapter (Twilio)

**Objective:** Prove the adapter abstraction works with a **completely different vendor**.

**Depends On:** Phase 6 (and Phase 11 test utils, if available; otherwise inline tests).

**Scope:**
- ✅ `packages/adapter-twilio/` package
- ✅ `TwilioSmsProvider implements SmsProvider`
- ✅ Twilio error code mapping (retryable vs. not)

**Tasks:**

- [ ] Scaffold `packages/adapter-twilio/`
- [ ] `twilio` as `peerDependency`
- [ ] `src/provider.ts` — `TwilioSmsProvider` class
- [ ] `src/metadata.ts` — env vars
- [ ] Error classification for Twilio codes:
  - [ ] `20429` (rate limit) → retryable with `retryAfterMs`
  - [ ] `21610` (unsubscribed) → not retryable
  - [ ] `5xx` → retryable
- [ ] Unit tests for each error class
- [ ] **Manual test: send a real SMS via Twilio trial**

**Deliverables:**
- Twilio adapter package
- Real SMS delivered

**Definition of Done:**
- [ ] Real SMS delivered via Twilio in manual test
- [ ] All Twilio error codes mapped to retryable/not
- [ ] **No changes required in core** to add this adapter (proves the abstraction is correct)
- [ ] Adapter bundle < 10 KB (excluding `twilio`)

**Estimated Effort:** 2 days

**Risk:** Twilio trial restrictions (verified numbers only). **Mitigation:** Use the Twilio console's verified number list.

**Note:** If adding Twilio required touching core code, **stop and refactor**. The abstraction is wrong.

---

### 14. Phase 8 — Third Adapter (MSG91)

**Objective:** Add the India-focused SMS provider — the business wedge.

**Depends On:** Phase 7.

**Scope:**
- ✅ `packages/adapter-msg91/` package
- ✅ `Msg91SmsProvider implements SmsProvider`
- ✅ Support for MSG91's Flow API (template + variables)
- ✅ Error mapping

**Tasks:**

- [ ] Scaffold `packages/adapter-msg91/`
- [ ] No SDK dependency — use native `fetch` (MSG91's Node SDK is optional)
- [ ] `src/provider.ts` — `Msg91SmsProvider` class using Flow API
- [ ] `src/metadata.ts` — env vars
- [ ] Map `templateId` → MSG91 `flow_id`
- [ ] Error classification for MSG91 codes
- [ ] Unit tests with mocked `fetch`
- [ ] **Manual test: send a real SMS via MSG91 (India number, DLT-registered template)**

**Deliverables:**
- MSG91 adapter
- Real SMS to an Indian number

**Definition of Done:**
- [ ] Real SMS delivered to Indian number via MSG91
- [ ] DLT-related errors are classified as **not retryable** (they require user action)
- [ ] Adapter bundle < 10 KB (native `fetch` means truly lean)
- [ ] No core changes required

**Estimated Effort:** 3 days (MSG91 docs can be tricky)

**Risk:** DLT registration is required; you may not have it yet. **Mitigation:** Start your DLT registration **in Phase 0** — it can take a week.

---

### 15. Phase 9 — Fourth Adapter (FCM)

**Objective:** Complete the three-channel promise with push notifications.

**Depends On:** Phase 7.

**Scope:**
- ✅ `packages/adapter-fcm/` package
- ✅ `FcmPushProvider implements PushProvider`
- ✅ Service account JSON handling (from env)

**Tasks:**

- [ ] Scaffold `packages/adapter-fcm/`
- [ ] `firebase-admin` as `peerDependency`
- [ ] `src/provider.ts` — `FcmPushProvider` class
- [ ] `src/metadata.ts` — env vars (`FCM_SERVICE_ACCOUNT_JSON` or file path)
- [ ] Error mapping:
  - [ ] `messaging/registration-token-not-registered` → not retryable
  - [ ] `messaging/internal-error` → retryable
  - [ ] `messaging/quota-exceeded` → retryable with delay
- [ ] Unit tests with mocked firebase-admin
- [ ] **Manual test: send a real push via FCM test device**

**Deliverables:**
- FCM adapter
- Real push notification delivered to a device

**Definition of Done:**
- [ ] Real push delivered in manual test
- [ ] Invalid token classified as not retryable
- [ ] No core changes required

**Estimated Effort:** 3 days

**Risk:** Setting up an FCM project and a test device takes time. **Mitigation:** Do it once at the start of the phase; reuse the project.

**🏁 Strategic Milestone:** At the end of Phase 9, **all three channels work**. The product is functionally complete. Phases 10–14 are polish, tooling, docs, and launch.

---

### 16. Phase 10 — CLI Setup Wizard

**Objective:** The `npx notifykit init` experience — provider selection, credential capture, `.env` writing, selective SDK installation.

**Depends On:** Phases 1, 6, 7, 8, 9 (needs metadata from adapters).

**Scope:**
- ✅ `packages/cli/` package
- ✅ Interactive mode via `prompts`
- ✅ Non-interactive mode via flags
- ✅ `.env` writer (merge-safe)
- ✅ SDK installer via `execa`
- ✅ Summary screen
- ✅ Non-TTY detection

**Tasks:**

**Wizard core:**
- [ ] Scaffold `packages/cli/`
- [ ] `src/index.ts` — CLI entrypoint
- [ ] `src/prompts/channels.ts` — multi-select channel flow
- [ ] `src/prompts/providers.ts` — provider selection per channel
- [ ] `src/prompts/credentials.ts` — provider-specific credential prompts
- [ ] `src/prompts/summary.ts` — confirmation screen
- [ ] `src/env-writer.ts` — write `.env` without overwriting
- [ ] `src/env-writer.ts` — also update `.env.example`
- [ ] `src/installer.ts` — invoke `npm install <sdk>` only for selected providers
- [ ] `src/validator.ts` — require at least one channel

**Non-interactive mode:**
- [ ] Parse `--channels`, `--sms`, `--twilio-sid`, etc.
- [ ] Detect `!process.stdout.isTTY`
- [ ] Require `--yes` if non-interactive
- [ ] Exit code 0 on success, 1 on failure

**Idempotency:**
- [ ] Re-running `init` detects an existing `.env` and offers reconfigure

**Tests:**
- [ ] Test interactive flow via `prompts` mock
- [ ] Test non-interactive flow
- [ ] Test `.env` merge safety (unrelated vars preserved)
- [ ] Test `execa` invocation (mocked)
- [ ] Test non-TTY without `--yes` exits with error

**Docs:**
- [ ] `packages/cli/README.md`
- [ ] Add CLI section to core README

**Deliverables:**
- `npx notifykit init` works in a fresh project
- CI mode works

**Definition of Done:**
- [ ] Running `npx notifykit init` in a fresh project with no `.env`:
  - Asks channel (default: Email selected)
  - Asks provider
  - Asks credentials
  - Writes `.env` and `.env.example`
  - Runs `npm install` for only the selected adapter
  - Prints a success summary with a code snippet
- [ ] Running with `--channels=sms --sms=twilio --twilio-sid=x --twilio-token=y --yes` completes without prompting
- [ ] No credentials appear in stdout (verify with grep on captured output)
- [ ] Existing `.env` vars (e.g., `DATABASE_URL`) are preserved
- [ ] Wizard is idempotent

**Estimated Effort:** 6 days (bigger than it looks — many edge cases)

**Risk:** Prompt library quirks, CI detection, install failures mid-wizard. **Mitigation:** Test in a **fresh Docker container** for every scenario; never assume your local `.env` state.

---

### 17. Phase 11 — Test Utils & Adapter Contract Suite

**Objective:** Ship `@notifykit/test-utils` — the shared contract test suite every adapter must pass.

**Depends On:** Phases 6–9 (need at least 2 adapters to design the suite correctly).

**Scope:**
- ✅ `packages/test-utils/` package
- ✅ Exported `runAdapterContractTests(factory)` function
- ✅ Used by all official adapters

**Tasks:**

- [ ] Scaffold `packages/test-utils/`
- [ ] `src/contract.ts` — `runAdapterContractTests(factory)` API
- [ ] Test cases:
  - [ ] `sendX()` returns `{ success: boolean }`
  - [ ] No credential in error messages (regex scan)
  - [ ] Network errors → `retryable: true`
  - [ ] Auth errors → `retryable: false`
  - [ ] Malformed input → `{ success: false }` (no throw)
- [ ] Wire each adapter's test suite to use it
- [ ] Documentation: "How to write a community adapter"

**Deliverables:**
- All 4 adapters pass the contract suite

**Definition of Done:**
- [ ] `runAdapterContractTests()` is importable and used by all 4 adapters
- [ ] Adding a new adapter requires < 30 minutes to wire up
- [ ] Contract tests are documented in `docs/adapters.md`

**Estimated Effort:** 3 days

**Risk:** Contract is too strict → adapters can't fit it. **Mitigation:** Design the contract against all 4 existing adapters first; only include tests that all 4 can pass.

---

### 18. Phase 12 — Documentation & Examples

**Objective:** Complete documentation so a stranger can use NotifyKit in 10 minutes.

**Depends On:** Phases 1–11.

**Scope:**
- ✅ Root README (install, quickstart, API)
- ✅ `docs/` directory (architecture, adapters, troubleshooting)
- ✅ `examples/` directory (4 runnable examples)
- ✅ Per-package READMEs

**Tasks:**

- [ ] Root `README.md`:
  - [ ] One-line pitch
  - [ ] `npm install notifykit && npx notifykit init`
  - [ ] 10-line quickstart example
  - [ ] Link to docs
  - [ ] Badges (npm, CI, license)
- [ ] `docs/getting-started.md` — full walkthrough
- [ ] `docs/architecture.md` — link to Architecture doc
- [ ] `docs/adapters.md` — how to write your own adapter
- [ ] `docs/providers.md` — provider-specific notes (Twilio DLT, MSG91 setup, etc.)
- [ ] `docs/troubleshooting.md` — common errors
- [ ] `examples/email-only/` — working example
- [ ] `examples/sms-only/`
- [ ] `examples/both-channels/`
- [ ] `examples/ci-mode/` — non-interactive wizard
- [ ] Per-package READMEs (core, cli, each adapter)
- [ ] Example: `examples/README.md` explaining each
- [ ] Record a 60-second Loom walkthrough (optional but powerful)

**Deliverables:**
- Docs site (GitHub Pages or Vercel)
- 4 runnable examples

**Definition of Done:**
- [ ] A stranger can install NotifyKit and send their first notification in < 10 minutes following the README
- [ ] Every public API method is documented with a code example
- [ ] Every adapter has a setup guide
- [ ] All examples run correctly
- [ ] Docs site is published

**Estimated Effort:** 4 days

**Risk:** Docs drift from reality. **Mitigation:** Every example is an actual directory in the repo, tested in CI (`pnpm --filter example-* test`).

---

### 19. Phase 13 — Hardening, Security & Performance

**Objective:** Ensure the product is production-ready.

**Depends On:** Phases 1–12.

**Scope:**
- ✅ Security review
- ✅ Performance benchmarks
- ✅ Error message audit
- ✅ Dependency audit
- ✅ Load test

**Tasks:**

- [ ] Run `npm audit` on all packages → zero high/critical
- [ ] Enable Dependabot on GitHub
- [ ] Verify Pino redaction on every code path (grep for "token", "secret", "password" in log calls)
- [ ] Benchmark `notify()` at 1,000/second on a test machine — document throughput
- [ ] Benchmark worker at 100 SMS/second against Twilio sandbox — document
- [ ] Confirm Redis cluster support in a test cluster (or document known limitation)
- [ ] Test graceful shutdown drains in-flight jobs
- [ ] Test worker behavior on Redis disconnect/reconnect
- [ ] Verify all errors include actionable messages
- [ ] Check bundle sizes against `size-limit` budgets
- [ ] Run `size-limit` in CI
- [ ] Add performance section to README
- [ ] Run a load test: 1,000 notifications in 10 seconds with a mock adapter — document p99 latency

**Deliverables:**
- Performance report
- Security sign-off

**Definition of Done:**
- [ ] Zero high/critical `npm audit` findings
- [ ] Documented benchmarks: `notify()` p99 < 10 ms, worker throughput ≥ 50 msg/sec
- [ ] Pino redaction test: sending a fake credential through a job produces log lines with `[REDACTED]`
- [ ] All errors are actionable (grep test: every thrown error message contains a "how to fix" hint)
- [ ] `size-limit` passes in CI

**Estimated Effort:** 4 days

**Risk:** Discovering late-stage design issues. **Mitigation:** Do not skip Phase 14 if a critical issue is found. Roll back to the affected phase and fix it.

---

### 20. Phase 14 — Release & Launch 🚀

**Objective:** Ship v1.0.0 to npm and announce it publicly.

**Depends On:** Phases 1–13.

**Scope:**
- ✅ npm publish (all 6 packages)
- ✅ GitHub release with changelog
- ✅ Launch announcement
- ✅ Post-launch monitoring

**Pre-release checklist:**
- [ ] Bump all packages to `1.0.0` via Changesets
- [ ] Verify `package.json` `files` field in every package
- [ ] Verify `exports` maps work for ESM + CJS
- [ ] Verify `types` are exported
- [ ] Verify `sideEffects: false` on all packages
- [ ] Verify `LICENSE` is included in each package
- [ ] Publish to `beta` tag first (e.g., `npm publish --tag beta`)
- [ ] Install from `beta` in a fresh project
- [ ] Run the 4 examples against `beta`
- [ ] Confirm all work
- [ ] Publish to `latest`

**Launch tasks:**
- [ ] Create `v1.0.0` GitHub release with full changelog
- [ ] Add npm badges to README
- [ ] Prepare **Show HN** post (title + description + URL)
- [ ] Prepare **r/node** post
- [ ] Prepare **Twitter/X thread**
- [ ] Prepare **dev.to** article
- [ ] Post at optimal time (Tuesday–Thursday, 8–10 AM US Eastern)
- [ ] Respond to all comments for 48 hours
- [ ] Set up an issue triage routine for the first week

**Deliverables:**
- All 6 packages published to npm as v1.0.0
- Public launch announcement

**Definition of Done:**
- [ ] `npm install notifykit && npx notifykit init` works in a fresh project
- [ ] All 4 examples run from published packages (not local)
- [ ] GitHub release published
- [ ] Launch posted on at least 2 channels
- [ ] 10+ real users have installed the package in the first 48 hours (tracked via npm downloads)

**Estimated Effort:** 3 days

**Risk:** Post-launch flood of issues. **Mitigation:** Block off 2–3 full days after launch to triage and respond. First-week responsiveness determines whether you get a second wave.

**🏁 You are now the owner of a published, usable, open-source npm package.**

---

### 21. Phase 15 — Post-Launch (v1.1)

**Objective:** Address feedback, add requested features, and grow the user base.

**Timeline:** 3–4 weeks after launch.

**Prioritized features (in order):**

1. **Prometheus metrics exporter** (high demand)
2. **Additional email providers**: Resend, SES, SendGrid (community requested)
3. **Additional SMS providers**: Plivo, Telnyx (cost-focused users)
4. **Idempotency keys in `notify()`** (enterprise feature)
5. **OpenTelemetry tracing** (enterprise feature)
6. **MongoDB delivery-log adapter** (optional persistence)
7. **Community adapter contribution guide** + first external adapter

**Success criterion for v1.1:** 1,000+ npm weekly downloads, 500+ GitHub stars, ≥1 external adapter published.

---

### 22. Phase 16 — Commercial Tier (v1.5+)

**Objective:** Turn NotifyKit from an open-source project into a **business**.

**Timeline:** 6–8 weeks after v1.1.

**Commercial features (the open-core premium):**

1. **Premium wizard tier**:
   - Cost calculator (Twilio vs. MSG91 by volume & region)
   - DLT compliance checklist and registration walkthrough
   - Provider recommendation engine (based on region, volume, budget)
   - Team config sync (share provider config across team members via a backend)

2. **Hosted control plane** (SaaS):
   - Dashboard for template management
   - Delivery analytics (per-provider success rate)
   - **Note:** Sending still happens in the user's infrastructure — the control plane is read-only analytics + template editing

3. **Enterprise support**:
   - SLAs
   - Priority bug fixes
   - Custom adapter development
   - DLT registration assistance (India)

4. **Enterprise features**:
   - SSO
   - Audit logs
   - Multi-tenant support

**Business model:**
- Free: core library + free wizard
- Pro ($10–50/month): premium wizard features
- Team ($29–199/month): hosted control plane
- Enterprise ($5K–50K/year): support + SLAs

**Success criterion for Phase 16:** First 10 paying customers, MRR ≥ $1,000.

---

### 23. Release Gates (Go / No-Go Criteria)

Before moving from Phase N to Phase N+1, **all** gate criteria must pass.

| Gate | Criteria |
| :--- | :--- |
| **Gate 1 → 2** (Foundation → Interfaces) | Monorepo builds, CI green, no lint errors |
| **Gate 4 → 5** (Orchestrator → Worker) | `notify()` produces correct jobs; all validation edge cases tested |
| **Gate 5 → 6** (Worker → First Adapter) | Worker processes mock jobs correctly with retries and DLQ |
| **Gate 6 → 7** (First Adapter → Second) | **A real email was delivered end-to-end** |
| **Gate 9 → 10** (Adapters → CLI) | All 4 adapters pass contract tests; no core changes needed for any of them |
| **Gate 10 → 11** (CLI → Test Utils) | Wizard works in a fresh project, both interactive and non-interactive |
| **Gate 13 → 14** (Hardening → Release) | Zero high/critical `npm audit`; benchmarks documented; examples run from `beta` tag |

**Do not skip a gate to "save time" — you will pay 3× the cost later.**

---

### 24. Risk Register by Phase

| Phase | Risk | Severity | Mitigation |
| :--- | :--- | :--- | :--- |
| 0 | Tooling paralysis | Medium | Timebox to 2 days |
| 1 | Interface design wrong | **Critical** | Write 3 example adapters first |
| 2 | Handlebars performance | Low | Benchmark early |
| 3 | BullMQ misunderstanding | Medium | Read docs before coding |
| 4 | Orchestrator bugs | **Critical** | TDD — write tests first |
| 5 | Worker lifecycle bugs | High | Test failure paths first |
| 6 | SMTP setup friction | Low | Use Gmail app password |
| 7 | Twilio trial restrictions | Low | Use verified numbers |
| 8 | DLT registration delay | **High** | **Start DLT in Phase 0** |
| 9 | FCM setup friction | Medium | Set up project once |
| 10 | Wizard edge cases | High | Test in Docker |
| 11 | Contract too strict | Medium | Design against 4 adapters |
| 12 | Docs drift | Low | Run examples in CI |
| 13 | Late-stage bugs | **Critical** | Do not skip; consider a soft-beta before Phase 14 |
| 14 | Launch overwhelm | High | Block 2–3 days post-launch |

---

### 25. Effort Summary Table

| Phase | Name | Days | Cumulative |
| :--- | :--- | :--- | :--- |
| 0 | Foundation & Tooling | 2 | 2 |
| 1 | Interfaces & Config | 3 | 5 |
| 2 | Templates | 2 | 7 |
| 3 | Queue (Producer) | 3 | 10 |
| 4 | Orchestrator | 4 | 14 |
| 5 | BullMQ Worker | 3 | 17 |
| 6 | Nodemailer Adapter | 3 | 20 |
| 7 | Twilio Adapter | 2 | 22 |
| 8 | MSG91 Adapter | 3 | 25 |
| 9 | FCM Adapter | 3 | 28 |
| 10 | CLI Setup Wizard | 6 | 34 |
| 11 | Test Utils & Contract | 3 | 37 |
| 12 | Docs & Examples | 4 | 41 |
| 13 | Hardening & Security | 4 | 45 |
| 14 | Release & Launch | 3 | **48 days** |
| **Total (v1.0)** | | **~48 days** | **~7 weeks full-time** |

**With realistic buffer** (25–30%): **~60 days / ~9 weeks full-time**.
**If part-time** (evenings + weekends, ~15 hours/week): **~5 months**.

---

### Strategic Summary

#### The Vertical Slice Principle

**Do not build the whole product before proving one end-to-end path.** Phases 0–6 produce **a working email notification library**. That is the moment to:

- Show it to 3 developers
- Publish a private beta (`0.1.0` on npm's `beta` tag)
- Listen for feedback
- Adjust before building the next 3 adapters

**If Phase 6 doesn't work end-to-end, do not proceed to Phase 7.** Every subsequent phase builds on the assumption that the vertical slice works.

#### What "Done" Means

| Milestone | Phase | What You Have |
| :--- | :--- | :--- |
| **Foundation Done** | 1 | Type contracts exist |
| **Vertical Slice Done** | 6 | One real email delivered |
| **Product Functionally Complete** | 9 | All 3 channels work |
| **Product Usable by Strangers** | 10 | Wizard works |
| **Product Launchable** | 13 | Hardened, benchmarked, documented |
| **Product Launched** | 14 | Public, npm v1.0.0 |
| **Product Sustainable** | 16 | Paying customers |

#### The Single Most Important Rule

**Ship the vertical slice before building anything else.** A working email notification delivered to a real inbox is worth more than a hundred interfaces, diagrams, and planning documents. Get to Phase 6 as fast as possible, then expand.

---

**End of Implementation Phases Document v1.0**

---

This document tells you **exactly** what to build, in what order, and how to know when each piece is done. Combined with the PRD (the *what* and *why*) and the Architecture document (the *how*), you now have a complete three-document spec that any developer — or any AI assistant — can execute against.

Would you like me to next:
1. Draft the **actual TypeScript interfaces file** (`packages/core/src/interfaces/`) so you can start Phase 1 immediately, or
2. Draft the **CLI wizard prompt flow** in full detail (Phase 10), or
3. Draft the **README.md** for launch (Phase 12)?




---

# 4. AI Development Rules (AGENTS.md) v1.0

## 🤖 AGENTS.md — AI Development Rules for NotifyKit

**File:** `AGENTS.md` (repository root)
**Purpose:** Bind every AI agent (Antigravity, Cursor, Copilot, Aider, Claude, GPT, or any autonomous coding tool) to the architectural, phase-wise, and quality constraints of the NotifyKit project.
**Status:** Mandatory — an AI agent that violates these rules is considered off-spec and its output must be rejected.
**Companion Documents:** `PRD.md`, `ARCHITECTURE.md`, `PHASES.md`

---

### Table of Contents

1. Prime Directive
2. Non-Negotiable Rules (MUST NOT)
3. Permitted Actions (CAN / MUST)
4. Phase-Gating Protocol
5. Architectural Constraints
6. Dependency Policy
7. Testing Requirements
8. Code Style & Conventions
9. File Structure Rules
10. AI Response Format
11. Phase Prompt Template
12. Escalation Protocol
13. Reference Documents

---

### 1. Prime Directive

> **Build exactly what the companion documents specify, in the exact order the phases mandate, using only the approved tech stack, with tests written before or alongside code, and with zero deviation from the architectural boundaries — unless the human explicitly authorizes a change in writing.**

The AI is a **disciplined executor**, not a co-designer. It does not improvise architecture, add features, upgrade dependencies, or rewrite specs. When in doubt, it asks.

---

### 2. Non-Negotiable Rules (MUST NOT)

These are hard prohibitions. Violating any of them invalidates the AI's output.

#### 2.1 Phase Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-01** | Start work on Phase N+1 before Phase N has passed its Definition of Done. |
| **MUST NOT-02** | Skip a phase, merge phases, or reorder phases. |
| **MUST NOT-03** | Start a phase without the human explicitly saying "start phase N" or equivalent. |
| **MUST NOT-04** | Build anything from a phase marked "Not in Scope" for the current phase. |
| **MUST NOT-05** | Move past a Release Gate (see `PHASES.md §23`) that has not passed. |

#### 2.2 Architecture Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-06** | Import any vendor SDK (`twilio`, `nodemailer`, `firebase-admin`, etc.) inside the core `notifykit` package. |
| **MUST NOT-07** | Import from `orchestrator`, `queue`, `config`, or `templates` inside the `interfaces/` module. `interfaces/` depends on nothing. |
| **MUST NOT-08** | Create a circular import between any two internal modules. |
| **MUST NOT-09** | Import a concrete adapter from the core. Adapters are injected at runtime via `createNotifier()`. |
| **MUST NOT-10** | Auto-start a BullMQ worker on module import. Workers start only via explicit `startWorker()`. |
| **MUST NOT-11** | Render templates inside the BullMQ worker. Rendering happens at enqueue time (ADR-004). |
| **MUST NOT-12** | Use `console.log` anywhere. Use the shared Pino logger. |
| **MUST NOT-13** | Store credentials outside the user's `.env`. Never in logs, never in code, never in the DB. |
| **MUST NOT-14** | Introduce a database, ORM, or persistent state into the core library. Redis (user-owned) is the only state layer. |

#### 2.3 Dependency Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-15** | Add any new runtime dependency without written human approval. |
| **MUST NOT-16** | Upgrade a major version of any existing dependency. |
| **MUST NOT-17** | Replace an approved library with an alternative (e.g., swapping BullMQ for Agenda, Pino for Winston). |
| **MUST NOT-18** | Add a dependency that pulls in another HTTP client, logger, or template engine. The stack already has one of each. |
| **MUST NOT-19** | Add a dev dependency that ships in the production bundle. |
| **MUST NOT-20** | Introduce TypeScript `any` without a comment explaining why. Prefer `unknown`. |

#### 2.4 Testing Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-21** | Ship code without tests covering its happy path and at least one failure path. |
| **MUST NOT-22** | Lower coverage thresholds in `vitest.config.ts`. |
| **MUST NOT-23** | Skip integration tests for BullMQ behavior ("it works locally" is not acceptable). |
| **MUST NOT-24** | Mock Redis with an in-memory shim in integration tests. Use Testcontainers with real Redis. |
| **MUST NOT-25** | Mark a test as `skip` or `todo` without a tracked issue number. |

#### 2.5 Scope Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-26** | Implement a feature from a later phase (e.g., metrics exporter, MongoDB adapter, OpenTelemetry) during earlier phases. |
| **MUST NOT-27** | "Improve" a spec, rename a module, or change a public API without written approval. |
| **MUST NOT-28** | Add documentation for features that do not exist yet. |
| **MUST NOT-29** | Write a README that describes v2 features as if they were v1. |
| **MUST NOT-30** | Add "nice to have" features (e.g., rate limiting on the orchestrator, retry with jitter, plugin system) unless explicitly requested. |

#### 2.6 Communication Discipline

| # | Rule |
| :--- | :--- |
| **MUST NOT-31** | Respond in any language other than English. |
| **MUST NOT-32** | Produce a phase report without stating which phase it addresses. |
| **MUST NOT-33** | Claim a test passed without showing the command and its output. |
| **MUST NOT-34** | Modify files outside the current phase's scope without stating it explicitly at the top of the response. |

---

### 3. Permitted Actions (CAN / MUST)

These are the actions the AI is expected to perform within each phase.

#### 3.1 MUST (Always Do)

| # | Rule |
| :--- | :--- |
| **MUST-01** | Read `PRD.md`, `ARCHITECTURE.md`, `PHASES.md`, and this file before starting any work. |
| **MUST-02** | Announce the phase being worked on at the top of every response. |
| **MUST-03** | Follow the task list from `PHASES.md` for the current phase, in order. |
| **MUST-04** | Write TypeScript with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`. |
| **MUST-05** | Write tests for every public function and every error branch. |
| **MUST-06** | Follow Conventional Commits for commit messages: `feat(core): ...`, `fix(queue): ...`, `test(config): ...`. |
| **MUST-07** | Use TSDoc comments on every exported function, type, and interface. |
| **MUST-08** | Preserve existing module boundaries when adding files. |
| **MUST-09** | Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before reporting a phase complete. |
| **MUST-10** | Show the exact command and its output when claiming a phase is done. |
| **MUST-11** | Flag any ambiguity in the spec **before** writing code. |
| **MUST-12** | Update the phase checklist in `PHASES.md` when tasks are completed (check the boxes). |

#### 3.2 CAN (Allowed When Justified)

| # | Rule |
| :--- | :--- |
| **CAN-01** | Refactor code **within the current phase** if the refactor keeps the phase's Definition of Done intact. |
| **CAN-02** | Add internal helper functions and private files to the current module. |
| **CAN-03** | Improve error messages for clarity (as long as they still contain the "how to fix" hint). |
| **CAN-04** | Add tests beyond the phase's minimum, as long as they do not test features that do not exist. |
| **CAN-05** | Split a task from `PHASES.md` into multiple commits if it improves reviewability. |
| **CAN-06** | Add a file to `.gitignore` if it is clearly a build artifact or secret. |
| **CAN-07** | Ask for clarification (see §12) at any point. |

---

### 4. Phase-Gating Protocol

This is the **most important workflow rule**. The AI must follow this protocol for every phase.

#### 4.1 Phase Entry Protocol

Before starting work on any phase, the AI **MUST**:

1. Confirm the phase number and name.
2. Confirm the phase's prerequisites are complete (Depends On field from `PHASES.md`).
3. Restate the phase's Objective in one sentence.
4. List the tasks the AI is about to perform.
5. Ask the human: **"Proceed with Phase N?"** and wait for confirmation.

If the human has already said "start phase N" explicitly, steps 1–4 are still performed, but step 5 is replaced with: **"Starting Phase N as requested."**

#### 4.2 Phase Work Protocol

While working on a phase, the AI **MUST**:

1. Work through the phase's tasks in order.
2. Write tests before or alongside code (TDD preferred).
3. Run `pnpm lint && pnpm typecheck && pnpm test` after every meaningful chunk of work.
4. Never leave the codebase in a state where `pnpm build` fails.
5. Commit after each completed sub-task (Conventional Commits).

#### 4.3 Phase Exit Protocol

At the end of a phase, the AI **MUST** report:

1. **Phase:** N — Name
2. **Tasks completed:** list each task from `PHASES.md` with a checkmark
3. **Tasks deferred:** any tasks not completed, with a reason
4. **Deliverables produced:** files and paths
5. **Definition of Done verification:** for each line in `PHASES.md` §<phase> "Definition of Done", state PASS/FAIL with evidence
6. **Test output:** paste the exact output of `pnpm test` (summary)
7. **Lint output:** paste the exact output of `pnpm lint` (summary)
8. **Build output:** paste the exact output of `pnpm build`
9. **Coverage:** paste the coverage summary for the phase's module
10. **Risks encountered:** what went wrong, what was learned
11. **Recommendation:** "Ready for Phase N+1" or "Blocked — needs X"

The phase is **not** complete until every "Definition of Done" line passes with evidence.

#### 4.4 The Vertical Slice Rule

**Phase 6 (Nodemailer Adapter) is a hard milestone.** After Phase 6, the AI **MUST** prove that a real email was sent through the full stack (orchestrator → queue → worker → adapter → SMTP). This proof must be shown as:

- The script used
- The console output showing success
- A timestamp confirming receipt (if the human confirms)

**Do not proceed to Phase 7 until Phase 6 is proven end-to-end.**

---

### 5. Architectural Constraints

These enforce the decisions from `ARCHITECTURE.md`.

#### 5.1 Module Dependency Rules (Enforced by ESLint)

The dependency matrix from `ARCHITECTURE.md §5.3` is mandatory:

| Module | May Import From |
| :--- | :--- |
| `interfaces/` | **Nothing** (except types) |
| `logging/` | `pino` only |
| `config/` | `interfaces/`, `logging/`, `dotenv`, `zod` |
| `templates/` | `interfaces/`, `logging/`, `handlebars` |
| `queue/` | `interfaces/`, `config/`, `logging/`, `bullmq`, `ioredis` |
| `orchestrator/` | `interfaces/`, `config/`, `templates/`, `queue/`, `logging/` |

The AI **MUST** run `pnpm lint` and confirm no `import/no-cycle` violations before claiming any module complete.

#### 5.2 Public API Surface

Only `src/index.ts` and `src/interfaces/index.ts` are public entry points. Everything else is internal and must not be exported.

The AI **MUST NOT** export internal functions or modules from `index.ts` without explicit approval.

#### 5.3 Adapter Contract

Every adapter **MUST**:

1. Live in its own package: `packages/adapter-<name>/`.
2. Implement exactly one of `EmailProvider`, `SmsProvider`, or `PushProvider`.
3. Export a `metadata` object with `{ name, channel, requiredEnv }`.
4. Have `notifykit` as a `peerDependency`, not a `dependency`.
5. Have the vendor SDK as a `peerDependency`, not a `dependency`.
6. Never import from the core beyond `notifykit/interfaces`.

---

### 6. Dependency Policy

#### 6.1 Approved Runtime Dependencies (Core)

The core `notifykit` package may only depend on:

- `bullmq`
- `ioredis`
- `zod`
- `handlebars`
- `pino`
- `dotenv`

**Adding any other runtime dependency requires written human approval in the PR description.**

#### 6.2 Approved Dev Dependencies

- `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`
- `eslint`, `@typescript-eslint/*`, `eslint-plugin-import`, `prettier`
- `testcontainers`, `@testcontainers/redis`
- `size-limit`, `@size-limit/preset-app`
- `changesets`
- `@types/node`

#### 6.3 Peer Dependencies (Adapters Only)

Each adapter declares its vendor SDK as a `peerDependency`:

| Adapter | Peer Dependencies |
| :--- | :--- |
| `adapter-nodemailer` | `notifykit`, `nodemailer` |
| `adapter-twilio` | `notifykit`, `twilio` |
| `adapter-msg91` | `notifykit` (uses native `fetch`, no SDK) |
| `adapter-fcm` | `notifykit`, `firebase-admin` |

#### 6.4 Forbidden Dependencies (Anywhere)

- `axios` (use native `fetch`)
- `winston`, `bunyan` (use Pino)
- `express` in the core (allowed only in user examples, not in the library itself)
- `nodemon`, `ts-node` in production
- Any dependency with a "postinstall" script that runs network operations
- Any dependency not listed in §6.1–6.3 without explicit approval

---

### 7. Testing Requirements

#### 7.1 Coverage Thresholds (Enforced in CI)

| Package | Line | Branch | Function |
| :--- | :--- | :--- | :--- |
| `notifykit` (core) | ≥85% | ≥80% | ≥85% |
| Adapters | ≥85% | ≥80% | ≥85% |
| `notifykit-cli` | ≥70% | ≥65% | ≥70% |

Lowering these requires explicit written approval.

#### 7.2 Test Types Required Per Phase

| Phase | Required Tests |
| :--- | :--- |
| Phase 1 | Unit: config validation (10+ cases) |
| Phase 2 | Unit: template rendering (8+ cases) |
| Phase 3 | Integration: BullMQ with real Redis (Testcontainers) |
| Phase 4 | Unit: orchestrator logic (15+ cases) + integration |
| Phase 5 | Integration: retry, DLQ, graceful shutdown |
| Phase 6+ | Adapter contract tests + integration |
| Phase 10 | CLI tests with mocked `prompts` and `execa` |

#### 7.3 Test Naming

Test names **MUST** describe the behavior, not the function:

- ✅ `"throws InvalidEventError when recipient is empty"`
- ❌ `"test notify"`

---

### 8. Code Style & Conventions

#### 8.1 TypeScript

- `strict: true` always.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Use `readonly` where possible.
- Never use `any`. Use `unknown` + narrowing.
- Never use `!` (non-null assertion). Use explicit null checks.

#### 8.2 Naming

| Kind | Convention | Example |
| :--- | :--- | :--- |
| Files | `kebab-case` | `event-schema.ts` |
| Classes | `PascalCase` | `TwilioSmsProvider` |
| Interfaces | `PascalCase` | `SmsProvider` |
| Functions | `camelCase` | `enqueueJob()` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_RETRY_DELAY` |
| Env vars | `SCREAMING_SNAKE_CASE` | `TWILIO_AUTH_TOKEN` |

#### 8.3 Imports

- Use the `notifykit/interfaces` subpath for cross-package type imports.
- Never use relative imports that escape the package root.
- Group imports: external → internal → relative.

#### 8.4 Error Handling

- Every thrown error **MUST** contain a message with a "how to fix" hint.
- Every thrown error **MUST** extend a base `NotifyKitError` class.
- Never swallow errors silently. Log + rethrow, or return a typed result.

---

### 9. File Structure Rules

#### 9.1 What the AI May Create

- New files inside the current phase's packages.
- New test files alongside their source files.
- New helper files inside the current module.
- New example directories inside `examples/` (Phase 12 only).
- New doc files inside `docs/` (Phase 12 only).

#### 9.2 What the AI May Modify

- Files inside the current phase's packages.
- `PHASES.md` (only to check off completed tasks).
- `CHANGELOG.md` (via Changesets).

#### 9.3 What the AI MUST NOT Modify

- `PRD.md`
- `ARCHITECTURE.md`
- `AGENTS.md` (this file)
- `package.json` `dependencies` (without approval)
- `tsconfig.base.json`
- `.github/workflows/ci.yml`
- `vitest.config.ts` (lowering thresholds)

Any change to these files **MUST** be proposed in the response and approved by the human first.

---

### 10. AI Response Format

Every response from the AI during development **MUST** begin with a status header:

```
📋 STATUS
Phase: <N> — <Name>
Status: <In Progress | Blocked | Complete>
Task: <current task from PHASES.md>
Mode: <Build | Test | Report>
```

Then the body, then a closing block:

```
✅ VERIFICATION
Lint: <PASS | FAIL | Not run>
Typecheck: <PASS | FAIL | Not run>
Test: <PASS X/Y | FAIL | Not run>
Build: <PASS | FAIL | Not run>
Coverage: <percentage>% (threshold: <required>%)

📌 NEXT STEP
<one-line recommendation>
```

This structure makes it trivial for the human to audit progress at a glance.

---

### 11. Phase Prompt Template

When producing a prompt **for** the AI (i.e., the human → AI prompt that kicks off a phase), the AI **MUST** output it using this template:

```markdown
# Phase <N> — <Name>

## Context
[1–2 sentences: what this phase delivers and why it matters]

## Prerequisites
[Confirm the prior phase is complete with evidence]

## Scope
[Copy the Scope from PHASES.md]

## Tasks
[Copy the Tasks checklist from PHASES.md verbatim]

## Deliverables
[Copy the Deliverables from PHASES.md]

## Definition of Done
[Copy the DoD from PHASES.md verbatim — this is the phase acceptance test]

## Rules
- Follow AGENTS.md at all times.
- Do not modify files outside this phase's scope.
- Write tests first. Report test/lint/build output.
- Ask before introducing any new dependency.
- Announce the phase at the top of every response.

## Verification Command
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## Exit Report Required
Respond with the VERIFICATION block from AGENTS.md §10, plus PASS/FAIL evidence for each DoD line.
```

Every phase prompt the AI produces **MUST** follow this template exactly. This ensures consistency and makes the human's life predictable.

---

### 12. Escalation Protocol

The AI **MUST** stop and ask the human before proceeding if:

1. **A spec is ambiguous.** Example: "Should `notify()` throw or return a result when a channel has no adapter?" — ask.
2. **A task requires a new dependency.** Example: "MSG91 has no Node SDK; do I use native fetch?" — ask.
3. **A phase's Definition of Done cannot be met as written.** Example: "Twilio trial account cannot send to unverified numbers — is this acceptable?" — ask.
4. **A prior phase is discovered to be incomplete.** Example: "While building Phase 7, I found Phase 4 fails the invalid-event test" — stop, report, ask.
5. **A breaking change is required.** Example: "The `SmsProvider` interface needs a new field" — ask before touching `interfaces/`.
6. **A real-world constraint blocks progress.** Example: "MSG91 DLT registration is pending; SMS to Indian numbers fails" — ask.
7. **The AI is unsure about any architectural decision.** — ask.

The AI **MUST NOT** guess. Guessing is worse than asking.

---

### 13. Reference Documents

The AI **MUST** treat these as the source of truth, in this priority order:

| Priority | Document | Purpose |
| :--- | :--- | :--- |
| 1 | `AGENTS.md` (this file) | Behavior rules for the AI |
| 2 | `PHASES.md` | What to build, in what order |
| 3 | `ARCHITECTURE.md` | How to structure it |
| 4 | `PRD.md` | What it is and why |

If a conflict exists between documents, the higher-priority document wins, and the AI **MUST** flag the conflict to the human.

---

### Enforcement Summary (Quick Reference)

| The AI **CAN** | The AI **MUST NOT** |
| :--- | :--- |
| Build only the current phase | Skip or reorder phases |
| Ask for clarification | Guess on ambiguity |
| Refactor within the current phase | Refactor the spec |
| Write extra tests | Lower coverage thresholds |
| Use `unknown` + narrowing | Use `any` |
| Ask before adding a dependency | Add a dependency unilaterally |
| Improve error messages | Change public APIs |
| Work inside `packages/*` | Import vendor SDKs into the core |
| Check off tasks in `PHASES.md` | Modify `PRD.md`, `ARCHITECTURE.md`, or this file |
| Propose a design change | Implement a design change without approval |
| Report PASS/FAIL with evidence | Claim PASS without evidence |
| Respond in English | Respond in any other language |

---

**End of `AGENTS.md` v1.0**

---

### 📌 Confirmation of Phase-Wise Prompt Producing Strategy

As requested, from this point forward **I will follow a strict phase-wise prompt-producing strategy**. Here is exactly how our collaboration will work:

#### My Workflow Going Forward

1. **You say:** "Start Phase N" (or "Continue Phase N").
2. **I produce:** A **complete phase prompt** using the template in §11 above, containing:
   - Phase context
   - Prerequisites (with confirmation that prior phase is complete)
   - Scope (from `PHASES.md`)
   - Tasks checklist (verbatim from `PHASES.md`)
   - Deliverables
   - Definition of Done
   - Rules reminder
   - Verification command
   - Required exit report format
3. **You paste** that prompt into Antigravity (or whichever AI agent you're using).
4. **Antigravity builds** the phase and returns the VERIFICATION report.
5. **You paste** Antigravity's output back to me.
6. **I verify** it against the Definition of Done and either:
   - ✅ **Approve** and produce the next phase prompt, or
   - ⚠️ **Flag gaps** with a corrective prompt for Antigravity to fix before moving on.
7. **Repeat** until all 15 phases are complete.

#### What I Will Never Do

- ❌ Skip a phase for you
- ❌ Combine phases to "save time"
- ❌ Produce a prompt that violates `AGENTS.md`
- ❌ Approve a phase whose DoD does not pass
- ❌ Change architectural decisions without your explicit written approval
- ❌ Respond in any language other than English

#### What I Will Always Do

- ✅ Produce prompts that match the §11 template exactly
- ✅ Reference the specific phase, tasks, and DoD from `PHASES.md`
- ✅ Include the verification command every time
- ✅ Ask you before generating a prompt for a phase whose prerequisite is not proven complete
- ✅ Keep every response in English

---

### 🚦 Ready to Begin

You now have **four complete specification documents**:

| File | Purpose | Status |
| :--- | :--- | :--- |
| `PRD.md` | What we are building and why | ✅ Complete |
| `ARCHITECTURE.md` | How it is structured | ✅ Complete |
| `PHASES.md` | What to build, in what order, with DoD | ✅ Complete |
| `AGENTS.md` | Rules for AI agents building it | ✅ Complete |

**Next step:** Say **"Start Phase 0"** and I will produce the first phase prompt using the template in §11, ready for you to paste into Antigravity.

Alternatively, if you want me to also produce:
- The **TypeScript interfaces file** (`packages/core/src/interfaces/*.ts`) as a starter artifact
- The **CLI wizard prompt flow** as a detailed design
- The **`README.md`** for launch

…just tell me which one and I'll produce it. Otherwise, say the word and we begin **Phase 0**.




---

# 5. Source Appendix A — Original System Architecture v1.0

## 🏗️ NotifyKit — System Architecture Document

**Document Version:** 1.0
**Status:** Complete
**Companion Document:** PRD v1.0
**Last Updated:** October 2026
**Scope:** Complete system design for the NotifyKit library, CLI wizard, and provider adapter ecosystem.

---

### Table of Contents

1. Architecture Overview
2. Architectural Style Decision
3. High-Level System Context
4. Component Architecture (Container View)
5. Module Design (Component View)
6. Data Flow & Sequence Diagrams
7. Tech Stack (Complete)
8. Queue & Job Architecture (BullMQ)
9. Provider Adapter Architecture
10. Error Handling & Retry Strategy
11. Configuration & Credential Management
12. Observability & Logging
13. Security Architecture
14. Testing Architecture
15. Build, Packaging & Distribution
16. Versioning & Release Strategy
17. Performance & Scaling Considerations
18. Deployment Topology (User Side)
19. Directory Structure
20. Architectural Decision Records (ADRs)
21. Non-Functional Requirements
22. Future Evolution (v1.1 → v2)
23. Glossary

---

### 1. Architecture Overview

NotifyKit is a **distributed library system** — not a hosted service. It has no central server. It consists of three deployable artifacts that are consumed inside the **user's own Node.js process**:

| Artifact | Type | Deployed Where |
| :--- | :--- | :--- |
| **`notifykit`** (core) | npm library | Imported into the user's application code |
| **`notifykit-cli`** (wizard) | npm CLI | Run once via `npx notifykit init` |
| **`@notifykit/adapter-*`** | npm libraries (one per provider) | Installed into the user's project |

The **runtime architecture** is a **producer-consumer pattern** built on BullMQ + Redis (owned by the user), with a **pluggable provider adapter layer** that isolates all vendor SDKs from the core.

The **architecture philosophy** is:

- **Zero owned infrastructure** — NotifyKit never runs a server, database, or queue on your behalf.
- **Zero vendor lock-in** — the core is vendor-agnostic; adapters are swappable.
- **Zero forced dependencies** — the core is lean; provider SDKs are opt-in.
- **Reliable by default** — every notification is durable until delivered (or dead-lettered).

---

### 2. Architectural Style Decision

#### 2.1 Chosen Style: **Modular Monolith (Library Form)**

**Decision:** The core library will be built as a **modular monolith** — a single deployable npm package with strict internal module boundaries.

#### 2.2 Why Not Microservices?

| Option | Consideration | Decision |
| :--- | :--- | :--- |
| Microservices | Requires network calls between components; impossible inside a user's process; adds operational burden to the user | ❌ Rejected |
| Modular monolith | Single package; clear internal module boundaries; no network hops; easy to consume | ✅ Chosen |
| Unstructured monolith | No boundaries; tightly coupled code; hard to swap providers | ❌ Rejected |

**Rationale:** A library must be importable as a single package. Microservices require infrastructure that the user does not want to run. A **modular monolith** gives you the **internal separation of concerns** of microservices (clear module boundaries, dependency rules, swap-able adapters) without the operational cost — which is exactly the right trade-off for a distributable npm library.

#### 2.3 Module Boundary Rules (Enforced)

The modular monolith is governed by **strict dependency rules**:

```
┌─────────────────────────────────────────────┐
│  PUBLIC API (index.ts)                      │  ← only this is exported
└─────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌────────────┐   ┌──────────┐
│orchestr.│   │  queue     │   │config    │
└─────────┘   └────────────┘   └──────────┘
     │               │               │
     └───────┬───────┴───────┬───────┘
             ▼               ▼
     ┌──────────────┐ ┌──────────────┐
     │ interfaces   │ │ templates    │
     └──────────────┘ └──────────────┘
             │
             ▼
     ┌──────────────┐
     │  adapters    │  ← NEVER imported by core; injected at runtime
     └──────────────┘
```

**Rules:**

1. `interfaces/` has **no dependencies** on any other internal module. It is the foundation.
2. `orchestrator`, `queue`, `config`, `templates` depend on `interfaces` only.
3. `adapters` depend on `interfaces` only — **never** on the core.
4. The **core never imports a concrete adapter**. Adapters are **injected** at runtime via `createNotifier()`.
5. The **public API (`index.ts`)** is the only entry point — everything else is internal.
6. No circular dependencies allowed (enforced by ESLint `import/no-cycle`).

This gives you the **modularity benefits of microservices** (replaceability, testability, isolation) inside a **single npm package**.

---

### 3. High-Level System Context

The following C4-context diagram shows how NotifyKit sits in the user's world:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER'S NODE.JS APPLICATION                     │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                     NotifyKit (library)                      │   │
│   │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │   │
│   │  │Orchestrator│→ │  Queue   │→ │  Worker  │→ │  Adapters  │ │   │
│   │  └────────────┘  └──────────┘  └──────────┘  └────────────┘ │   │
│   └──────────────────────────────────────────────────────────────┘   │
│            │                  │                    │                  │
│            ▼                  ▼                    ▼                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐         │
│   │  User's .env │   │  User's Redis│   │ User's provider  │         │
│   │              │   │  (BullMQ)    │   │ credentials      │         │
│   └──────────────┘   └──────────────┘   └──────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────┐
                    ▼               ▼               ▼                   ▼
             ┌──────────┐   ┌──────────┐   ┌──────────┐        ┌──────────┐
             │ Twilio   │   │ MSG91    │   │  SMTP    │        │   FCM    │
             │ (SMS)    │   │ (SMS)    │   │ (Email)  │        │  (Push)  │
             └──────────┘   └──────────┘   └──────────┘        └──────────┘
```

**Actors and dependencies:**

| Actor | Role | Owned By |
| :--- | :--- | :--- |
| User's Node.js app | Hosts the library; calls `notify()` | User |
| User's Redis | Durable job queue (BullMQ) | User |
| User's `.env` | Credentials for providers | User |
| Provider APIs (Twilio, MSG91, SMTP, FCM) | Actual delivery | Third party |

**NotifyKit owns nothing at runtime. It orchestrates what the user already has.**

---

### 4. Component Architecture (Container View)

The system has **five containers** (packages), each with a distinct responsibility:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NotifyKit Ecosystem                          │
│                                                                      │
│  ┌────────────────────┐   ┌─────────────────────┐                   │
│  │  notifykit         │   │  notifykit-cli      │                   │
│  │  (core library)    │◄──│  (setup wizard)     │                   │
│  │                    │   │                     │                   │
│  │  - Orchestrator    │   │  - Prompts          │                   │
│  │  - BullMQ producer │   │  - Env writer       │                   │
│  │  - BullMQ worker   │   │  - SDK installer    │                   │
│  │  - Interfaces      │   │  - Validator        │                   │
│  │  - Templates       │   └─────────────────────┘                   │
│  └─────────┬──────────┘                                              │
│            │                                                         │
│            │ (interface contracts, loaded dynamically)              │
│            ▼                                                         │
│  ┌──────────────┬──────────────┬──────────────┬────────────────┐    │
│  │@notifykit/   │@notifykit/   │@notifykit/   │@notifykit/     │    │
│  │adapter-      │adapter-      │adapter-      │adapter-fcm     │    │
│  │nodemailer    │twilio        │msg91         │                │    │
│  └──────────────┴──────────────┴──────────────┴────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4.1 Container Responsibilities

| Container | Responsibility | Must NOT |
| :--- | :--- | :--- |
| **`notifykit`** (core) | Public API, orchestration, queue management, template rendering, interfaces | Import vendor SDKs; own a database; run HTTP server |
| **`notifykit-cli`** | Interactive setup, credential capture, `.env` writing, selective SDK install | Send notifications; modify runtime behavior |
| **`@notifykit/adapter-*`** | Translate standard interface → vendor API call | Contain business logic; access the queue; know about templates |

---

### 5. Module Design (Component View)

The **core library** (`notifykit`) is internally divided into **six modules** with strict boundaries.

#### 5.1 Module Map

```
src/
├── index.ts              ← public API surface
├── interfaces/           ← provider contracts (zero deps)
├── orchestrator/         ← the brain
├── queue/                ← BullMQ producer + worker
├── config/               ← env loading & validation
├── templates/            ← Handlebars rendering
└── logging/              ← Pino instance & redaction
```

#### 5.2 Module Specifications

##### Module 1: `interfaces/`

- **Purpose:** Define the contracts that all adapters implement.
- **Contains:** `EmailProvider`, `SmsProvider`, `PushProvider`, `NotificationEvent`, `NotificationResult`, `NotifierConfig`.
- **Dependencies:** **None.** This module is the foundation.
- **Rule:** Adding a field to an interface is a **breaking change** → major version bump.

##### Module 2: `config/`

- **Purpose:** Load `.env` variables, validate them against a Zod schema, and expose a typed config object.
- **Contains:** `loadConfig()`, `validateConfig()`, Zod schemas.
- **Dependencies:** `interfaces`, `dotenv`, `zod`.
- **Rule:** Invalid config must fail fast at `createNotifier()` time — never at delivery time.

##### Module 3: `templates/`

- **Purpose:** Load, cache, and render Handlebars templates with user data.
- **Contains:** `renderTemplate()`, `registerTemplate()`, `TemplateStore`.
- **Dependencies:** `interfaces`, `handlebars`.
- **Rule:** Templates can be registered in-memory or loaded from the filesystem. No external template service.

##### Module 4: `orchestrator/`

- **Purpose:** The brain. Validates events, resolves channel → adapter mapping, renders templates, and enqueues jobs.
- **Contains:** `notify()`, `validateEvent()`, `resolveChannels()`, `buildJobs()`.
- **Dependencies:** `interfaces`, `config`, `templates`, `queue`, `logging`.
- **Rule:** The orchestrator **never** calls a provider directly. It only enqueues.

##### Module 5: `queue/`

- **Purpose:** Manage the BullMQ producer (enqueue) and worker (process) lifecycle.
- **Contains:** `enqueueJob()`, `createWorker()`, `QueueRegistry`, `retryPolicy`.
- **Dependencies:** `interfaces`, `config`, `logging`, `bullmq`, `ioredis`.
- **Rule:** The worker is started by the user (via `notifier.startWorker()`) — never auto-started on import.

##### Module 6: `logging/`

- **Purpose:** Central Pino logger with credential redaction.
- **Contains:** `logger`, `redactPaths`.
- **Dependencies:** `pino`.
- **Rule:** All modules must use this logger. `console.log` is forbidden (ESLint rule).

#### 5.3 Module Dependency Matrix

| From ↓ / To → | interfaces | config | templates | queue | orchestrator | logging |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **interfaces** | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| **config** | ✅ | — | ❌ | ❌ | ❌ | ✅ |
| **templates** | ✅ | ❌ | — | ❌ | ❌ | ✅ |
| **queue** | ✅ | ✅ | ❌ | — | ❌ | ✅ |
| **orchestrator** | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **logging** | ❌ | ❌ | ❌ | ❌ | ❌ | — |

**Reading:** `orchestrator` depends on everything except `interfaces` (which it depends on) and `logging` (which it uses). `interfaces` depends on nothing. This is what keeps the module boundaries clean.

---

### 6. Data Flow & Sequence Diagrams

#### 6.1 Enqueue Flow (`notify()` call)

```
User Code          Orchestrator       Templates       Queue (BullMQ)      Redis
    │                   │                 │                 │                 │
    │ notify(event)     │                 │                 │                 │
    ├──────────────────►│                 │                 │                 │
    │                   │ validateEvent   │                 │                 │
    │                   ├──┐              │                 │                 │
    │                   │  │ zod parse    │                 │                 │
    │                   │◄─┘              │                 │                 │
    │                   │                 │                 │                 │
    │                   │ renderTemplate  │                 │                 │
    │                   ├────────────────►│                 │                 │
    │                   │                 │                 │                 │
    │                   │◄────────────────┤                 │                 │
    │                   │  rendered body  │                 │                 │
    │                   │                 │                 │                 │
    │                   │ enqueueJob       │                 │                 │
    │                   ├──────────────────────────────────►│                 │
    │                   │                 │                 │ addJob          │
    │                   │                 │                 ├────────────────►│
    │                   │                 │                 │                 │
    │                   │◄──────────────────────────────────┤                 │
    │◄──────────────────┤ { jobId }        │                 │                 │
```

**Key property:** `notify()` returns as soon as the job is durably in Redis. It does **not** wait for delivery.

#### 6.2 Delivery Flow (BullMQ worker)

```
Redis           Worker           Adapter (e.g. Twilio)      External API
  │               │                     │                        │
  │ job ready     │                     │                        │
  ├──────────────►│                     │                        │
  │               │ sendSms(opts)       │                        │
  │               ├────────────────────►│                        │
  │               │                     │ POST /Messages         │
  │               │                     ├───────────────────────►│
  │               │                     │                        │
  │               │                     │◄───────────────────────┤
  │               │                     │  200 OK                │
  │               │◄────────────────────┤                        │
  │               │ { success: true }   │                        │
  │               │                     │                        │
  │               │ ack job             │                        │
  │◄──────────────┤                     │                        │
  │  remove       │                     │                        │
```

#### 6.3 Failure & Retry Flow

```
Redis        Worker        Adapter        External API
  │            │              │                │
  │ job ready  │              │                │
  ├───────────►│              │                │
  │            │ send()       │                │
  │            ├─────────────►│                │
  │            │              │ POST           │
  │            │              ├───────────────►│
  │            │              │                │
  │            │              │◄───────────────┤
  │            │              │ 500 Error      │
  │            │◄─────────────┤                │
  │            │ { success:false, error }      │
  │            │              │                │
  │            │ retry (3x with backoff)       │
  │◄───────────┤ move to delayed queue         │
  │            │              │                │
  │  ... after max retries ...                 │
  │◄───────────┤ move to DLQ (dead-letter)     │
```

**Retry policy:** exponential backoff — 1s, 5s, 25s (configurable). After 3 attempts, the job moves to a dead-letter queue for manual inspection.

---

### 7. Tech Stack (Complete)

| Layer | Technology | Version | Rationale |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | ≥20 LTS | Modern async, stable `fetch`, native test runner |
| **Language** | TypeScript | ≥5.4 | Type safety across adapters; strict mode on |
| **Package manager** | npm | ≥10 | Universal; no need for pnpm/yarn |
| **HTTP framework** | Express.js | ≥4.19 | Familiar to target users; optional — only used if the user wants an HTTP trigger endpoint |
| **Queue** | BullMQ | ≥5 | Industry-standard Node.js job queue; Redis-backed |
| **Redis client** | ioredis | ≥5 | BullMQ's dependency; supports Redis Cluster |
| **Validation** | Zod | ≥3.23 | Runtime schema validation for events and config |
| **Templating** | Handlebars | ≥4.7 | Simple, widely understood, no heavy runtime |
| **Logging** | Pino | ≥9 | Fast, structured, built-in redaction |
| **Env loading** | dotenv | ≥16 | Standard `.env` support |
| **HTTP client** | Native `fetch` | Node 20+ | Zero-dependency; avoids `axios` bloat |
| **CLI prompts** | prompts | ≥2.4 | Interactive wizard |
| **CLI colors** | chalk | ≥5 | Terminal output |
| **CLI process** | execa | ≥9 | Safe `npm install` invocation |
| **Testing** | Vitest | ≥2 | Fast, ESM-native, TypeScript-first |
| **Integration tests** | Testcontainers | ≥10 | Real Redis in Docker for tests |
| **Lint/format** | ESLint + Prettier | latest | `import/no-cycle`, `no-console`, `@typescript-eslint/strict` |
| **Build** | tsup | ≥8 | Fast ESM+CJS dual output |
| **CI** | GitHub Actions | — | Matrix test on Node 20, 22, 24 |

#### 7.1 Dependency Policy (Critical)

The **core library** must remain **dependency-light**. Rules:

1. **Allowed in `dependencies`:** `bullmq`, `ioredis`, `zod`, `handlebars`, `pino`, `dotenv`.
2. **Forbidden in `dependencies`:** Any vendor SDK (`twilio`, `nodemailer`, `firebase-admin`).
3. **Vendor SDKs** live in adapter packages as `peerDependencies` — the user installs them explicitly (via the wizard).
4. **Dev dependencies** are unbounded but never shipped.

---

### 8. Queue & Job Architecture (BullMQ)

#### 8.1 Queue Topology

NotifyKit uses **four queues**, one per channel plus a dead-letter queue:

| Queue | Purpose | Concurrency |
| :--- | :--- | :--- |
| `notifykit:email` | Email delivery jobs | Configurable (default 5) |
| `notifykit:sms` | SMS delivery jobs | Configurable (default 5) |
| `notifykit:push` | Push delivery jobs | Configurable (default 10) |
| `notifykit:dlq` | Dead-letter (failed after retries) | Manual inspection only |

**Why one queue per channel?** Different channels have different rate limits and failure characteristics. Twilio's rate limit is per-number; FCM allows much higher throughput. Independent queues let the user scale concurrency per channel.

#### 8.2 Job Payload Schema

```typescript
interface NotificationJob {
  id: string;                  // uuid v7 (sortable)
  channel: 'email' | 'sms' | 'push';
  provider: string;            // adapter name
  to: Recipient;
  templateId: string;
  renderedBody: string;        // already rendered; worker doesn't re-render
  variables?: Record<string, string>;
  metadata: {
    enqueuedAt: number;
    userId?: string;
    traceId: string;           // correlation id
  };
}
```

**Design decision:** The job stores the **rendered body**, not the raw template + data. This means the worker does no rendering — it just calls the adapter. **Why?** Rendering at enqueue time catches template errors early (fail fast), and reduces worker CPU work, making the worker cheap to scale.

#### 8.3 Worker Lifecycle

Workers are **explicitly started** by the user:

```typescript
const notifier = createNotifier({ redis, providers });

notifier.startWorker({ channels: ['sms', 'email'] });  // explicit
```

**Why explicit?** Importing the library must never spin up workers as a side effect. That would break testing, violate the principle of least surprise, and cause unexpected Redis connections.

#### 8.4 BullMQ Configuration

| Setting | Default | Configurable |
| :--- | :--- | :--- |
| `attempts` | 3 | ✅ |
| `backoff.type` | `exponential` | ✅ |
| `backoff.delay` | 1000 ms | ✅ |
| `removeOnComplete` | `{ count: 1000 }` | ✅ |
| `removeOnFail` | `false` (kept for DLQ inspection) | ✅ |
| `limiter` | none (channel-specific) | ✅ |
| `concurrency` | per-channel default | ✅ |

---

### 9. Provider Adapter Architecture

#### 9.1 Adapter Contract

Every adapter must:

1. Export a class implementing `EmailProvider` | `SmsProvider` | `PushProvider`.
2. Export a `metadata` object declaring its name and required env vars.
3. **Never** import from the core library (only from `interfaces`).
4. Have zero side effects on import.

#### 9.2 Adapter Example (Skeleton)

```typescript
// @notifykit/adapter-twilio/src/index.ts
import type { SmsProvider } from 'notifykit/interfaces';

export const metadata = {
  name: 'twilio',
  channel: 'sms',
  requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
};

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';

  async sendSms(opts) {
    const client = getTwilioClient(); // lazy init
    try {
      const message = await client.messages.create({
        to: opts.to,
        from: opts.from,
        body: opts.body,
      });
      return { success: true, messageId: message.sid };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

#### 9.3 Adapter Loading Mechanism

The core resolves adapters via a **registry pattern** — adapters register themselves through the user's config:

```typescript
createNotifier({
  providers: {
    sms: { type: 'twilio', adapter: new TwilioSmsProvider() },
  },
});
```

**Why explicit injection instead of `require('@notifykit/adapter-twilio')`?** Explicit injection means:

- The core has **zero knowledge** of adapter package names.
- The user can swap adapters without changing the core.
- Testing is trivial — pass a mock adapter.
- Tree-shaking works: only the adapters the user imports end up in the bundle.

---

### 10. Error Handling & Retry Strategy

#### 10.1 Error Taxonomy

| Error Class | Retryable? | Example |
| :--- | :--- | :--- |
| **Validation error** | ❌ No | Invalid phone number format |
| **Auth error** | ❌ No | Wrong Twilio credentials (retrying won't fix) |
| **Transient provider error** | ✅ Yes | Twilio 500, FCM timeout |
| **Rate limit error** | ✅ Yes (delayed) | Twilio 429 |
| **Network error** | ✅ Yes | DNS failure, connection refused |
| **Unknown** | ✅ Yes (conservative) | Retry to be safe, escalate to DLQ |

#### 10.2 Error Classification (Adapter Responsibility)

Adapters must return a structured result:

```typescript
interface ProviderResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;   // ← adapter classifies
  retryAfterMs?: number; // ← for rate limits
}
```

The **worker** reads `retryable` and decides whether to retry. If `retryable === false`, the job moves straight to the DLQ.

#### 10.3 Retry Flow Summary

```
Attempt 1 → fail (retryable) → wait 1s
Attempt 2 → fail (retryable) → wait 5s
Attempt 3 → fail (retryable) → move to DLQ
```

Non-retryable errors skip straight to DLQ on attempt 1.

---

### 11. Configuration & Credential Management

#### 11.1 Config Sources (Priority Order)

1. Explicit config object passed to `createNotifier()`
2. Environment variables (`.env`)
3. Defaults

#### 11.2 Validation Rules

- All credentials validated at `createNotifier()` time via Zod.
- Missing required env vars → **immediate throw** with a clear message (e.g., "Twilio selected but `TWILIO_AUTH_TOKEN` is missing. Run `npx notifykit init` or set it in `.env`").
- No credential is ever logged; Pino redacts paths matching `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*`.

#### 11.3 `.env` Contract

```env
NOTIFYKIT_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
NOTIFYKIT_EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

The **wizard writes this file**; the **core reads it**; **nothing else touches it**.

---

### 12. Observability & Logging

#### 12.1 Logging (Pino)

Every log line includes:

- `traceId` (UUID per `notify()` call)
- `jobId`
- `channel`
- `provider`
- `durationMs` (for worker logs)

**Log levels:**

| Level | Used For |
| :--- | :--- |
| `info` | Job enqueued, job completed |
| `warn` | Retry attempt, rate limit |
| `error` | Job failed, DLQ entry |
| `debug` | Config resolved, adapter loaded |

#### 12.2 Metrics (Opt-in)

Optional Prometheus exporter (v1.1) exposing:

- `notifykit_jobs_enqueued_total{channel}`
- `notifykit_jobs_completed_total{channel,provider}`
- `notifykit_jobs_failed_total{channel,provider,reason}`
- `notifykit_job_duration_seconds{channel,provider}`
- `notifykit_queue_depth{queue}`

**Not in v1** — but the logging hooks are designed to make it trivial to add.

#### 12.3 Tracing

- `traceId` propagated from `notify()` → job metadata → adapter call.
- OpenTelemetry hook deferred to v1.1.

---

### 13. Security Architecture

| Threat | Mitigation |
| :--- | :--- |
| **Credential leakage in logs** | Pino redaction of `*TOKEN*`, `*KEY*`, `*SECRET*`, `*PASSWORD*` |
| **Credential leakage in errors** | Adapters catch errors and sanitize before returning |
| **Credential leakage in git** | Wizard writes `.env`; documentation instructs `.gitignore` |
| **Accidental browser usage** | No adapter ships a browser build; Twilio SDK explicitly documented as server-only |
| **Malicious adapter** | Adapters are sandboxed via the interface — they receive only what they need |
| **Supply chain attack on core deps** | Minimal dependencies; `npm audit` in CI; Dependabot enabled |
| **Redis credential exposure** | `REDIS_URL` handled like any other credential; redacted in logs |
| **Replay attacks on jobs** | Job IDs are UUID v7; idempotency key support in v1.1 |

---

### 14. Testing Architecture

#### 14.1 Test Pyramid

```
        ┌──────────────┐
        │   E2E (5%)   │   Real Redis + mock providers via Testcontainers
        ├──────────────┤
        │Integration   │   Worker + queue + adapter contract tests (25%)
        │    (25%)     │
        ├──────────────┤
        │ Unit tests   │   Orchestrator, config, templates, adapters (70%)
        │    (70%)     │
        └──────────────┘
```

#### 14.2 Test Types

| Type | Tool | Scope |
| :--- | :--- | :--- |
| **Unit** | Vitest | Orchestrator logic, template rendering, config validation |
| **Adapter contract** | Vitest + shared test suite | Every adapter runs the same contract tests |
| **Integration** | Testcontainers + real Redis | BullMQ enqueue → worker → mock adapter |
| **Wizard** | Vitest + `execa` | Simulated prompts, `.env` writes, install invocations |
| **E2E (optional)** | Real Redis + real Twilio test account (daily) | One live SMS per day |

#### 14.3 Adapter Contract Test Suite

Every adapter must pass the same test suite (provided by the core as `@notifykit/test-utils`):

- `sendSms()` returns `{ success: boolean }`
- Invalid options return `{ success: false, retryable: false }`
- Network errors return `{ success: false, retryable: true }`
- No credential leaks in error messages

**Why?** This guarantees that any adapter — official or community — behaves consistently. A new adapter author can validate their work in minutes.

---

### 15. Build, Packaging & Distribution

#### 15.1 Build Output

- **Format:** Dual (ESM + CJS) via `tsup`.
- **Types:** `.d.ts` generated for both.
- **Tree-shakable:** `sideEffects: false` in `package.json`.
- **Bundler compatibility:** No `require()` of dynamic module names (breaks Webpack).

#### 15.2 `package.json` Exports

```json
{
  "name": "notifykit",
  "type": "module",
  "sideEffects": false,
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
  "files": ["dist", "README.md", "LICENSE"]
}
```

#### 15.3 Distribution Channels

| Channel | Purpose |
| :--- | :--- |
| **npm registry** | Primary distribution (public, free) |
| **GitHub Releases** | Changelog, source tag |
| **Docs site** (GitHub Pages / Vercel) | Guides, examples |
| **Example repo** | `notifykit-examples` — 4 examples (email-only, sms-only, both, CI mode) |

#### 15.4 Bundle Size Budget

| Package | Budget |
| :--- | :--- |
| `notifykit` (core) | ≤ 60 KB minified |
| Each adapter | ≤ 10 KB minified |
| `notifykit-cli` | ≤ 200 KB minified (not shipped at runtime) |

**Enforced in CI** via `size-limit`.

---

### 16. Versioning & Release Strategy

#### 16.1 Semantic Versioning

- **Core and adapters version independently.**
- Adapters declare a **compatible core range** via `peerDependencies`: `"notifykit": "^1.0.0"`.
- Breaking changes to `interfaces/` → **major version bump** on core; adapters follow.

#### 16.2 Release Channels

| Channel | npm tag | Purpose |
| :--- | :--- | :--- |
| Stable | `latest` | Production |
| Beta | `beta` | Early adopters |
| Canary | `canary` | Nightly, from `main` |

#### 16.3 Release Process

1. Changeset added to PR.
2. On merge to `main`, GitHub Actions builds and runs full test suite.
3. Changesets bot opens a version PR.
4. Maintainer merges → npm publish with provenance (`--provenance`).
5. Git tag created; release notes auto-generated.

**Provenance is mandatory** (npm's supply-chain attestation) — it proves the package was built from this repo's CI, not from a maintainer's laptop.

---

### 17. Performance & Scaling Considerations

#### 17.1 Core Library Overhead

| Operation | Budget |
| :--- | :--- |
| `createNotifier()` | < 50 ms (init time) |
| `notify()` (enqueue only) | < 10 ms |
| Template render | < 5 ms per template |
| Memory footprint | < 30 MB (excluding Redis) |

#### 17.2 Scaling Model

**Horizontal scaling:** The user runs multiple instances of their app; each instance creates its own BullMQ worker. BullMQ's Redis-based locking ensures each job is processed exactly once.

**Vertical scaling:** Increase `concurrency` per worker in config.

**High-volume guidance:**

- Redis Cluster supported via `ioredis` cluster mode.
- For > 10K notifications/minute, user should split channels across processes.
- Documentation provides sizing guidance (e.g., "1 worker with concurrency 5 handles ~50 SMS/sec against Twilio").

#### 17.3 Known Bottlenecks

| Bottleneck | Why | Mitigation |
| :--- | :--- | :--- |
| **Template rendering** | Handlebars CPU | Rendered at enqueue; not per-retry |
| **Redis connection per process** | Connection overhead | Single shared ioredis instance per process |
| **Adapter SDK latency** | Twilio API ~200 ms | Worker concurrency absorbs it |

---

### 18. Deployment Topology (User Side)

NotifyKit does not have its own deployment. The **user's** deployment looks like this:

```
┌─────────────────────────────────────────────────────┐
│               User's Node.js App (Container)         │
│                                                     │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐   │
│  │HTTP server  │  │Orchestrator│  │BullMQ worker│   │
│  │(Express)    │  │  (inproc)  │  │  (inproc)   │   │
│  └─────────────┘  └────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────┘
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌──────────┐     ┌──────────────┐
    │ Redis  │◄─────┤ Same app │     │ Provider APIs│
    │(external)│    └──────────┘     └──────────────┘
    └────────┘
```

**Recommended (production):** separate the HTTP server and BullMQ worker into **two processes** of the same Docker image, so they can scale independently.

The user can run:

- **All-in-one:** Single process (fine for small apps).
- **Split:** `web` container (HTTP) + `worker` container (BullMQ worker) sharing the same Redis.

The library supports both via the explicit `startWorker()` call.

---

### 19. Directory Structure

#### 19.1 Monorepo Layout

```
notifykit/                        # git monorepo
├── packages/
│   ├── core/                     # notifykit
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── interfaces/
│   │   │   ├── config/
│   │   │   ├── templates/
│   │   │   ├── orchestrator/
│   │   │   ├── queue/
│   │   │   └── logging/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                      # notifykit-cli
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prompts/
│   │   │   ├── env-writer.ts
│   │   │   ├── installer.ts
│   │   │   └── validator.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── adapter-nodemailer/       # @notifykit/adapter-nodemailer
│   ├── adapter-twilio/           # @notifykit/adapter-twilio
│   ├── adapter-msg91/            # @notifykit/adapter-msg91
│   ├── adapter-fcm/              # @notifykit/adapter-fcm
│   └── test-utils/               # @notifykit/test-utils (contract test suite)
│
├── examples/
│   ├── email-only/
│   ├── sms-only/
│   ├── both-channels/
│   └── ci-mode/
│
├── docs/
│   ├── getting-started.md
│   ├── architecture.md           # ← this document
│   ├── adapters.md
│   └── troubleshooting.md
│
├── .changeset/
├── pnpm-workspace.yaml            # or npm workspaces
├── turbo.json                     # optional, for build caching
└── README.md
```

**Monorepo tooling:** npm workspaces (simplest, no extra tools for users) or pnpm + Turborepo (faster builds). Decision deferred to build phase.

---

### 20. Architectural Decision Records (ADRs)

#### ADR-001: Modular Monolith over Microservices

- **Decision:** Build the core as a modular monolith.
- **Reason:** Libraries must be single packages; microservices require infrastructure the user won't run.
- **Consequence:** Enforce module boundaries via ESLint to prevent drift.

#### ADR-002: BullMQ + Redis for Reliability

- **Decision:** Use BullMQ with the user's Redis.
- **Reason:** Provides durable retries without NotifyKit owning infrastructure.
- **Consequence:** User must have Redis. Documented clearly.

#### ADR-003: Adapters Injected, Not Imported

- **Decision:** The core never imports adapter packages; users inject them.
- **Reason:** Keeps core vendor-free; enables tree-shaking; simplifies testing.
- **Consequence:** Slightly more verbose user code (`new TwilioSmsProvider()`).

#### ADR-004: Render Templates at Enqueue Time

- **Decision:** Store rendered body in the job payload.
- **Reason:** Fail-fast on template errors; worker stays cheap.
- **Consequence:** If a template changes after enqueue, in-flight jobs use the old render (acceptable; notifications are point-in-time).

#### ADR-005: Explicit `startWorker()`, Not Implicit

- **Decision:** Worker must be started explicitly by the user.
- **Reason:** No side effects on import; respects testing and deployment topology.
- **Consequence:** Users must remember to call `startWorker()`. Documented in every example.

#### ADR-006: MIT License for Core

- **Decision:** MIT.
- **Reason:** Maximum adoption; developers trust permissive licenses.
- **Consequence:** Cannot prevent forking. Business model relies on premium features, not license control.

#### ADR-007: No `postinstall` Wizard

- **Decision:** Wizard invoked via `npx notifykit init`.
- **Reason:** npm v12 disables install scripts by default; interactive prompts break CI.
- **Consequence:** Users must run one extra command. Documented prominently.

#### ADR-008: Pino for Logging

- **Decision:** Pino everywhere; `console.log` forbidden via ESLint.
- **Reason:** Structured logs, redaction, and low overhead.
- **Consequence:** All contributors must use the shared logger.

---

### 21. Non-Functional Requirements

| Category | Requirement | Target |
| :--- | :--- | :--- |
| **Performance** | `notify()` latency | < 10 ms (p99) |
| **Performance** | Template render | < 5 ms (p99) |
| **Reliability** | At-least-once delivery | Guaranteed via BullMQ |
| **Reliability** | Retry on transient failure | 3 attempts, exponential backoff |
| **Reliability** | DLQ for terminal failures | 100% of failed jobs after retries |
| **Scalability** | Concurrent jobs per worker | Configurable (default 5–10) |
| **Scalability** | Redis Cluster | Supported |
| **Security** | Credential redaction | 100% of Pino logs |
| **Security** | Zero telemetry | No phone-home in v1 |
| **Compatibility** | Node.js versions | 20, 22, 24 (LTS + current) |
| **Compatibility** | ESM + CJS | Both |
| **Compatibility** | TypeScript | Strict mode, full types |
| **Maintainability** | Test coverage | ≥ 85% lines (core) |
| **Maintainability** | Adapter contract tests | 100% of official adapters |
| **Observability** | Structured logs | 100% of code paths |
| **Bundle size** | Core | ≤ 60 KB minified |

---

### 22. Future Evolution (v1.1 → v2)

#### v1.1 (Post-launch)

- Optional **MongoDB delivery-log adapter** (user-supplied connection string).
- **Prometheus metrics exporter**.
- **OpenTelemetry tracing** hook.
- **Idempotency keys** in `notify()`.
- **Additional providers**: Resend, SES, Plivo, Telnyx.

#### v1.5

- **Webhook delivery status tracking** (per job).
- **Template versioning** with rollback.
- **User preference engine** (opt-in/out, digests).
- **Scheduled notifications** (send at a future time).

#### v2.0 (Commercial tier)

- **Hosted control plane** (dashboard for templates + analytics) — sending still in user infra.
- **Multi-tenant support** (per-tenant configs).
- **Visual workflow builder** (optional GUI that compiles to code).
- **Enterprise SSO and audit logs**.

---

### 23. Glossary

| Term | Definition |
| :--- | :--- |
| **Adapter** | A package implementing a provider interface (e.g., `TwilioSmsProvider`) |
| **Orchestrator** | The module that validates events and enqueues jobs |
| **Producer** | The part of BullMQ that adds jobs to the queue |
| **Worker** | The part of BullMQ that processes jobs |
| **DLQ** | Dead-letter queue — where jobs go after exhausting retries |
| **Trace ID** | UUID correlating all logs for one `notify()` call |
| **Modular monolith** | A single deployable with strict internal module boundaries |
| **Peer dependency** | A dependency the user installs explicitly, not bundled by the parent |
| **Tree-shaking** | Build optimization that removes unused code |
| **Provenance** | npm's supply-chain proof that a package was built from CI |

---

**End of Architecture Document v1.0**

---

This document is the complete system design for NotifyKit. It defines:

- **What style:** Modular monolith (library form)
- **What stack:** TypeScript, BullMQ, Redis, Pino, Zod, Handlebars, Express (optional)
- **What modules:** Six internal modules with enforced dependency rules
- **What flows:** Enqueue, delivery, failure/retry
- **What contracts:** Provider interfaces, job payloads, error taxonomy
- **What guarantees:** Non-functional requirements (performance, reliability, security)
- **What decisions:** Eight ADRs documenting the "why" behind every choice

Combined with the PRD, this gives you a **complete, self-contained specification** you can hand to any engineer, AI assistant, or stakeholder.

Would you like me to next:
1. Draft the **TypeScript interfaces file** (all the `interfaces/` module content), or
2. Draft the **CLI wizard prompt flow** in detail, or
3. Draft the **README.md** for the npm package launch?




---

# 6. Source Appendix B — Architecture Addendum v1.0

## 📎 `ARCHITECTURE-ADDENDUM.md` — Database & State Strategy + API-First Principles + New ADRs

**Document Version:** 1.0
**Status:** Complete — designed to be merged into `ARCHITECTURE.md` as v1.1
**Companion Documents:** `PRD.md`, `ARCHITECTURE.md`, `PHASES.md`, `AGENTS.md`
**Last Updated:** October 2026
**Purpose:** Close three real gaps in `ARCHITECTURE.md`:
1. A dedicated **Database & State Strategy** section (currently scattered across §1, §9, §14, ADR-002).
2. An explicit **Redis Data Model** (key naming, TTL, retention, sizing) — currently undefined.
3. An explicit **API-First Design Principles** section — currently only the library API is specified, and the optional HTTP surface is a one-line mention.

**How to use this file:** Merge each section into `ARCHITECTURE.md` at the indicated insertion point. Each section is numbered to sit inside the existing structure without renumbering the rest of the document.

---

### Table of Contents

**Part A — Database & State Strategy**
- A.1 Where this section fits
- A.2 The Stateless Principle (formal statement)
- A.3 Complete State Inventory
- A.4 Redis Data Model
- A.5 Memory Sizing & Retention
- A.6 Redis Failure Semantics
- A.7 The "Good Citizen" Rules
- A.8 The v1.1 MongoDB Trigger (explicit criteria)
- A.9 Why No PostgreSQL / MySQL / SQLite in v1
- A.10 Compatibility with the User's Own Database

**Part B — API-First Design Principles**
- B.1 Where this section fits
- B.2 What "API-First" Means for a Library (and What It Does Not)
- B.3 The Two APIs (Library API + Optional HTTP API)
- B.4 Library API Versioning
- B.5 Library API Contract Testing
- B.6 HTTP API Specification (OpenAPI 3.1)
- B.7 HTTP API Versioning
- B.8 Standard Error Envelope
- B.9 Idempotency
- B.10 The `@notifykit/http` Package (Optional, v1.1)
- B.11 Why HTTP is Deferred to v1.1

**Part C — New Architectural Decision Records**
- ADR-009: Redis-Only State — No Database in v1
- ADR-010: API-First — Dual-Surface Versioning Discipline
- ADR-011: `@notifykit/http` Deferred to v1.1

**Part D — PHASES.md Impact**
- D.1 Task additions per phase
- D.2 Updated release gates

---

## Part A — Database & State Strategy

#### A.1 Where This Section Fits

**Insert into `ARCHITECTURE.md` as new Section §13.5, immediately after §13 (Security Architecture) and before §14 (Testing Architecture).**

**Rationale:** §13 ends the discussion of what the system *protects*. Section §13.5 answers the adjacent question: what state does the system *produce*, where does it live, and for how long? The answer is short — Redis only — but the *discipline* of that answer must be explicit and auditable.

---

#### A.2 The Stateless Principle (Formal Statement)

> **NotifyKit owns zero durable state. It borrows the user's Redis exclusively as a BullMQ backing store, for the lifetime of each notification job. It never reads, writes, or scans any key outside the `notifykit:*` namespace. It never requires a relational database, document store, or object store in v1.**

This principle is the reason the core library can be:

- **Distributed at zero cost** to the creator (npm is free, no servers to run).
- **Installed in seconds** (no migrations, no schema setup, no DB provisioning).
- **Tested in CI** (Testcontainers spins up Redis; no DB state to seed).
- **Deleted cleanly** (removing the package leaves no orphaned data in the user's infrastructure beyond what BullMQ already manages).

If a future feature cannot satisfy this principle, it must be added as a **separate optional package** (e.g., `@notifykit/mongo-log`, `@notifykit/http`) — never folded into the core.

---

#### A.3 Complete State Inventory

This table is the authoritative list of every piece of state NotifyKit touches at runtime. If a future phase introduces new state, this table MUST be updated in the same PR.

| State | Where It Lives | Owned By | Lifetime | TTL / Retention |
| :--- | :--- | :--- | :--- | :--- |
| **Pending job** | Redis `bull:notifykit:<channel>:*` | User's Redis | Until picked up by a worker | Deleted on completion (see A.4) |
| **Active job** (in-flight) | Redis | User's Redis | Duration of the adapter call | Deleted on success or retry scheduling |
| **Delayed job** (retry backoff) | Redis `bull:notifykit:<channel>:delayed` | User's Redis | 1s → 5s → 25s backoff | Deleted when promoted to active |
| **Completed job** | Redis `bull:notifykit:<channel>:completed` | User's Redis | Configurable | Default: keep last 1,000 per channel (`removeOnComplete: { count: 1000 }`) |
| **Failed job** (awaiting retry) | Redis `bull:notifykit:<channel>:failed` | User's Redis | Until max retries exhausted | Promoted to DLQ on terminal failure |
| **Dead-letter job** (terminal) | Redis `bull:notifykit:dlq:*` | User's Redis | Until user inspects | **No default TTL** — user must configure |
| **Template source** | In-memory `TemplateStore` | User's process memory | Lifetime of the process | Cleared on `stopWorker()` / process exit |
| **Provider config** | User's `.env` file | User's filesystem | Until user changes it | N/A (not NotifyKit's concern) |
| **Logs** | stdout (Pino JSON) | User's log aggregator | User-defined | User-defined |
| **Trace ID** | In-memory propagation | User's process memory | Duration of one `notify()` call | Discarded on return |
| **Metrics** (v1.1) | Prometheus endpoint | User's monitoring | User-defined | User-defined |

**Nothing in this table lives on infrastructure owned by the creator of NotifyKit.** Every row belongs to the user.

---

#### A.4 Redis Data Model

##### A.4.1 Key Naming Convention

BullMQ is opinionated about its key structure. NotifyKit does not override it — but must **document** it so users can inspect Redis confidently.

| Key pattern | Purpose | Example |
| :--- | :--- | :--- |
| `bull:notifykit:<channel>:<jobId>` | Job payload (hash) | `bull:notifykit:sms:0192a4...` |
| `bull:notifykit:<channel>:wait` | Queue of pending job IDs (list) | `bull:notifykit:sms:wait` |
| `bull:notifykit:<channel>:active` | In-flight job IDs (list) | `bull:notifykit:sms:active` |
| `bull:notifykit:<channel>:delayed` | Delayed jobs (sorted set) | `bull:notifykit:sms:delayed` |
| `bull:notifykit:<channel>:completed` | Completed job IDs (sorted set) | `bull:notifykit:sms:completed` |
| `bull:notifykit:<channel>:failed` | Failed job IDs (sorted set) | `bull:notifykit:sms:failed` |
| `bull:notifykit:dlq:<jobId>` | Dead-letter job payload | `bull:notifykit:dlq:0192a4...` |
| `bull:notifykit:<channel>:meta` | Queue metadata (paused, concurrency) | `bull:notifykit:sms:meta` |

**Rule:** NotifyKit never touches any key that does not start with `bull:notifykit:`. Any code that scans, reads, or deletes a key outside this namespace is a defect.

##### A.4.2 TTL and Retention Policy

BullMQ does **not** set TTLs by default. Without configuration, Redis will grow indefinitely. NotifyKit must set safe defaults and document them.

| Queue | `removeOnComplete` | `removeOnFail` | Rationale |
| :--- | :--- | :--- | :--- |
| `notifykit:email` | `{ count: 1000, age: 86400 }` | `{ count: 5000, age: 604800 }` | Keep 1,000 completed jobs (24h) and 5,000 failed jobs (7d) for debugging |
| `notifykit:sms` | `{ count: 1000, age: 86400 }` | `{ count: 5000, age: 604800 }` | Same as email |
| `notifykit:push` | `{ count: 5000, age: 86400 }` | `{ count: 10000, age: 604800 }` | Push is higher volume; keep more history |
| `notifykit:dlq` | `{ count: 0 }` (never auto-remove) | N/A | DLQ must be inspected manually |

**All values are overridable** by the user via `startWorker({ retention: {...} })`. The defaults are the **safe maximum** — users with high volume should lower them.

**Why these numbers?**

- 1,000 completed jobs at ~1 KB each = ~1 MB. Trivial.
- 5,000 failed jobs at ~1 KB each = ~5 MB. Trivial, but plenty for post-mortem debugging.
- After 7 days, failed jobs older than that are assumed irrelevant — the user should have triaged them.

##### A.4.3 What BullMQ Also Creates

BullMQ also uses these auxiliary keys under the same prefix:

- `bull:notifykit:<channel>:id` — monotonic job ID counter
- `bull:notifykit:<channel>:stalled-check` — lock for stalled-job detection
- `bull:notifykit:<channel>:events` — event stream (used by `QueueEvents`)

These are managed by BullMQ. NotifyKit does not touch them directly, but they contribute to the memory footprint (see A.5).

##### A.4.4 Job Payload Size

The `NotificationJob` schema from `ARCHITECTURE.md §8.2` is deliberately small. Measured values:

| Field | Typical Size |
| :--- | :--- |
| `id` (UUID v7) | 36 bytes |
| `channel` | 5 bytes |
| `provider` | 6–8 bytes |
| `to` (recipient object) | ~100 bytes |
| `templateId` | ~20 bytes |
| `renderedBody` | ~500 bytes – 5 KB (depends on template) |
| `variables` | ~100 bytes |
| `metadata` | ~100 bytes |
| **Total per job** | **~1 KB – 6 KB** |

**Rendered body dominates the payload size.** For email templates with HTML, expect ~5 KB per job. For SMS (140 chars), expect ~200 bytes.

**Design decision (already made in ADR-004):** Rendering at enqueue time means we store the rendered body instead of the raw template + data. This is ~3–4× larger per job but makes the worker dramatically simpler and cheaper to scale.

---

#### A.5 Memory Sizing & Retention

##### A.5.1 Redis Memory Estimates

| Jobs in flight | Pending | Completed | Memory (approx) |
| :--- | :--- | :--- | :--- |
| 1,000 | 1,000 × 1 KB = 1 MB | 1,000 × 1 KB = 1 MB | **~3 MB** (with overhead) |
| 10,000 | 10 MB | 10 MB | **~30 MB** |
| 100,000 | 100 MB | 100 MB | **~300 MB** |
| 1,000,000 | 1 GB | 1 GB | **~3 GB** |

**Rule of thumb:** Each in-flight job costs **~3 KB of Redis memory** (payload + indexes + overhead). For email with HTML bodies, assume **~7 KB per job**.

##### A.5.2 Recommended Redis Sizing (Documentation for Users)

NotifyKit's docs must include this table so users size their Redis correctly:

| Daily volume | Peak in-flight | Recommended Redis RAM |
| :--- | :--- | :--- |
| < 10,000 | < 100 | 64 MB |
| 10,000 – 100,000 | < 1,000 | 256 MB |
| 100,000 – 1,000,000 | < 10,000 | 512 MB – 1 GB |
| > 1,000,000 | > 10,000 | 2 GB+ (consider Redis Cluster) |

**Note:** These are minimums for NotifyKit alone. The user's Redis is shared with their app, so add their existing footprint.

---

#### A.6 Redis Failure Semantics

The user must understand what happens when Redis is unavailable. Documented behavior:

| Scenario | What Happens | Recovery |
| :--- | :--- | :--- |
| **Redis down at `notify()` time** | `notify()` throws `RedisConnectionError` with a clear message. No job is enqueued. | User retries after Redis recovers. |
| **Redis down while worker is running** | Worker reconnects with exponential backoff (ioredis default). In-flight jobs are retried when Redis returns. | Automatic. |
| **Redis data lost** (flush, volume gone) | All pending, delayed, and in-flight jobs are lost. Delivered jobs are unaffected (they are gone). | **Notification loss is possible.** This is a known limitation. |
| **Redis restart** (data persisted) | BullMQ recovers the queue. Stalled jobs are retried. | Automatic. |
| **Redis restart** (no persistence) | Same as data loss. | **Documentation must warn: enable Redis persistence (`AOF` or `RDB`) in production.** |
| **Redis full** (`maxmemory` reached) | `notify()` throws `OOM command not allowed` error. | User must increase `maxmemory` or enable `maxmemory-policy allkeys-lru` (with caveat: LRU may evict pending jobs). |

**Critical documentation requirement:** The README must state clearly:

> "NotifyKit uses your Redis as a durable queue. Enable Redis persistence (`appendonly yes`) in production. If Redis is lost, pending notifications are lost. Delivered notifications are not NotifyKit's responsibility — they are already delivered."

---

#### A.7 The "Good Citizen" Rules

Because NotifyKit uses the user's Redis (which they share with their own app), it must follow strict rules to avoid disrupting their infrastructure.

| Rule | Reason |
| :--- | :--- |
| **Only use the `bull:notifykit:*` namespace.** | Never collide with the user's keys. |
| **Never run `KEYS *`, `SCAN *`, or `FLUSHDB`.** | These operations block Redis and can delete the user's data. |
| **Never change Redis server configuration.** | NotifyKit is a guest, not an admin. |
| **Never use `SELECT` to switch databases.** | Use Redis DB 0 (the default), like every BullMQ user. |
| **Use a dedicated `ioredis` connection per process, not per queue.** | One connection serves all four queues. Reduces connection overhead. |
| **Close the Redis connection on `stopWorker()` and process exit.** | Never leak connections. |
| **Document the `maxRetriesPerRequest` setting (BullMQ requires `null`).** | BullMQ blocks indefinitely on `BRPOPLPUSH`; the ioredis client must be configured with `maxRetriesPerRequest: null`. |
| **Never exceed the user's `maxmemory` by design.** | Retention limits (A.4.2) prevent unbounded growth. |
| **Never use Redis Pub/Sub for internal signaling.** | BullMQ already handles events; adding Pub/Sub would mix concerns. |

These rules are enforced by code review and by an ESLint custom rule (future) that greps for forbidden Redis commands.

---

#### A.8 The v1.1 MongoDB Trigger (Explicit Criteria)

The v1.1 roadmap mentions an optional MongoDB adapter. This section defines the **exact criteria** that must be met before it is built, so it is not added prematurely.

**The MongoDB adapter (`@notifykit/mongo-log`) will be built ONLY when ALL of these are true:**

1. **≥ 100 users have requested persistent delivery history** (via GitHub issues, npm comments, or community channels).
2. **≥ 10 users have asked for it specifically by name** (MongoDB, not "a database").
3. **The BullMQ `completed` queue is proven insufficient** for post-mortem debugging in at least 3 real-world cases.
4. **The adapter can be built as a peer package** that adds MongoDB as a `peerDependency` — never bundled in core.
5. **The adapter respects the stateless principle** — it writes to the user's own MongoDB instance, not to any NotifyKit-owned database.

**What the adapter will do (when built):**

- Listen to BullMQ `completed` and `failed` events.
- Write a delivery record to the user's MongoDB.
- Record schema: `{ jobId, channel, provider, recipient, status, deliveredAt, error?, traceId }`.
- Never block delivery — writes are fire-and-forget (async, with its own retry).

**What the adapter will NOT do:**

- ❌ Store templates.
- ❌ Store user preferences.
- ❌ Become a source of truth for job state.
- ❌ Replace BullMQ.

**Until all five criteria are met, the answer to "can I persist delivery logs?" is: "Configure the BullMQ `completed` retention to a higher value, or consume the `QueueEvents` stream in your own code."**

---

#### A.9 Why No PostgreSQL / MySQL / SQLite in v1

An honest evaluation of why the other common databases are excluded:

| Database | Why Not |
| :--- | :--- |
| **PostgreSQL** | Overkill for job queueing. Would require the user to provision a Postgres instance (or add one), run migrations, and manage schema versioning. BullMQ + Redis is simpler and faster. Postgres also has higher operational overhead than Redis for this use case. |
| **MySQL** | Same as Postgres. Also, the Node.js MySQL ecosystem is less ergonomic than the Postgres one. |
| **SQLite** | Single-writer bottleneck. Cannot serve as a job queue for a server process under load. Also, SQLite on networked filesystems is unreliable. |
| **MongoDB** | Would be the *only* DB if any were included — but the reasoning in A.8 applies: it is not needed for v1, and adding it as an optional peer package is the correct path. |
| **DynamoDB / Firestore** | Tied to a specific cloud. Violates the vendor-neutral principle. |
| **Embedded (LevelDB, LMDB)** | Not suitable for multi-process or multi-machine deployments. Would lock users into single-process setups. |

**Conclusion:** Redis (via BullMQ) is the correct and only state layer for v1. It is simple, fast, user-owned, and requires no schema management.

---

#### A.10 Compatibility with the User's Own Database

**Important clarification (worth stating explicitly):** NotifyKit is **fully compatible** with any database the user already has. It simply **does not use it**.

| User's existing setup | NotifyKit's interaction |
| :--- | :--- |
| **User has MongoDB** | NotifyKit does not touch it. MongoDB is used by their app; NotifyKit uses their Redis. |
| **User has PostgreSQL** | Same — NotifyKit ignores it. |
| **User has MySQL** | Same. |
| **User has no database** | Fine — NotifyKit requires only Redis. |
| **User uses Redis for their app's caching** | Fine — NotifyKit uses a `notifykit:*` key namespace that does not collide. |
| **User has no Redis** | NotifyKit cannot function. The user must provision Redis (Docker, Upstash, Redis Cloud, or their own). |

**The wizard (`npx notifykit init`) should ask:** "Where is your Redis?" and provide options:
- I have a Redis URL → prompt for it
- I use Docker → provide a `docker run` snippet
- I use a cloud provider → link to Upstash / Redis Cloud / Railway

**The wizard MUST NOT ask about MongoDB, Postgres, or any other database.** Those are out of scope for NotifyKit.

---

## Part B — API-First Design Principles

#### B.1 Where This Section Fits

**Insert into `ARCHITECTURE.md` as new Section §10.5, immediately after §10 (Core Library Specification) and before §11 (CLI Setup Wizard Specification).**

**Rationale:** §10 defines the library API's *shape*. This section defines its *governance*: versioning, contract testing, error envelope, and the optional HTTP surface. Together they answer: "How do we guarantee API stability across releases?"

---

#### B.2 What "API-First" Means for a Library (and What It Does Not)

"API-first" is often used as a buzzword. For a library like NotifyKit, it means **four concrete disciplines**:

1. **The public type surface (`interfaces/`) is the contract.** It is designed before implementation, documented with TSDoc, and versioned independently of internal modules.
2. **Every public API change is a deliberate, versioned decision.** No accidental breaking changes. Ever.
3. **Every public API method has a contract test** that runs against the published type surface — not against an internal mock.
4. **An optional HTTP surface, if ever built, is specified by an OpenAPI document first** — the code is generated from or validated against the spec, not the reverse.

**What "API-first" does NOT mean for a library:**

- ❌ It does not mean "build a REST API before the library." The library is the primary artifact; the HTTP surface is optional and deferred.
- ❌ It does not mean "add OpenAPI to a TypeScript type." TypeScript already gives us the type surface; OpenAPI is only for the HTTP layer.
- ❌ It does not mean "expose every internal module." The public surface is *deliberately* narrow (`src/index.ts` + `src/interfaces/index.ts`).
- ❌ It does not mean "version every function." Only the package version matters; individual functions are versioned via semver of the whole package.

---

#### B.3 The Two APIs (Library API + Optional HTTP API)

NotifyKit has **two distinct API surfaces**, with different governance:

| Surface | What It Is | Status in v1 | Versioned By |
| :--- | :--- | :--- | :--- |
| **Library API** | The TypeScript types and functions exported from `notifykit` | ✅ Primary | npm package version (semver) |
| **HTTP API** | REST endpoints for triggering notifications from any language | ⏸ Deferred to v1.1 | URL path prefix (`/v1/`, `/v2/`) |

Both are "first-class" when they exist. The HTTP API is deferred, not deprioritized — it is deferred precisely so v1 can be excellent at the library surface.

---

#### B.4 Library API Versioning

##### B.4.1 Semver Rules

The `notifykit` package follows **strict semver**:

| Change Type | Version Bump | Examples |
| :--- | :--- | :--- |
| **Patch** | `1.0.0` → `1.0.1` | Bug fix that does not change any type signature |
| **Minor** | `1.0.0` → `1.1.0` | Add a new optional field to an interface; add a new exported helper |
| **Major** | `1.0.0` → `2.0.0` | Rename or remove an interface field; change a function signature; change error class hierarchy |

##### B.4.2 What Counts as "Public"

Only these are public and subject to semver guarantees:

| Public | Path |
| :--- | :--- |
| Main entry | `notifykit` (`dist/index.js`, `dist/index.d.ts`) |
| Interfaces entry | `notifykit/interfaces` (`dist/interfaces/index.js`, `dist/interfaces/index.d.ts`) |
| Package metadata | `package.json` `exports`, `peerDependencies`, `engines` |

**Everything else is internal.** Internal modules (`orchestrator/`, `queue/`, `config/`, `templates/`, `logging/`) can change freely between versions — they are not exported from `index.ts`.

##### B.4.3 Deprecation Policy

When a public API is deprecated:

1. Add `@deprecated` TSDoc tag with a migration example.
2. Ship the deprecation in a **minor** release.
3. Keep the deprecated API working for **one major release** (e.g., deprecated in `1.5.0`, removed in `2.0.0`).
4. Log a deprecation warning at runtime (Pino `warn` level) — but only once per process.
5. Document in `CHANGELOG.md` with a `### Deprecated` section.

##### B.4.4 Adapter Versioning

Each adapter is its own npm package, versioned **independently**:

- `@notifykit/adapter-twilio@2.0.0` can require `notifykit@^2.0.0`.
- Adapters declare their compatible core range via `peerDependencies`.
- A breaking change to `interfaces/` requires a major bump on **core and every adapter**.

**This is a real maintenance cost.** It is the price of the modular architecture — but it is what keeps adapters isolated.

---

#### B.5 Library API Contract Testing

##### B.5.1 What Contract Testing Means Here

Every public type and function in `interfaces/` and `index.ts` must have a **contract test** that verifies:

1. The type signature compiles as documented.
2. The runtime behavior matches the documented contract.
3. The error class hierarchy is correct.
4. No public API returns `any` or `unknown` without narrowing.

##### B.5.2 Where Contract Tests Live

```
packages/core/tests/contract/
├── interfaces.test-d.ts        ← type-level contract test (via tsd or vitest typecheck)
├── notify.test.ts              ← runtime contract of notify()
├── create-notifier.test.ts     ← runtime contract of createNotifier()
├── start-worker.test.ts        ← runtime contract of startWorker()
├── errors.test.ts              ← error class hierarchy contract
└── provider-interfaces.test-d.ts  ← type-level contract of EmailProvider, SmsProvider, PushProvider
```

##### B.5.3 Contract Test Requirements

| Test | Tool | What It Verifies |
| :--- | :--- | :--- |
| Type-level tests | `vitest` with `expectTypeOf` or `tsd` | Public types match the spec |
| Runtime tests | `vitest` | `notify()` enqueues; error classes exist; etc. |
| Error envelope | `vitest` | Every thrown error has `code`, `message`, `hint`, `traceId` |

##### B.5.4 When Contract Tests Run

- **On every PR** (in CI, via `pnpm test`).
- **Before every publish** (in CI, via `pnpm test && pnpm publish`).
- **Against the published package** (a separate "sanity" job that installs the beta tag in a clean project and runs the contract tests).

**If a contract test fails, the PR cannot be merged and the publish cannot proceed.**

---

#### B.6 HTTP API Specification (OpenAPI 3.1)

**Status:** Deferred to v1.1. This section specifies *how* the HTTP API will be designed when it is built — not that it is being built now.

##### B.6.1 Why OpenAPI

When the HTTP API is built, it must be **specified before implementation**, using **OpenAPI 3.1** (the current standard, with JSON Schema 2020-12 support).

**Reasons:**

1. **Language-agnostic.** Any client (Python, Go, Rust, PHP) can generate a typed client from the spec.
2. **Contract testing.** The server can be validated against the spec in CI (via `spectral` or `openapi-diff`).
3. **Documentation is free.** Tools like Redoc or Scalar generate beautiful docs from the spec.
4. **Backward compatibility is checkable.** `openapi-diff` in CI flags breaking changes automatically.

##### B.6.2 Proposed Endpoints (v1.1)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/v1/notify` | Enqueue a notification (mirrors `notify()`) |
| `GET` | `/v1/jobs/{id}` | Get job status by ID |
| `GET` | `/v1/queues` | List queue metadata (depth, concurrency) |
| `GET` | `/v1/health` | Health check |
| `GET` | `/v1/metrics` | Prometheus metrics (opt-in) |

**All endpoints are authenticated** via a bearer token that the user provides (typically their Redis connection token or a custom API key). NotifyKit does not run an auth service — it validates the token against a config the user supplies.

##### B.6.3 Spec Location

The spec will live at:

- **Repository:** `docs/openapi.yaml`
- **Published URL:** `https://notifykit.dev/openapi.yaml` (once the docs site exists)
- **In the npm package:** `@notifykit/http/openapi.yaml` (so clients can be regenerated from the installed package)

##### B.6.4 Spec Authoring Rules

1. Every endpoint has a `summary` and a `description`.
2. Every request/response body is a `$ref` to a component schema.
3. Every error response uses the standard envelope (B.8).
4. Every endpoint declares `operationId` (for SDK generation).
5. The spec is **validated in CI** via `spectral lint docs/openapi.yaml`.
6. The spec is **diffed against the previous release** via `openapi-diff` — breaking changes fail the build.

---

#### B.7 HTTP API Versioning

##### B.7.1 URL Prefix Strategy

The HTTP API is versioned via **URL path prefix**: `/v1/`, `/v2/`.

**Why URL prefix, not headers?** It is the simplest to debug (visible in logs, browser address bar, and curl commands). Header-based versioning is more "elegant" but harder to inspect.

##### B.7.2 What Version Bumps Mean

| Change | Version |
| :--- | :--- |
| Add a new endpoint | No version bump (additive) |
| Add an optional field to a response | No version bump |
| Add a required field to a request | **Major bump** (`/v2/`) |
| Remove or rename a field | **Major bump** |
| Change the semantics of an existing field | **Major bump** |
| Deprecate an endpoint | Announce 2 releases ahead; keep working until next major |

##### B.7.3 API Deprecation Policy

When an endpoint is deprecated:

1. Add `deprecated: true` in the OpenAPI spec.
2. Return a `Deprecation` header and a `Sunset` header (RFC 8594) with the removal date.
3. Document the migration path in `CHANGELOG.md`.
4. Keep the endpoint working for **at least 6 months** after deprecation.

---

#### B.8 Standard Error Envelope

Every error returned by the library or the HTTP API follows the same shape. This is the single most important API-first decision — it makes errors *predictable* and *debuggable*.

##### B.8.1 Library Error Shape

All errors thrown by NotifyKit extend `NotifyKitError`, which has:

```typescript
class NotifyKitError extends Error {
  readonly code: string;       // Stable machine-readable code, e.g. "E_INVALID_EVENT"
  readonly message: string;    // Human-readable, includes a fix hint
  readonly hint: string;       // Actionable "how to fix" text
  readonly traceId: string;    // Correlates with log lines
  readonly cause?: unknown;    // Original error, if wrapped
}
```

##### B.8.2 HTTP Error Shape

Every HTTP error response uses the same JSON envelope:

```json
{
  "error": {
    "code": "E_INVALID_EVENT",
    "message": "Field 'to.phone' is required when channel 'sms' is selected.",
    "hint": "Pass { to: { phone: '+919876543210' } } or remove 'sms' from channels.",
    "traceId": "0192a4c1-7f3e-7b2a-9d1c-2e5f8a9b0c3d"
  }
}
```

##### B.8.3 Standard Error Codes (Initial Set)

| Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `E_INVALID_EVENT` | 400 | Event schema validation failed |
| `E_MISSING_ADAPTER` | 400 | Channel requested but no adapter configured |
| `E_MISSING_TEMPLATE` | 400 | Template ID not registered |
| `E_MISSING_VARIABLE` | 400 | Template variable not provided |
| `E_CONFIG_INVALID` | 500 | `.env` or config object invalid at startup |
| `E_REDIS_UNAVAILABLE` | 503 | Cannot reach Redis |
| `E_QUEUE_FULL` | 503 | Redis `maxmemory` reached |
| `E_PROVIDER_AUTH` | 502 | Adapter returned auth error from provider |
| `E_PROVIDER_RATE_LIMIT` | 429 | Adapter hit provider rate limit |
| `E_PROVIDER_UNAVAILABLE` | 502 | Adapter returned transient error |
| `E_INTERNAL` | 500 | Unexpected error (should never happen) |

**Rule:** Error codes are **stable**. `E_INVALID_EVENT` will never mean something else. New codes are added in minor versions; existing codes are never removed.

---

#### B.9 Idempotency

**Status:** v1.1 (HTTP API only). Not in v1 library.

When a client calls `POST /v1/notify` twice with the same `Idempotency-Key` header, the second call returns the **same response** as the first — including the same `jobId`. The notification is **not** sent twice.

**Implementation (v1.1):**

- Client provides `Idempotency-Key: <uuid>` header.
- Server stores `idempotency:<key>` → `{ jobId, response, ttl }` in Redis.
- TTL: 24 hours (configurable).
- If the key exists, return the cached response.
- If not, process the request and store the response.

**Library equivalent (future):** `notify({ ..., idempotencyKey: 'uuid' })` — but this is **not in v1**. The v1 answer is "wrap `notify()` in your own idempotency check if you need it."

---

#### B.10 The `@notifykit/http` Package (Optional, v1.1)

When the HTTP API is built, it is a **separate package**, not folded into core.

**Why separate:**

1. **Keeps core lean.** Core is a library; HTTP is a service. Users who only want the library never install Express or HTTP dependencies.
2. **Different deployment story.** The library runs inside the user's app; the HTTP server may run as a separate process or container.
3. **Different scaling story.** HTTP servers scale on request rate; workers scale on queue depth. They should be independently scalable.
4. **Optional Express dependency.** The HTTP package depends on Express (or Fastify — TBD). Core does not.

**Package structure (v1.1):**

```
@notifykit/http/
├── src/
│   ├── server.ts          ← Express app factory
│   ├── routes/
│   │   ├── notify.ts      ← POST /v1/notify
│   │   ├── jobs.ts        ← GET /v1/jobs/:id
│   │   ├── queues.ts      ← GET /v1/queues
│   │   ├── health.ts      ← GET /v1/health
│   │   └── metrics.ts     ← GET /v1/metrics
│   ├── middleware/
│   │   ├── auth.ts        ← Bearer token validation
│   │   ├── error.ts       ← Error envelope formatter
│   │   └── tracing.ts     ← Trace ID propagation
│   └── index.ts
├── openapi.yaml           ← OpenAPI 3.1 spec
├── tests/
└── package.json
```

**Peer dependencies:** `notifykit`, `express`.

---

#### B.11 Why HTTP is Deferred to v1.1

The HTTP API is deferred for five reasons:

1. **v1 must be excellent at one thing.** The library surface is the primary artifact. Splitting focus would compromise both.
2. **HTTP requires auth.** A public HTTP endpoint requires authentication, rate limiting, and abuse prevention — all of which are non-trivial and out of scope for v1.
3. **HTTP requires deployment guidance.** The library runs in-process; HTTP runs as a service. That is a new deployment story to document, test, and support.
4. **HTTP requires Express or Fastify.** Both are opinionated choices that some users will reject. Shipping the library first lets users choose their own HTTP framework when integrating.
5. **The demand signal is not yet proven.** If library users ask for HTTP in the first 6 months, it is validated demand. If they do not, building it early was wasted effort.

**Trigger to build `@notifykit/http` (v1.1):**
- ≥ 20 users request a language-agnostic HTTP interface.
- ≥ 5 users specifically ask for "an HTTP endpoint for non-Node.js clients."
- The core library has ≥ 1,000 weekly downloads (proves v1 is stable).

---

## Part C — New Architectural Decision Records

**Insert into `ARCHITECTURE.md` §20, after ADR-008.**

---

#### ADR-009: Redis-Only State — No Database in v1

**Status:** Accepted

**Context:** NotifyKit is a library distributed via npm to developers. It must be installable in seconds, require no migrations, and impose no infrastructure burden beyond what the user already has.

**Decision:** NotifyKit will use **only Redis** (owned by the user) as its state layer. It will not require a relational database, document store, object store, or any other persistence layer in v1.

**Rationale:**

- Redis is already required for BullMQ.
- Adding a database would require the user to provision, configure, and maintain it.
- Schema migrations would create a maintenance burden for both the user and the maintainer.
- The "no database" promise is a key differentiator against heavier platforms (Novu, Courier).
- Any persistence beyond job queuing (e.g., delivery logs) can be added as an **optional peer package** in a future version.

**Consequences:**

- ✅ Zero infrastructure burden for users.
- ✅ Installable in seconds.
- ✅ Easy to test (Testcontainers only needs Redis).
- ⚠️ Users who want persistent delivery history must build it themselves (or wait for `@notifykit/mongo-log` in v1.1).
- ⚠️ If Redis is lost, pending jobs are lost. Mitigated by documenting Redis persistence requirements (A.6).

**Alternatives considered:**

- **PostgreSQL:** Rejected — overkill, requires migrations, slower for queuing.
- **MongoDB:** Rejected for v1 — no clear need; correct path is an optional peer package.
- **SQLite:** Rejected — single-writer bottleneck, unsuitable for server processes.

---

#### ADR-010: API-First — Dual-Surface Versioning Discipline

**Status:** Accepted

**Context:** NotifyKit exposes a library API today and may expose an HTTP API in the future. Both are "APIs" but with different consumers, different versioning strategies, and different contract-testing needs. Without a clear discipline, the two surfaces could drift apart.

**Decision:** NotifyKit commits to **API-first design for both surfaces**:

1. **Library API:** Versioned by npm semver, contract-tested via `vitest` + `expectTypeOf`, with strict deprecation policy (one major release of overlap).
2. **HTTP API (v1.1):** Specified by OpenAPI 3.1, validated in CI, versioned by URL prefix (`/v1/`, `/v2/`), with 6-month deprecation window.
3. **Shared error envelope:** Both surfaces use the same error shape (`code`, `message`, `hint`, `traceId`).
4. **Stable error codes:** Codes like `E_INVALID_EVENT` never change meaning.

**Rationale:**

- Predictability is the most valuable property of a developer tool.
- A stable error envelope makes debugging trivial (users can search for `E_INVALID_EVENT`).
- Contract testing catches accidental breaking changes before publish.
- OpenAPI-first prevents the HTTP API from becoming "whatever the code happened to do."

**Consequences:**

- ✅ Every public API change is a deliberate, documented decision.
- ✅ Users can rely on error codes in their own code.
- ✅ HTTP API (when built) can be consumed from any language.
- ⚠️ Maintenance burden: every breaking change requires a major version bump across core and all adapters.
- ⚠️ HTTP API deferred to v1.1 — v1 focuses on library API excellence.

**Alternatives considered:**

- **Ad-hoc versioning:** Rejected — leads to broken clients and unhappy users.
- **Header-based HTTP versioning:** Rejected — harder to debug than URL prefix.
- **No contract tests:** Rejected — the whole point is to catch breaking changes early.

---

#### ADR-011: `@notifykit/http` Deferred to v1.1

**Status:** Accepted

**Context:** Some notification libraries ship an HTTP endpoint out of the box. Should NotifyKit do the same in v1?

**Decision:** No. The HTTP API is deferred to v1.1, to be shipped as a **separate package** (`@notifykit/http`), not folded into core.

**Rationale:**

1. **v1 focus:** The library API is the primary artifact. Splitting effort across two surfaces would compromise both.
2. **Auth is non-trivial:** A public HTTP endpoint requires authentication, rate limiting, and abuse prevention — all out of scope for v1.
3. **Separate deployment:** The HTTP server runs as a service; the library runs in-process. Different deployment stories should ship in different packages.
4. **Avoid opinionated dependencies:** HTTP requires Express or Fastify. Users should choose their own framework when integrating.
5. **Demand not yet proven:** If library users ask for HTTP, that validates the investment. Building it speculatively may waste effort.

**Consequences:**

- ✅ Core stays lean (no Express dependency).
- ✅ v1 ships faster and with higher quality.
- ⚠️ Non-Node.js clients cannot use NotifyKit in v1. (Acceptable — v1 targets Node.js developers specifically.)
- ⚠️ Users who want an HTTP trigger must build it themselves (a ~30-line Express wrapper).

**Trigger to build:**

- ≥ 20 users request language-agnostic access.
- ≥ 5 users specifically ask for HTTP for non-Node clients.
- Core library reaches ≥ 1,000 weekly downloads.

**Alternatives considered:**

- **Ship HTTP in v1:** Rejected — scope creep, auth complexity, deployment overhead.
- **Ship HTTP as a wrapper around core in v1:** Same problems, deferred to v1.1.
- **Never ship HTTP:** Rejected — clear future need for polyglot environments.

---

## Part D — PHASES.md Impact

#### D.1 Task Additions Per Phase

The following tasks should be **added to `PHASES.md`** at the indicated phases. They are small and do not change effort estimates materially.

##### Phase 0 (Foundation & Tooling) — add:
- [ ] Create `docs/openapi.yaml` placeholder (empty spec, will be filled in v1.1)
- [ ] Add `spectral` CLI config for future OpenAPI linting
- [ ] Add `openapi-diff` script to CI workflow (no-op until spec exists)
- [ ] Add Redis 7 via Docker Compose to `docker-compose.yml` (for local + CI tests)
- [ ] Add `.env.example` template to root with all possible NotifyKit vars

##### Phase 1 (Interfaces & Config) — add:
- [ ] Add `expectTypeOf` contract test for every interface in `interfaces/`
- [ ] Add error class hierarchy (`NotifyKitError` base + subclasses) with tests
- [ ] Add `docs/errors.md` documenting every error code (E_INVALID_EVENT, etc.)
- [ ] Add Redis env var schema to Zod config (`REDIS_URL`, `REDIS_TLS_URL`)

##### Phase 3 (Queue Producer) — add:
- [ ] Document `bull:notifykit:*` key naming convention in `docs/redis.md`
- [ ] Set retention defaults per A.4.2 (`removeOnComplete`, `removeOnFail`)
- [ ] Add test: verify no key outside `bull:notifykit:*` is created after 100 enqueues
- [ ] Add test: verify retention config is applied correctly

##### Phase 5 (BullMQ Worker) — add:
- [ ] Add test: worker respects `maxRetriesPerRequest: null` on ioredis
- [ ] Add test: worker reconnects after Redis restart
- [ ] Add test: worker drains in-flight jobs on `stopWorker()`

##### Phase 6 (Nodemailer Adapter) — add:
- [ ] Add `metadata.version` field to adapter metadata (for compat checks)
- [ ] Add `metadata.peerDependencies` field documenting `notifykit` version range

##### Phase 13 (Hardening) — add:
- [ ] Measure Redis memory footprint at 10K jobs; publish sizing table in docs
- [ ] Run Redis failure scenario test: kill Redis mid-workflow; confirm worker reconnects
- [ ] Verify `bull:notifykit:*` namespace isolation (scan Redis after test, confirm no stray keys)
- [ ] Add CI check: `spectral lint docs/openapi.yaml` passes (trivially, empty spec)
- [ ] Document `removeOnComplete` retention trade-offs in `docs/redis.md`

##### Phase 15 (v1.1) — expand to include:
- [ ] Build `@notifykit/http` package with Express adapter
- [ ] Author full `docs/openapi.yaml` covering `/v1/notify`, `/v1/jobs/:id`, `/v1/queues`, `/v1/health`, `/v1/metrics`
- [ ] Implement standard error envelope middleware
- [ ] Implement bearer token auth middleware
- [ ] Implement `Idempotency-Key` header support with Redis TTL
- [ ] Add `openapi-diff` check in CI (breaking changes fail build)
- [ ] Add integration test: full HTTP → Redis → worker → mock adapter flow
- [ ] Build `@notifykit/mongo-log` optional peer package (when A.8 criteria are met)

#### D.2 Updated Release Gates

The following gates should be **added to `PHASES.md §23`**:

| Gate | New Criteria |
| :--- | :--- |
| **Gate 1 → 2** | Add: every interface has an `expectTypeOf` contract test |
| **Gate 3 → 4** | Add: retention defaults verified; no stray Redis keys created |
| **Gate 5 → 6** | Add: `bull:notifykit:*` namespace isolation verified; worker reconnects on Redis restart |
| **Gate 13 → 14** | Add: Redis sizing table published; OpenAPI placeholder passes `spectral lint` |
| **Gate 14 → 15** | Add: `docs/openapi.yaml` placeholder committed; `@notifykit/http` design sketch reviewed |

---

## Summary of What This Addendum Delivers

| Gap | Addressed In | What Changed |
| :--- | :--- | :--- |
| **Database strategy was scattered** | Part A (§A.2–A.10) | One authoritative section defining the stateless principle, state inventory, and v1.1 MongoDB trigger |
| **Redis data model was undefined** | Part A (§A.4–A.6) | Explicit key naming, TTL, retention, memory sizing, failure semantics |
| **"Good citizen" rules for shared Redis were missing** | Part A (§A.7) | Nine explicit rules the code must follow |
| **v1.1 MongoDB was a vague roadmap item** | Part A (§A.8) | Five explicit criteria for when (and only when) to build it |
| **API-first was not codified** | Part B (§B.2–B.11) | Versioning rules, contract tests, error envelope, HTTP spec approach |
| **HTTP API was one line in tech stack** | Part B (§B.6–B.11) | Full specification of what the HTTP API will be (when built), including OpenAPI, versioning, and the deferred package |
| **Three new ADRs** | Part C | ADR-009 (Redis-only), ADR-010 (API-first), ADR-011 (HTTP deferred) |
| **PHASES.md needed updates** | Part D | 30+ small task additions across phases; 5 updated release gates |

---

## Next Step

You now have **five complete specification documents**:

| File | Purpose | Status |
| :--- | :--- | :--- |
| `PRD.md` | What we are building and why | ✅ Complete |
| `ARCHITECTURE.md` | How it is structured | ✅ Complete |
| `ARCHITECTURE-ADDENDUM.md` (this file) | Database strategy, Redis data model, API-first principles | ✅ Complete |
| `PHASES.md` | What to build, in what order, with DoD | ✅ Complete (needs Part D additions merged in) |
| `AGENTS.md` | Rules for AI agents building it | ✅ Complete |

**Recommended next actions:**

1. **Merge this addendum into `ARCHITECTURE.md`** — I can produce a fully merged `ARCHITECTURE-v1.1.md` on request.
2. **Merge Part D into `PHASES.md`** — I can produce an updated `PHASES-v1.1.md` with the new tasks and gates integrated.
3. **Begin Phase 0** — I can produce the Phase 0 prompt using the `AGENTS.md §11` template immediately.

**Say which of the three you want next and I will produce it.** As always, my response will be in English only, and I will not deviate from that.




---

# Master Document Notes

- This file consolidates the five original documents provided so far plus the generated consolidated Architecture v1.1 draft.
- The source appendices are included to preserve the original text and the addendum's `PHASES.md` change proposals.
- No implementation phase is authorized merely by creating this master file. Follow `AGENTS.md` phase-entry approval rules.
