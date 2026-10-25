import { z } from 'zod';

/**
 * Validates a Redis connection URL (redis:// or rediss://).
 */
export const redisUrlSchema = z
  .string()
  .min(1, 'Redis URL must not be empty')
  .regex(/^rediss?:\/\//i, 'Redis URL must start with redis:// or rediss://');

/**
 * Twilio provider options schema.
 */
export const twilioProviderSchema = z.object({
  type: z.literal('twilio'),
  accountSid: z.string().min(1, 'TWILIO_ACCOUNT_SID is required for Twilio provider'),
  authToken: z.string().min(1, 'TWILIO_AUTH_TOKEN is required for Twilio provider'),
});

/**
 * SMTP / Nodemailer provider options schema.
 */
export const smtpProviderSchema = z.object({
  type: z.enum(['nodemailer', 'smtp']),
  host: z.string().min(1, 'SMTP_HOST must not be empty').optional(),
  port: z.coerce
    .number()
    .int()
    .min(1, 'SMTP_PORT must be between 1 and 65535')
    .max(65535, 'SMTP_PORT must be between 1 and 65535')
    .optional(),
  user: z.string().optional(),
  password: z.string().optional(),
});

/**
 * Generic provider config schema allowing type and custom properties.
 */
export const genericProviderSchema = z
  .object({
    type: z.string().min(1, 'Provider type must not be empty'),
  })
  .passthrough();

/**
 * Root NotifierConfig validation schema.
 */
export const notifierConfigSchema = z.object({
  redis: redisUrlSchema.optional(),
  providers: z
    .object({
      email: genericProviderSchema.optional(),
      sms: genericProviderSchema.optional(),
      push: genericProviderSchema.optional(),
    })
    .default({}),
});

export type ValidatedNotifierConfig = z.infer<typeof notifierConfigSchema>;
