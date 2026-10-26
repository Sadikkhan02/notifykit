# Redis Data Model & Queue Key Architecture

This document specifies the Redis key naming conventions, job lifecycle retention policies, connection management, and Good Citizen shared-Redis guidelines for NotifyKit queue producers and consumers.

## 1. Key Naming Convention & Namespacing

NotifyKit uses BullMQ for queue management. To guarantee strict isolation in shared Redis environments, all keys created by NotifyKit conform to BullMQ's standard key prefixing format:

```
${prefix}:${queueName}:${subKey}
```

### Approved Configuration
- **Prefix:** `bull` (BullMQ standard default).
- **Queue Names:** `notifykit:email`, `notifykit:sms`, `notifykit:push`, `notifykit:dlq`.
- **Resulting Key Pattern:** All NotifyKit keys match `bull:notifykit:<channel>:*`.

### Redis Key Layout

| Key | Type | Description |
|---|---|---|
| `bull:notifykit:<channel>:id` | String | Atomic job ID counter for the queue |
| `bull:notifykit:<channel>:<jobId>` | Hash | Job data payload, options, and progress state |
| `bull:notifykit:<channel>:wait` | List | Queue of jobs waiting to be processed |
| `bull:notifykit:<channel>:active` | List | Jobs currently being processed by workers |
| `bull:notifykit:<channel>:delayed` | ZSet | Jobs scheduled for future retry with exponential backoff timestamp |
| `bull:notifykit:<channel>:completed` | ZSet | Completed jobs retained according to retention policy |
| `bull:notifykit:<channel>:failed` | ZSet | Failed jobs retained according to retention policy |
| `bull:notifykit:dlq:<jobId>` | Hash | Dead Letter Queue job payload after exhausting retries |
| `bull:notifykit:<channel>:meta` | Hash | Queue metadata and configuration |

> **Critical Rule (Architecture §A.4.1):** NotifyKit never touches any key that does not start with `bull:notifykit:`. Any code that scans, reads, or deletes a key outside this namespace is a defect.

---

## 2. Retention Policies

Per Architecture v1.1 §A.4.2, jobs are cleaned up automatically to avoid unbounded memory growth:

- **Email & SMS Queues (`notifykit:email`, `notifykit:sms`):**
  - `removeOnComplete`: `{ count: 1000, age: 86400 }` (Retain up to 1,000 completed jobs, max 24 hours).
  - `removeOnFail`: `{ count: 5000, age: 604800 }` (Retain up to 5,000 failed jobs, max 7 days).
- **Push Queue (`notifykit:push`):**
  - `removeOnComplete`: `{ count: 5000, age: 86400 }` (Retain up to 5,000 completed jobs, max 24 hours).
  - `removeOnFail`: `{ count: 10000, age: 604800 }` (Retain up to 10,000 failed jobs, max 7 days).
- **Dead Letter Queue (`notifykit:dlq`):**
  - `removeOnComplete: false`
  - `removeOnFail: false` (Retained indefinitely until manually triaged or purged by administrators).

---

## 3. Good Citizen Rules for Shared Redis Instances

When NotifyKit shares a Redis instance with other applications, it adheres to the following rules (Architecture §A.7):

1. **Strict Namespace Isolation:** All keys reside exclusively under `bull:notifykit:*`.
2. **No Admin Commands:** NotifyKit never invokes `FLUSHDB`, `FLUSHALL`, `KEYS`, `CONFIG`, or `SELECT`.
3. **No Database Switching:** Uses database `0` by default; does not issue `SELECT` commands.
4. **Shared Connection Pooling:** `createRedisConnection()` creates a single memoized `ioredis` instance per process reused across all producer queues.
5. **Proper Retry Settings:** Configures `maxRetriesPerRequest: null` as required by BullMQ blocking commands.
6. **Graceful Shutdown:** `QueueRegistry.close()` and `closeRedisConnection()` cleanly drain commands and terminate connections without dangling handles.
