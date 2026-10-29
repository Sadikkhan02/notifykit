import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createNotifier, type Notifier } from '../../src/orchestrator/notifier.js';
import { getLogger } from '../../src/logging/logger.js';
import { resetDefaultRegistry, closeRedisConnection } from '../../src/queue/index.js';
import type { EmailProvider, ProviderResult } from '../../src/interfaces/index.js';

describe('End-to-End Credential Redaction Test (Phase 13)', () => {
  let redisContainer: StartedRedisContainer | null = null;
  let redisUrl: string;
  let activeNotifier: Notifier | null = null;
  const isCi = Boolean(process.env.CI);

  beforeAll(async () => {
    const localRedisUrl = process.env.REDIS_URL;

    if (localRedisUrl) {
      redisUrl = localRedisUrl;
    } else {
      try {
        redisContainer = await new RedisContainer('redis:7-alpine').start();
        redisUrl = redisContainer.getConnectionUrl();
      } catch (err) {
        if (isCi) {
          throw new Error(`CRITICAL: Testcontainers failed to start Redis in CI: ${err}`);
        }
        return;
      }
    }

    if (isCi && !redisUrl) {
      throw new Error('CRITICAL: Redis is required for redaction e2e tests in CI.');
    }
  }, 60000);

  afterAll(async () => {
    if (activeNotifier) {
      await activeNotifier.stopWorker().catch(() => {});
    }
    await resetDefaultRegistry().catch(() => {});
    await closeRedisConnection().catch(() => {});

    if (redisContainer) {
      await redisContainer.stop().catch(() => {});
    }
  }, 30000);

  const assertRedisAvailable = (ctx: { skip: () => void }): void => {
    if (!redisUrl) {
      if (isCi) {
        throw new Error('Real-Redis redaction test cannot be skipped in CI: Redis is required.');
      }
      ctx.skip();
    }
  };

  it('redacts sensitive credentials in logs when dispatched through notify() and worker', async (ctx) => {
    assertRedisAvailable(ctx);
    if (!redisUrl) return;

    await resetDefaultRegistry();
    await closeRedisConnection();

    const rawLogs: string[] = [];
    const logStream = new Writable({
      write(chunk, _encoding, callback) {
        rawLogs.push(chunk.toString());
        callback();
      },
    });

    const logger = getLogger('debug', logStream);

    const fakeSecrets = {
      token: 'fake_jwt_token_should_never_leak_123',
      password: 'fake_cleartext_password_456',
      secret: 'fake_top_secret_key_789',
      authKey: 'fake_msg91_auth_key_abc',
      privateKey: 'fake_private_key_pem_def',
      accessToken: 'fake_oauth_access_token_ghi',
    };

    const mockEmailProvider: EmailProvider = {
      name: 'mock-audit-email',
      async sendEmail(opts): Promise<ProviderResult> {
        logger.debug({ payload: opts, secret: fakeSecrets.secret }, 'Provider received opts');
        return { success: true, messageId: 'audit-msg-001' };
      },
    };

    activeNotifier = createNotifier({
      redis: redisUrl,
      logger,
      providers: {
        email: {
          type: 'mock-audit-email',
          adapter: mockEmailProvider,
          from: 'security@example.com',
        },
      },
    });

    activeNotifier.registerTemplate(
      'credential-test',
      '<p>Hello {{name}}, your reset code is {{code}}.</p>',
    );

    // 1. Dispatch event with sensitive data
    const { jobId } = await activeNotifier.notify({
      to: { email: 'target@example.com' },
      channels: ['email'],
      template: 'credential-test',
      data: {
        name: 'AuditUser',
        code: '123456',
        ...fakeSecrets,
        nested: {
          deep: {
            password: fakeSecrets.password,
            token: fakeSecrets.token,
          },
        },
      },
    });

    expect(jobId).toBeDefined();

    // 2. Start worker to process through BullMQ
    activeNotifier.startWorker({ channels: ['email'], concurrency: 1 });

    // Wait briefly for job execution
    await new Promise((resolve) => setTimeout(resolve, 800));

    await activeNotifier.stopWorker();
    await resetDefaultRegistry();
    await closeRedisConnection();

    // 3. Inspect all logged output
    const combinedLogOutput = rawLogs.join('\n');

    // Confirm that none of the cleartext secrets leaked into the logs
    expect(combinedLogOutput).not.toContain(fakeSecrets.token);
    expect(combinedLogOutput).not.toContain(fakeSecrets.password);
    expect(combinedLogOutput).not.toContain(fakeSecrets.secret);
    expect(combinedLogOutput).not.toContain(fakeSecrets.authKey);
    expect(combinedLogOutput).not.toContain(fakeSecrets.privateKey);
    expect(combinedLogOutput).not.toContain(fakeSecrets.accessToken);

    // Confirm that the log output does contain [REDACTED] for sensitive fields
    expect(combinedLogOutput).toContain('[REDACTED]');
  }, 30000);
});
