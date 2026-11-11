import { describe, it, expect } from '@jest/globals';
import {
  formatEnvFile,
  isEnvKey,
  parseEnvFile,
} from '../../src/utils/env-file.js';

describe('parseEnvFile', () => {
  it('parses unquoted assignments and skips blank lines and comments', () => {
    const result = parseEnvFile('# comment\n\nA=1\nexport B=two words\n');
    expect(result.invalidLines).toEqual([]);
    expect(result.entries).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: 'two words' },
    ]);
  });

  it('strips inline comments from unquoted values only', () => {
    const result = parseEnvFile("A=1 # note\nB=a#b\nC='x # y'\n");
    expect(result.entries).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: 'a#b' },
      { key: 'C', value: 'x # y' },
    ]);
  });

  it('keeps single-quoted values literally', () => {
    const result = parseEnvFile('A=\'a\\nb $HOME "q"\'\n');
    expect(result.entries).toEqual([{ key: 'A', value: 'a\\nb $HOME "q"' }]);
  });

  it('unescapes double-quoted values', () => {
    const result = parseEnvFile('A="line1\\nline2 \\"q\\" \\\\ \\t"\n');
    expect(result.entries).toEqual([
      { key: 'A', value: 'line1\nline2 "q" \\ \t' },
    ]);
  });

  it('reads quoted values that span several lines', () => {
    const result = parseEnvFile(
      'KEY="-----BEGIN-----\nabc\n-----END-----"\nNEXT=1\n',
    );
    expect(result.invalidLines).toEqual([]);
    expect(result.entries).toEqual([
      { key: 'KEY', value: '-----BEGIN-----\nabc\n-----END-----' },
      { key: 'NEXT', value: '1' },
    ]);
  });

  it('accepts empty values and CRLF line endings', () => {
    const result = parseEnvFile('A=\r\nB=""\r\n');
    expect(result.entries).toEqual([
      { key: 'A', value: '' },
      { key: 'B', value: '' },
    ]);
  });

  it('keeps the last value of a repeated key', () => {
    const result = parseEnvFile('A=1\nA=2\n');
    expect(result.entries).toEqual([{ key: 'A', value: '2' }]);
  });

  it('reports the numbers of invalid lines without their content', () => {
    const result = parseEnvFile('A=1\nnot an assignment\n1BAD=x\nB="open\n');
    expect(result.invalidLines).toEqual([2, 3, 4]);
    expect(result.entries).toEqual([{ key: 'A', value: '1' }]);
  });

  it('rejects text after a closing quote', () => {
    expect(parseEnvFile('A="x" y\n').invalidLines).toEqual([1]);
  });
});

describe('formatEnvFile', () => {
  it('round-trips values through parseEnvFile', () => {
    const entries = [
      { key: 'PLAIN', value: 'abc123' },
      { key: 'SPECIAL', value: '!@#$%^&* "double" \\back' },
      { key: 'SINGLE', value: "it's" },
      { key: 'MULTI', value: 'a\nb\r\nc "q" \\n' },
      { key: 'EMPTY', value: '' },
    ];
    expect(parseEnvFile(formatEnvFile(entries))).toEqual({
      entries,
      invalidLines: [],
    });
  });

  it('single-quotes values without quotes or line breaks', () => {
    expect(formatEnvFile([{ key: 'A', value: '$x #y' }])).toBe("A='$x #y'\n");
  });
});

describe('isEnvKey', () => {
  it('accepts dotenv variable names', () => {
    expect(isEnvKey('DATABASE_URL')).toBe(true);
    expect(isEnvKey('_private.key-1')).toBe(true);
  });

  it('rejects names with spaces or a leading digit', () => {
    expect(isEnvKey('My Secret')).toBe(false);
    expect(isEnvKey('1KEY')).toBe(false);
    expect(isEnvKey('')).toBe(false);
  });
});
