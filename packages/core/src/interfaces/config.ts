/**
 * Configuration options for an individual provider adapter.
 */
export interface ProviderConfig {
  /** Adapter provider type identifier (e.g., 'twilio', 'nodemailer', 'fcm') */
  type: string;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Root configuration object passed to NotifyKit initialization.
 */
export interface NotifierConfig {
  /** Redis connection URL (e.g., 'redis://localhost:6379') */
  redis?: string;
  /** Configured providers mapped by channel */
  providers: {
    email?: ProviderConfig;
    sms?: ProviderConfig;
    push?: ProviderConfig;
  };
}
