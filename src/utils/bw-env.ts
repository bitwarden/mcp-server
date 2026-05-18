/**
 * Filtered child environment for every `bw` subprocess we spawn.
 *
 * `bw` needs HOME/APPDATA/etc. to locate its data directory; without
 * them it would read/write the wrong files or fail. It does NOT need
 * the API client credentials (`BW_CLIENT_ID` / `BW_CLIENT_SECRET`) or
 * any other host environment variable the operator may have set on
 * the MCP server process. Passing the full `process.env` through to
 * `bw` widens the local exposure surface (e.g. another user on the
 * same host reading `/proc/<pid>/environ`) for no benefit.
 *
 * The `unlock` flow uses this with a one-shot password env var; every
 * other CLI command uses it with `BW_SESSION` inherited from
 * `process.env` when present.
 */
export function buildBwChildEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const passthrough = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'BITWARDENCLI_APPDATA_DIR',
  ] as const;
  for (const key of passthrough) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) env[k] = v;
    }
  }
  return env;
}
