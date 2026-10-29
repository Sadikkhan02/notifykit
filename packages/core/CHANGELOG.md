# notifykit

## 1.0.0

### Major Changes

- Initial v1.0.0 production release of NotifyKit.
  - Core notification dispatch engine with Redis-backed BullMQ queue
  - Multi-channel support (email, SMS, push) with idempotency, retries, and dead letter queue (DLQ)
  - Official adapters for Nodemailer, Twilio, MSG91, and Firebase Cloud Messaging (FCM)
  - Interactive CLI setup wizard (`npx notifykit init`)
  - Deterministic adapter contract testing suite (`@notifykit/test-utils`)
  - Production-grade security, credential redaction, and error diagnostics

### Dependencies

- notifykit-cli@1.0.0
