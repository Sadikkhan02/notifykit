import type { z } from 'zod';
import type { NotificationEvent } from '../interfaces/event.js';
import { notificationEventSchema } from './event-schema.js';
import { InvalidEventError } from './errors.js';

/**
 * Validates an incoming notification event against schema and cross-field channel rules.
 *
 * @throws {InvalidEventError} If the event does not satisfy schema or required recipient fields.
 */
export function validateEvent(rawEvent: unknown, traceId?: string): NotificationEvent {
  if (!rawEvent || typeof rawEvent !== 'object') {
    throw new InvalidEventError({
      message: 'Notification event must be a non-null object.',
      hint: 'Pass a valid NotificationEvent object with "to", "channels", "template", and "data" properties.',
      traceId,
    });
  }

  const parseResult = notificationEventSchema.safeParse(rawEvent);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as z.ZodIssue;
    const path = firstIssue.path.join('.');
    const issueMsg = path ? `Field "${path}": ${firstIssue.message}` : firstIssue.message;

    throw new InvalidEventError({
      message: `Invalid notification event: ${issueMsg}`,
      hint: 'Ensure event contains valid "to" recipient, non-empty "channels", non-empty "template", and "data" object.',
      traceId,
      cause: parseResult.error,
    });
  }

  const event = parseResult.data as NotificationEvent;

  // Cross-field channel validation
  for (const channel of event.channels) {
    if (channel === 'email') {
      const email = event.to.email?.trim();
      if (!email) {
        throw new InvalidEventError({
          message: 'Field "to.email" is required when channel "email" is selected.',
          hint: 'Pass a valid recipient email address (e.g. { to: { email: "user@example.com" } }) or remove "email" from channels.',
          traceId,
        });
      }
    } else if (channel === 'sms') {
      const phone = event.to.phone?.trim();
      if (!phone) {
        throw new InvalidEventError({
          message: 'Field "to.phone" is required when channel "sms" is selected.',
          hint: 'Pass a valid E.164 recipient phone number (e.g. { to: { phone: "+14155552671" } }) or remove "sms" from channels.',
          traceId,
        });
      }
    } else if (channel === 'push') {
      const pushToken = event.to.pushToken?.trim();
      if (!pushToken) {
        throw new InvalidEventError({
          message: 'Field "to.pushToken" is required when channel "push" is selected.',
          hint: 'Pass a non-empty recipient push token (e.g. { to: { pushToken: "device_token" } }) or remove "push" from channels.',
          traceId,
        });
      }
    }
  }

  return event;
}
