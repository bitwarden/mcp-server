/**
 * Resolves how to invoke the Bitwarden CLI (`bw`) as a child process.
 *
 * Background: on Windows, `npm i -g @bitwarden/cli` installs `bw` as the
 * npm shim files `bw.cmd` / `bw.ps1` — there is no extensionless `bw`
 * and no `bw.exe`. Node's `spawn('bw', ..., { shell: false })` calls the
 * Win32 `CreateProcess`, which does NOT consult `PATHEXT`, so it cannot
 * find the shim and fails with `spawn bw ENOENT`. This regressed when
 * the server moved from `exec` (which used a shell that honored PATHEXT)
 * to `spawn` in #103.
 *
 * We deliberately do NOT fix this by re-enabling a shell:
 *   - `spawn('bw.cmd', ..., { shell: false })` THROWS `EINVAL` on modern
 *     Node — running `.cmd` / `.bat` requires a shell (the
 *     CVE-2024-27980 mitigation). So "resolve the path and keep
 *     shell:false" alone does not work for the npm shim.
 *   - `{ shell: true }` would re-introduce shell parsing of argument
 *     VALUES. `validateParameter` only blocks NUL / newline, not shell
 *     metacharacters (`& | < > ^ "`), so a parameter such as a vault
 *     search term could inject commands under `cmd.exe`. That defeats
 *     the injection guard the `exec → spawn` migration provided.
 *
 * Instead we keep `shell: false` and resolve a target that Node can
 * execute directly: a real `bw` binary when one is on PATH, otherwise
 * the CLI's JavaScript entry point launched via the current Node runtime
 * (`node <entry> ...`). The npm shim is bypassed entirely, so no shell
 * is ever in the loop and argument values stay literal.
 *
 * Operators whose layout this cannot auto-resolve (pnpm/volta global
 * installs, a CLI not on PATH, etc.) can set `BW_CLI_PATH` to point at
 * the `bw` executable or its JS entry point.
 */

import fs from 'fs';
import path from 'path';

export interface BwInvocation {
  /** The executable to spawn (e.g. `bw`, an absolute path, or `node`). */
  readonly command: string;
  /** Args prepended before the bw subcommand (e.g. the JS entry path). */
  readonly prefixArgs: readonly string[];
}

const JS_EXTENSIONS = ['.js', '.cjs', '.mjs'];
const WINDOWS_SHIM_EXTENSIONS = ['.cmd', '.bat', '.ps1'];

// Resolution touches the filesystem and PATH; cache the result so we do
// the work once per process rather than on every CLI command.
let cached: BwInvocation | undefined;

export function resolveBwInvocation(): BwInvocation {
  return (cached ??= computeBwInvocation());
}

/** Test-only: clears the memoized invocation. */
export function _resetBwInvocationCacheForTests(): void {
  cached = undefined;
}

function computeBwInvocation(): BwInvocation {
  const override = process.env['BW_CLI_PATH']?.trim();
  if (override) {
    return invocationForResolvedPath(override);
  }

  // On POSIX, spawn() resolves a bare `bw` via PATH (execvp), so the
  // historical behavior is already correct and needs no path work.
  if (process.platform !== 'win32') {
    return { command: 'bw', prefixArgs: [] };
  }

  const resolved = resolveWindowsBwOnPath();
  return resolved
    ? invocationForResolvedPath(resolved)
    : // Nothing found — preserve the prior behavior (and its clear
      // ENOENT error) rather than guessing.
      { command: 'bw', prefixArgs: [] };
}

function invocationForResolvedPath(target: string): BwInvocation {
  const ext = path.extname(target).toLowerCase();

  // A JS entry point: run it with the current Node runtime.
  if (JS_EXTENSIONS.includes(ext)) {
    return { command: process.execPath, prefixArgs: [target] };
  }

  // A Windows npm shim cannot be spawned with shell:false. Resolve the
  // underlying JS entry it wraps and run that via Node instead.
  if (process.platform === 'win32' && WINDOWS_SHIM_EXTENSIONS.includes(ext)) {
    const jsEntry = resolveCliJsEntry(path.dirname(target));
    if (jsEntry) {
      return { command: process.execPath, prefixArgs: [jsEntry] };
    }
  }

  // A real executable (or an operator-provided launcher Node can exec).
  return { command: target, prefixArgs: [] };
}

function resolveWindowsBwOnPath(): string | undefined {
  const pathValue = process.env['PATH'] ?? process.env['Path'];
  if (!pathValue) {
    return undefined;
  }

  // PATHEXT order matters: `.EXE` precedes `.CMD`, so a real binary is
  // preferred over the npm batch shim when both exist.
  const pathExt = (process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean);

  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) {
      continue;
    }
    for (const ext of pathExt) {
      const candidate = path.join(dir, `bw${ext}`);
      if (isFile(candidate)) {
        return candidate;
      }
    }
    // Accept an extensionless `bw` too (e.g. a Git-Bash style shim).
    const bare = path.join(dir, 'bw');
    if (isFile(bare)) {
      return bare;
    }
  }
  return undefined;
}

/**
 * Finds the JS entry point of the `@bitwarden/cli` package installed
 * alongside a shim. npm places the package under `<prefix>/node_modules`
 * with the shim at `<prefix>`. We read the package's own `bin` mapping
 * rather than parsing the generated shim text, whose format varies by
 * npm version.
 */
function resolveCliJsEntry(shimDir: string): string | undefined {
  const pkgDir = path.join(shimDir, 'node_modules', '@bitwarden', 'cli');
  try {
    const raw = fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as {
      bin?: string | Record<string, string>;
    };
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['bw'];
    if (!binRel) {
      return undefined;
    }
    const entry = path.join(pkgDir, binRel);
    return isFile(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
