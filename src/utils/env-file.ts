/**
 * Reading and writing dotenv files (KEY=VALUE lines) for the Secrets
 * Manager import and export tools
 */

export interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

export interface ParsedEnvFile {
  readonly entries: readonly EnvEntry[];
  // 1-based numbers of the lines that could not be parsed. Only the line
  // numbers are reported, never their content, which may hold a value.
  readonly invalidLines: readonly number[];
}

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Whether a key can be written as a dotenv variable name
 */
export function isEnvKey(key: string): boolean {
  return ENV_KEY_PATTERN.test(key);
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([nrt"\\])/g, (_match, char: string) => {
    switch (char) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return char;
    }
  });
}

/**
 * Finds the closing quote of a quoted value, skipping escaped double quotes.
 * Returns -1 when the value is not closed in `text`.
 */
function findClosingQuote(text: string, quote: string): number {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote === '"' && char === '\\') {
      i++;
      continue;
    }
    if (char === quote) {
      return i;
    }
  }
  return -1;
}

/**
 * Parses a dotenv file. Supports `export KEY=VALUE`, blank lines, `#`
 * comments, inline comments after unquoted values, single-quoted (literal)
 * values and double-quoted values with `\n`, `\r`, `\t`, `\"` and `\\`
 * escapes. Quoted values may span several lines. A key that appears twice
 * keeps its last value.
 */
export function parseEnvFile(content: string): ParsedEnvFile {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const values = new Map<string, string>();
  const invalidLines: number[] = [];

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = (lines[index] ?? '').trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const assignment = line.replace(/^export\s+/, '');
    const equals = assignment.indexOf('=');
    const key = equals === -1 ? '' : assignment.slice(0, equals).trim();
    if (!isEnvKey(key)) {
      invalidLines.push(lineNumber);
      continue;
    }

    const rawValue = assignment.slice(equals + 1).trimStart();
    const quote = rawValue[0];

    if (quote !== '"' && quote !== "'") {
      values.set(key, rawValue.replace(/\s+#.*$/, '').trim());
      continue;
    }

    // Quoted value: it may continue on the following lines.
    let quoted = rawValue.slice(1);
    let closing = findClosingQuote(quoted, quote);
    while (closing === -1 && index + 1 < lines.length) {
      index++;
      quoted += '\n' + (lines[index] ?? '');
      closing = findClosingQuote(quoted, quote);
    }

    const rest = closing === -1 ? '' : quoted.slice(closing + 1).trim();
    if (closing === -1 || (rest !== '' && !rest.startsWith('#'))) {
      invalidLines.push(lineNumber);
      continue;
    }

    const inner = quoted.slice(0, closing);
    values.set(key, quote === '"' ? unescapeDoubleQuoted(inner) : inner);
  }

  return {
    entries: [...values].map(([key, value]) => ({ key, value })),
    invalidLines,
  };
}

/**
 * Formats entries as a dotenv file that `parseEnvFile` reads back unchanged.
 * Values without single quotes or line breaks are single-quoted, so no
 * character in them is interpreted; the others are double-quoted with
 * escapes. Callers must pass keys accepted by `isEnvKey`.
 */
export function formatEnvFile(entries: readonly EnvEntry[]): string {
  return entries
    .map(({ key, value }) => {
      if (!/['\r\n]/.test(value)) {
        return `${key}='${value}'\n`;
      }
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      return `${key}="${escaped}"\n`;
    })
    .join('');
}
