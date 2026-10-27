export type Channel = 'email' | 'sms' | 'push';

export type Provider = 'nodemailer' | 'twilio' | 'msg91' | 'fcm';

export type EmailProvider = 'nodemailer';
export type SmsProvider = 'twilio' | 'msg91';
export type PushProvider = 'fcm';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ProviderSelection {
  email?: EmailProvider;
  sms?: SmsProvider;
  push?: PushProvider;
}

export interface WizardConfig {
  channels: Channel[];
  providers: ProviderSelection;
  redisUrl: string;
  credentials: Record<string, string>;
}

export interface CliOptions {
  help?: boolean;
  version?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  skipInstall?: boolean;
  cwd?: string;
  packageManager?: PackageManager;

  // Selection flags
  channels?: string;
  email?: string;
  sms?: string;
  push?: string;
  redisUrl?: string;

  // Nodemailer credentials
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpSecure?: string;

  // Twilio credentials
  twilioSid?: string;
  twilioAccountSid?: string;
  twilioToken?: string;
  twilioAuthToken?: string;
  twilioFrom?: string;
  twilioMessagingServiceSid?: string;

  // MSG91 credentials
  msg91AuthKey?: string;
  msg91FlowId?: string;
  msg91SenderId?: string;

  // FCM credentials
  fcmServiceAccount?: string;
  fcmServiceAccountJson?: string;
  fcmProjectId?: string;
}

export interface EnvWriteResult {
  envPath: string;
  examplePath: string;
  writtenKeys: string[];
  preservedKeys: string[];
}

export interface InstallResult {
  packageManager: PackageManager;
  packages: string[];
  success: boolean;
  error?: string;
}
