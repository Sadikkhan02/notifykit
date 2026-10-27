import pino, {
  type DestinationStream,
  type LevelWithSilent,
  type Logger,
  type LoggerOptions,
} from 'pino';

export type { Logger };

export interface LogBindings {
  traceId?: string;
  jobId?: string;
  channel?: string;
  provider?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'token',
  'key',
  'apiKey',
  'api_key',
  'authKey',
  'auth_key',
  'authToken',
  'auth_token',
  'authorization',
  'accountSid',
  'account_sid',
  'privateKey',
  'private_key',
  'PASSWORD',
  'SECRET',
  'TOKEN',
  'KEY',
  'API_KEY',
  'AUTH_TOKEN',
];

/**
 * Builds fast-redact paths supporting root up to 4 levels of nesting.
 */
function buildRedactPaths(keywords: string[]): string[] {
  const paths: string[] = [];
  for (const kw of keywords) {
    paths.push(kw, `*.${kw}`, `*.*.${kw}`, `*.*.*.${kw}`, `*.*.*.*.${kw}`);
  }
  return paths;
}

export const DEFAULT_REDACT_PATHS = Object.freeze(buildRedactPaths(SENSITIVE_KEYWORDS));

/**
 * Returns a configured Pino logger with credential redaction.
 */
export function getLogger(
  level?: LevelWithSilent | string,
  destination?: DestinationStream,
  customOptions?: Partial<LoggerOptions>,
): Logger {
  const resolvedLevel = level || process.env.LOG_LEVEL || 'info';

  const defaultOptions: LoggerOptions = {
    level: resolvedLevel,
    redact: {
      paths: [...DEFAULT_REDACT_PATHS],
      censor: '[REDACTED]',
    },
    ...customOptions,
  };

  if (destination) {
    return pino(defaultOptions, destination);
  }

  return pino(defaultOptions);
}

/**
 * Creates a child logger with bound contextual metadata (e.g. traceId, jobId, channel, provider).
 */
export function createScopedLogger(bindings: LogBindings, parentLogger?: Logger): Logger {
  const baseLogger = parentLogger ?? getLogger();
  return baseLogger.child(bindings);
}
