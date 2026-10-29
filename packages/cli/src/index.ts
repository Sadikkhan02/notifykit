import process from 'node:process';
import { parseArgs } from 'node:util';
import { runInteractiveWizard } from './interactive.js';
import { runNonInteractive } from './non-interactive.js';
import type { CliOptions } from './types.js';

export const cliVersion = '1.0.0';

export const HELP_TEXT = `
NotifyKit CLI - Setup Wizard

Usage:
  npx notifykit [command] [options]
  npx notifykit init [options]

Commands:
  init                           Run the project setup wizard (default)

Options:
  -y, --yes                      Skip confirmation prompts and accept settings
  --dry-run                      Preview configuration without modifying disk
  --skip-install                 Write .env without installing packages
  --cwd <path>                   Target project directory (default: current directory)
  --package-manager <pm>         Force package manager (npm, pnpm, yarn, bun)
  -h, --help                     Show this help message
  -v, --version                  Show version number

Channel & Provider Options (for headless / CI):
  --channels <list>              Comma-separated channels: email, sms, push
  --email <provider>             Email provider: nodemailer
  --sms <provider>               SMS provider: twilio, msg91
  --push <provider>              Push provider: fcm
  --redis-url <url>              Redis queue URL (default: redis://localhost:6379)

Credential Options:
  --smtp-host <host>             SMTP server hostname
  --smtp-port <port>             SMTP port (default: 587)
  --smtp-user <user>             SMTP username
  --smtp-password <pass>         SMTP password
  --smtp-from <address>          Default sender email
  --smtp-secure <bool>           Use TLS (true/false)

  --twilio-sid <sid>             Twilio Account SID (or --twilio-account-sid)
  --twilio-token <token>         Twilio Auth Token (or --twilio-auth-token)
  --twilio-from <number>         Default Twilio phone number
  --twilio-messaging-service-sid Twilio Messaging Service SID

  --msg91-auth-key <key>         MSG91 authentication key
  --msg91-flow-id <flowId>       Approved MSG91 Flow / Campaign ID
  --msg91-sender-id <sender>     Approved 6-character DLT Sender ID

  --fcm-service-account <data>   Path to service account JSON or raw JSON
  --fcm-project-id <id>          Firebase Project ID

Examples:
  npx notifykit init
  npx notifykit init --channels=sms --sms=twilio --twilio-sid=AC123 --twilio-token=xyz --yes
`;

/**
 * Main CLI entrypoint. Parses command-line arguments and dispatches to
 * either the interactive wizard or the headless non-interactive runner.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const optionsConfig = {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
    yes: { type: 'boolean', short: 'y' },
    'dry-run': { type: 'boolean' },
    'skip-install': { type: 'boolean' },
    cwd: { type: 'string' },
    'package-manager': { type: 'string' },
    channels: { type: 'string' },
    email: { type: 'string' },
    sms: { type: 'string' },
    push: { type: 'string' },
    'redis-url': { type: 'string' },
    'smtp-host': { type: 'string' },
    'smtp-port': { type: 'string' },
    'smtp-user': { type: 'string' },
    'smtp-password': { type: 'string' },
    'smtp-from': { type: 'string' },
    'smtp-secure': { type: 'string' },
    'twilio-sid': { type: 'string' },
    'twilio-account-sid': { type: 'string' },
    'twilio-token': { type: 'string' },
    'twilio-auth-token': { type: 'string' },
    'twilio-from': { type: 'string' },
    'twilio-messaging-service-sid': { type: 'string' },
    'msg91-auth-key': { type: 'string' },
    'msg91-flow-id': { type: 'string' },
    'msg91-sender-id': { type: 'string' },
    'fcm-service-account': { type: 'string' },
    'fcm-service-account-json': { type: 'string' },
    'fcm-project-id': { type: 'string' },
  } as const;

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: optionsConfig,
      allowPositionals: true,
      strict: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`Error: ${msg}\nUse --help for usage information.`);
    return 1;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    // eslint-disable-next-line no-console
    console.log(HELP_TEXT);
    return 0;
  }

  if (values.version) {
    // eslint-disable-next-line no-console
    console.log(`notifykit-cli v${cliVersion}`);
    return 0;
  }

  // Filter out 'init' subcommand if present
  const command = positionals[0];
  if (command && command !== 'init') {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: "${command}". Did you mean "init"?`);
    return 1;
  }

  const asString = (val: unknown): string | undefined =>
    typeof val === 'string' ? val : undefined;
  const asBoolean = (val: unknown): boolean | undefined =>
    typeof val === 'boolean' ? val : undefined;

  const options: CliOptions = {
    help: asBoolean(values.help),
    version: asBoolean(values.version),
    yes: asBoolean(values.yes),
    dryRun: asBoolean(values['dry-run']),
    skipInstall: asBoolean(values['skip-install']),
    cwd: asString(values.cwd),
    packageManager: asString(values['package-manager']) as CliOptions['packageManager'],
    channels: asString(values.channels),
    email: asString(values.email),
    sms: asString(values.sms),
    push: asString(values.push),
    redisUrl: asString(values['redis-url']),
    smtpHost: asString(values['smtp-host']),
    smtpPort: asString(values['smtp-port']),
    smtpUser: asString(values['smtp-user']),
    smtpPassword: asString(values['smtp-password']),
    smtpFrom: asString(values['smtp-from']),
    smtpSecure: asString(values['smtp-secure']),
    twilioSid: asString(values['twilio-sid']),
    twilioAccountSid: asString(values['twilio-account-sid']),
    twilioToken: asString(values['twilio-token']),
    twilioAuthToken: asString(values['twilio-auth-token']),
    twilioFrom: asString(values['twilio-from']),
    twilioMessagingServiceSid: asString(values['twilio-messaging-service-sid']),
    msg91AuthKey: asString(values['msg91-auth-key']),
    msg91FlowId: asString(values['msg91-flow-id']),
    msg91SenderId: asString(values['msg91-sender-id']),
    fcmServiceAccount: asString(values['fcm-service-account']),
    fcmServiceAccountJson: asString(values['fcm-service-account-json']),
    fcmProjectId: asString(values['fcm-project-id']),
  };

  // Determine execution mode:
  // If --channels or --yes is specified or non-TTY, run non-interactive flow
  const isNonTty = !process.stdout.isTTY || !process.stdin.isTTY;
  const isHeadless = Boolean(options.channels || options.yes || isNonTty);

  if (isHeadless) {
    return runNonInteractive(options);
  }

  return runInteractiveWizard(options);
}

// Auto-run if executed directly via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('dist/index.js') || process.argv[1].endsWith('notifykit-cli'))
) {
  main()
    .then((code) => {
      if (typeof code === 'number' && code !== 0) {
        process.exit(code);
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        'Fatal error during NotifyKit setup:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    });
}
