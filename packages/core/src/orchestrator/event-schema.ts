import { z } from 'zod';

export const recipientSchema = z.object({
  email: z.string().email('Invalid email address format').optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in valid E.164 format (e.g. +14155552671)')
    .optional(),
  pushToken: z.string().min(1, 'Push token must not be empty').optional(),
});

export const channelEnum = z.enum(['email', 'sms', 'push']);

export const notificationEventSchema = z.object({
  to: recipientSchema,
  channels: z
    .array(channelEnum)
    .min(1, 'At least one channel must be specified in "channels" array'),
  template: z.string().min(1, 'Template identifier "template" is required'),
  data: z.record(z.string(), z.unknown()),
});

export type NotificationEventInput = z.infer<typeof notificationEventSchema>;
