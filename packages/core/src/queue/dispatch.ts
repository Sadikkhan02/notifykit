import type { NotifierConfig } from '../interfaces/config.js';
import type { EmailProvider, PushProvider, SmsProvider } from '../interfaces/providers.js';
import type { ProviderResult } from '../interfaces/result.js';
import { createScopedLogger, type Logger } from '../logging/logger.js';
import { MissingAdapterError } from '../orchestrator/errors.js';
import { resolveChannelAdapters } from '../orchestrator/resolve.js';
import type { NotificationJob, QueueChannel } from './payload.js';

export interface DispatchOptions {
  providers?: NotifierConfig['providers'];
  logger?: Logger;
}

/**
 * Dispatches a notification job from a queue to its designated channel adapter.
 *
 * Implements the channel-to-adapter mapping per Architecture §8.2 and PHASES.md §11 (Task 5.1):
 * - Resolves the configured provider adapter for the job's channel.
 * - Extracts recipient contact details and pre-rendered body (no template rendering).
 * - Invokes the corresponding adapter method:
 *   - 'email' -> EmailProvider.sendEmail({ to, from, subject, html, text })
 *   - 'sms' -> SmsProvider.sendSms({ to, from, body, templateId, variables })
 *   - 'push' -> PushProvider.sendPush({ token, title, body, data })
 * - Normalizes returned provider results or propagates thrown exceptions.
 *
 * @param job Validated notification job from Redis
 * @param options Dispatch configuration containing providers and logger
 * @returns Standardized ProviderResult
 * @throws {MissingAdapterError} If no provider adapter is configured for the channel
 */
export async function dispatchJob(
  job: NotificationJob,
  options?: DispatchOptions,
): Promise<ProviderResult> {
  const traceId = job.metadata.traceId;
  const scopedLogger = createScopedLogger(
    { traceId, jobId: job.id, channel: job.channel, provider: job.provider },
    options?.logger,
  );

  scopedLogger.debug(
    {
      jobId: job.id,
      channel: job.channel,
      provider: job.provider,
      templateId: job.templateId,
    },
    'Dispatching notification job to adapter',
  );

  // Resolve adapter for target channel
  const resolvedMap = resolveChannelAdapters(
    [job.channel as QueueChannel],
    options?.providers,
    traceId,
  );
  const resolved = resolvedMap.get(job.channel as QueueChannel);

  if (!resolved) {
    throw new MissingAdapterError({
      message: `No provider adapter configured for channel "${job.channel}".`,
      hint: `Configure a provider for "${job.channel}" in createNotifier({ providers: { ${job.channel}: ... } }).`,
      traceId,
    });
  }

  const adapter = resolved.adapter;

  switch (job.channel) {
    case 'email': {
      const emailTo = job.to.email?.trim();
      if (!emailTo) {
        return {
          success: false,
          error: 'Recipient email address is missing for email channel',
          retryable: false,
        };
      }

      const emailProvider = adapter as EmailProvider | undefined;
      if (!emailProvider || typeof emailProvider.sendEmail !== 'function') {
        throw new MissingAdapterError({
          message: `Provider adapter for channel "email" does not implement EmailProvider.sendEmail().`,
          hint: 'Ensure an adapter instance implementing EmailProvider is injected.',
          traceId,
        });
      }

      const configRecord = resolved.config as Record<string, unknown>;
      const from =
        (typeof configRecord.from === 'string' && configRecord.from) ||
        (typeof configRecord.user === 'string' && configRecord.user) ||
        'noreply@notifykit.dev';

      const subject =
        job.variables?.subject ||
        (job as unknown as { subject?: string }).subject ||
        `Notification: ${job.templateId}`;

      return await emailProvider.sendEmail({
        to: emailTo,
        from,
        subject,
        html: job.renderedBody,
        text: job.variables?.text,
      });
    }

    case 'sms': {
      const phoneTo = job.to.phone?.trim();
      if (!phoneTo) {
        return {
          success: false,
          error: 'Recipient phone number is missing for sms channel',
          retryable: false,
        };
      }

      const smsProvider = adapter as SmsProvider | undefined;
      if (!smsProvider || typeof smsProvider.sendSms !== 'function') {
        throw new MissingAdapterError({
          message: `Provider adapter for channel "sms" does not implement SmsProvider.sendSms().`,
          hint: 'Ensure an adapter instance implementing SmsProvider is injected.',
          traceId,
        });
      }

      const configRecord = resolved.config as Record<string, unknown>;
      const from = typeof configRecord.from === 'string' ? configRecord.from : undefined;

      return await smsProvider.sendSms({
        to: phoneTo,
        from,
        body: job.renderedBody,
        templateId: job.templateId,
        variables: job.variables,
      });
    }

    case 'push': {
      const pushToken = job.to.pushToken?.trim();
      if (!pushToken) {
        return {
          success: false,
          error: 'Recipient pushToken is missing for push channel',
          retryable: false,
        };
      }

      const pushProvider = adapter as PushProvider | undefined;
      if (!pushProvider || typeof pushProvider.sendPush !== 'function') {
        throw new MissingAdapterError({
          message: `Provider adapter for channel "push" does not implement PushProvider.sendPush().`,
          hint: 'Ensure an adapter instance implementing PushProvider is injected.',
          traceId,
        });
      }

      const title = job.variables?.title || `Alert: ${job.templateId}`;

      return await pushProvider.sendPush({
        token: pushToken,
        title,
        body: job.renderedBody,
        data: job.variables,
      });
    }

    default: {
      const unhandledChannel = (job as NotificationJob).channel;
      throw new MissingAdapterError({
        message: `Unsupported channel "${unhandledChannel}" requested for dispatch.`,
        hint: 'Supported channels are "email", "sms", and "push".',
        traceId,
      });
    }
  }
}
