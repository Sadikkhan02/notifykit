/**
 * Credential key patterns to redact in structured logs and diagnostic outputs.
 */
export const REDACT_PATHS = Object.freeze(['*TOKEN*', '*KEY*', '*SECRET*', '*PASSWORD*'] as const);
