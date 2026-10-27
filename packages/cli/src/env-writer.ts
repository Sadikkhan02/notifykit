import fs from 'node:fs';
import path from 'node:path';
import { ENV_EXAMPLE_PLACEHOLDERS } from './constants.js';
import type { EnvWriteResult } from './types.js';

const NOTIFYKIT_HEADER = '# --- NotifyKit Configuration ---';

/**
 * Formats a value safely for .env syntax.
 * Escapes quotes and wraps values in double quotes if they contain spaces, newlines, #, or quotes.
 */
export function formatEnvValue(value: string): string {
  if (value.includes('\n') || value.includes(' ') || value.includes('#') || value.includes('"')) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Parses existing .env content into lines, identifying keys and preserving comments/blank lines.
 */
interface ParsedEnvLine {
  type: 'comment' | 'blank' | 'pair';
  raw: string;
  key?: string;
  value?: string;
}

export function parseEnvLines(content: string): ParsedEnvLine[] {
  const lines = content.split(/\r?\n/);
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'blank', raw: line };
    }
    if (trimmed.startsWith('#')) {
      return { type: 'comment', raw: line };
    }

    const match = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      return {
        type: 'pair',
        raw: line,
        key: match[1],
        value: match[2],
      };
    }

    return { type: 'comment', raw: line };
  });
}

/**
 * Merges new environment variables into existing .env content safely.
 * Preserves comments, order of existing keys, and non-NotifyKit variables.
 */
export function mergeEnvContent(
  existingContent: string,
  newVariables: Record<string, string>,
): { mergedContent: string; writtenKeys: string[]; preservedKeys: string[] } {
  const parsedLines = parseEnvLines(existingContent);
  const existingKeys = new Set<string>();
  const preservedKeys: string[] = [];
  const updatedLines = [...parsedLines];

  // Pass 1: update existing keys in-place
  for (let i = 0; i < updatedLines.length; i++) {
    const line = updatedLines[i];
    if (line && line.type === 'pair' && line.key) {
      existingKeys.add(line.key);
      if (Object.prototype.hasOwnProperty.call(newVariables, line.key)) {
        const val = newVariables[line.key] ?? '';
        const newVal = formatEnvValue(val);
        updatedLines[i] = {
          type: 'pair',
          raw: `${line.key}=${newVal}`,
          key: line.key,
          value: newVal,
        };
      } else {
        preservedKeys.push(line.key);
      }
    }
  }

  // Pass 2: identify keys that must be appended
  const keysToAppend = Object.keys(newVariables).filter((k) => !existingKeys.has(k));

  const mergedLines = updatedLines.map((l) => l.raw);

  if (keysToAppend.length > 0) {
    // Check if the NotifyKit header already exists
    const hasHeader = mergedLines.some((l) => l.trim() === NOTIFYKIT_HEADER);

    // Ensure trailing newline before appending section if needed
    const lastLine = mergedLines[mergedLines.length - 1];
    if (lastLine !== undefined && lastLine.trim() !== '') {
      mergedLines.push('');
    }

    if (!hasHeader) {
      mergedLines.push(NOTIFYKIT_HEADER);
    }

    for (const key of keysToAppend) {
      const val = formatEnvValue(newVariables[key] ?? '');
      mergedLines.push(`${key}=${val}`);
    }
  }

  // Ensure file ends with a trailing newline
  let result = mergedLines.join('\n');
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return {
    mergedContent: result,
    writtenKeys: Object.keys(newVariables),
    preservedKeys,
  };
}

/**
 * Merges placeholder variables into .env.example content.
 * Never writes real secret values to .env.example.
 */
export function mergeExampleContent(
  existingContent: string,
  variables: Record<string, string>,
): string {
  const examplePlaceholders: Record<string, string> = {};
  for (const key of Object.keys(variables)) {
    examplePlaceholders[key] = ENV_EXAMPLE_PLACEHOLDERS[key] ?? 'your_value_here';
  }

  const { mergedContent } = mergeEnvContent(existingContent, examplePlaceholders);
  return mergedContent;
}

/**
 * Writes or updates .env and .env.example in the target directory.
 */
export function writeEnvFiles(
  targetDir: string,
  variables: Record<string, string>,
): EnvWriteResult {
  const envPath = path.join(targetDir, '.env');
  const examplePath = path.join(targetDir, '.env.example');

  let existingEnv = '';
  if (fs.existsSync(envPath)) {
    existingEnv = fs.readFileSync(envPath, 'utf8');
  }

  let existingExample = '';
  if (fs.existsSync(examplePath)) {
    existingExample = fs.readFileSync(examplePath, 'utf8');
  }

  const {
    mergedContent: newEnvContent,
    writtenKeys,
    preservedKeys,
  } = mergeEnvContent(existingEnv, variables);
  const newExampleContent = mergeExampleContent(existingExample, variables);

  fs.writeFileSync(envPath, newEnvContent, 'utf8');
  fs.writeFileSync(examplePath, newExampleContent, 'utf8');

  return {
    envPath,
    examplePath,
    writtenKeys,
    preservedKeys,
  };
}
