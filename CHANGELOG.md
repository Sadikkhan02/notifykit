# NotifyKit Changelog

All notable changes to the NotifyKit ecosystem are documented in this file.

## [1.0.0] - 2026-10-29

### Highlights

- **Core Dispatch Engine (`notifykit`)**: High-throughput transactional notification delivery engine with Redis queue and BullMQ workers. Supports email, SMS, and push channels.
- **Reliability & Idempotency**: Built-in exponential backoff retries, dead letter queue (DLQ), and Redis-backed idempotency tracking.
- **Provider Adapters**:
  - `@notifykit/adapter-nodemailer`: Production SMTP email transport with TLS and attachment support.
  - `@notifykit/adapter-twilio`: Twilio REST API SMS delivery with Messaging Service SID and phone routing.
  - `@notifykit/adapter-msg91`: MSG91 Flow API SMS adapter with DLT compliance.
  - `@notifykit/adapter-fcm`: Firebase Cloud Messaging push notifications via Firebase Admin SDK.
- **Developer Experience & CLI (`notifykit-cli`)**: Interactive project setup wizard (`npx notifykit init`) with automatic dependency installation and environment variable configuration.
- **Testing Suite (`@notifykit/test-utils`)**: Standardized, deterministic adapter contract compliance suite and in-memory mock providers.
- **Security & Hardening**: Strict credential redaction across 5 nested object levels (`[REDACTED]`), PII sanitization in queue logs, and actionable error hints on all thrown exceptions.
