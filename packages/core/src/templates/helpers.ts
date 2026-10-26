import type Handlebars from 'handlebars';

/**
 * Transforms a value to its uppercase string representation.
 * Returns an empty string if value is null or undefined.
 */
export function uppercase(str: unknown): string {
  if (str === null || str === undefined) {
    return '';
  }
  return String(str).toUpperCase();
}

/**
 * Formats a Date object, numeric timestamp, or ISO date string.
 * Supports standard format options: 'iso', 'utc', 'date', or defaults to YYYY-MM-DD.
 * Returns an empty string if the date is null, undefined, or invalid.
 */
export function formatDate(date: unknown, formatOrOptions?: unknown): string {
  if (date === null || date === undefined) {
    return '';
  }

  const d = date instanceof Date ? date : new Date(date as string | number);
  if (isNaN(d.getTime())) {
    return '';
  }

  let format: string | undefined;
  if (typeof formatOrOptions === 'string') {
    format = formatOrOptions;
  } else if (
    formatOrOptions !== null &&
    typeof formatOrOptions === 'object' &&
    'hash' in (formatOrOptions as Record<string, unknown>)
  ) {
    const hash = (formatOrOptions as { hash?: Record<string, unknown> }).hash;
    if (hash && typeof hash.format === 'string') {
      format = hash.format;
    }
  }

  switch (format) {
    case 'iso':
      return d.toISOString();
    case 'utc':
      return d.toUTCString();
    default:
      return d.toISOString().slice(0, 10);
  }
}

/**
 * Registers the default NotifyKit helpers on a Handlebars instance.
 */
export function registerDefaultHelpers(handlebarsInstance: typeof Handlebars): void {
  handlebarsInstance.registerHelper('uppercase', uppercase);
  handlebarsInstance.registerHelper('formatDate', formatDate);
}
