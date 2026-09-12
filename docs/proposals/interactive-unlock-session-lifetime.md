# Proposal: user-selected unlock session lifetimes

Status: design proposal for discussion; no runtime behavior changes.

## Problem

Desktop MCP clients can start a separate Bitwarden MCP process for each chat or
task and restart those processes during reconnects. The interactive `unlock`
tool currently retains the CLI session in the server process environment. An
unlock in one process therefore does not make a new process usable, and the
native password dialog offers no way for the user to choose a session lifetime.

For example, a user can unlock Bitwarden for one Codex task and encounter the
same master-password prompt in another task a few minutes later. Copying a
`BW_SESSION` value into an MCP configuration works around process lifetime, but
asks the user to manage a decryption secret manually.

This proposal adds a user-controlled "Keep unlocked for" choice to the native
unlock dialog, including an explicit Never option. When the user opts into
persistence, another MCP process using the same local vault profile can restore
the session from the operating system's credential store.

## Proposed interaction

The password and lifetime are collected together in the existing native flow,
outside the MCP protocol. The `unlock` tool continues to take no arguments.

```text
Bitwarden MCP

Master password
[ secure password field                              ]

Keep unlocked for
[ Until this MCP process exits                     v ]

[ ] Remember this choice on this device

                                    [Cancel] [Unlock]
```

Proposed choices:

| Choice                       | Behavior                                           |
| ---------------------------- | -------------------------------------------------- |
| Until this MCP process exits | Current behavior; default; no persistent token     |
| 1, 5, 15, or 30 minutes      | Persist until a fixed deadline after unlock        |
| 1, 4, 8, or 24 hours         | Persist until a fixed deadline after unlock        |
| Custom                       | A validated positive duration in hours and minutes |
| Never                        | No automatic expiry; explicit user selection       |

Timed choices are absolute lifetimes measured from successful unlock, not idle
timeouts. Ordinary tool calls, status checks, and process restarts do not extend
the deadline. This distinction must be visible in the dialog and documentation;
the existing Bitwarden apps' inactivity settings remain separate.

When a persistent choice is selected, the dialog explains that this remembers a
vault-unlock secret on this device and makes it available to other MCP processes
using this profile. For Never, it additionally states that the session remains
available until the user locks the MCP vault or the session becomes invalid.

"Remember this choice" stores a preference only. It does not automatically unlock
the vault, extend a current session, or authorize an assistant to choose a longer
lifetime. A remembered value, including Never, remains visible at the next
explicit unlock. Cancelling the dialog leaves preferences and sessions unchanged.

## Session semantics

- Successful unlock stores a session only for the choice the user selected. The
  master password is never retained.
- Process-only sessions preserve the current configuration behavior. The design
  must explicitly distinguish operator-supplied `BW_SESSION` values from sessions
  restored or created by the new persistence feature.
- Persistent sessions survive MCP reconnects and application restarts, subject
  to the operating system's credential-store availability and access controls.
- Every operation that might use a restored session validates its deadline and
  current generation before starting the CLI command. A process must not keep
  using an older in-memory copy after another process locks or replaces it.
- The existing `lock` action clears the current process's session and revokes
  the shared persistent session before attempting `bw lock`. A CLI failure must
  not restore the previous session. Storage failures must be reported without
  claiming that shared revocation succeeded.
- A lock concurrent with an unlock must prevent the in-flight unlock from
  publishing a new persistent session after the lock completes. Cross-process
  coordination, generation checks, and cancellation need an implementation
  review; a JavaScript module-level mutex alone is insufficient.
- Expiry prevents subsequent use even if no MCP process was running at the
  deadline. Remove expired stored values when encountered, and schedule removal
  while a managing process is alive. Do not describe this as guaranteed erasure
  at the deadline when all processes are stopped.
- Changing accounts, changing the Bitwarden server, logout, invalid sessions,
  and manual lock cannot be overridden by Never. Requests still respect vault
  permissions and any applicable organization policy.
- Revocation cannot retract a CLI operation or credential already handed to a
  consumer. The UI and documentation must distinguish future-use revocation
  from cancellation of an operation already in progress.

The scope of persistence is the local OS user plus a canonical CLI profile,
Bitwarden server, and account identity. Canonicalization and account binding must
prevent accidentally restoring a session for another account or self-hosted
server. Separate profiles remain isolated, even when they use the same account.

## Credential storage and failure behavior

Use a platform credential-store abstraction. Candidate implementations are the
macOS Keychain, a Windows user-scoped credential facility, and Linux Secret
Service. Exact backends and supported release platforms require maintainer
agreement before implementation.

The stored record contains only the session token and the metadata needed for
identity, expiry, and revocation. Preferences contain no session or password.

Preserve the existing unlock security invariants:

- No master password or session token in MCP inputs, tool results,
  command arguments, logs, or plain configuration files.
- No arbitrary script text or dialog labels supplied by the model.
- Continue passing the one-shot password through the filtered CLI child
  environment and scrubbing subprocess failures.
- Keep native credential-store permissions and unlock requirements in force.
- Keep the existing headless behavior; do not ask for the password through MCP.
- Retain the already-unlocked short circuit, rate limiting, and prompt
  serialization, extending coordination to simultaneous local processes.

If a credential store is unavailable, locked, or denied, persistent options must
be unavailable or the persistence attempt must fail explicitly. Never silently
fall back to a plain file or to a different lifetime than the user selected.
An invalid cached session must not cause an automatic password-prompt loop.

If existing organization timeout policy cannot be obtained and enforced through
the supported CLI interface, the implementation must resolve that limitation
before enabling persistence for affected accounts. This proposal does not grant
permission to bypass organization policy.

## Proposed implementation boundaries

| Component                     | Responsibility                                                     |
| ----------------------------- | ------------------------------------------------------------------ |
| Native unlock dialog          | Password entry and human selection of lifetime                     |
| Session manager               | Identity binding, deadlines, generations, and process coordination |
| Platform credential store     | Protected persistence and removal                                  |
| CLI execution and lock flows  | Resolve or revoke sessions without exposing tokens through MCP     |
| Documentation and diagnostics | Explain lifetime, active scope, expiry, and sanitized failures     |

Platform support should be explicit. Shipping one reviewed backend first is
preferable to presenting persistence choices that do not work on another OS.
MCP clients should not need changes to use the feature.

## Acceptance criteria for an implementation

1. Two independent MCP processes using the same profile can reuse an explicitly
   persisted unlock; unrelated users, profiles, servers, and accounts cannot.
2. Process-only remains the default and retains current behavior.
3. Every preset and valid custom duration expires at the documented deadline;
   use and restart do not renew it. Invalid or overflowing durations are rejected.
4. Never survives restart while the credential store is available, and remains
   subject to manual lock, account changes, and session invalidation.
5. Lock, expiry, and replacement affect already-running processes. Tests cover
   simultaneous unlocks, lock during unlock, and store failure during revocation.
6. Cancel, invalid passwords, a locked or unavailable OS store, and interrupted
   subprocesses neither persist secrets unexpectedly nor leak them in errors.
7. Passwords and session tokens remain absent from MCP traffic, argv, logs, and
   plain files. Automated tests use synthetic values and isolated stores.
8. The supported platforms receive keyboard-accessible native dialogs with a
   masked password field, accessible labels, and visible lifetime information.
9. Organization policy and operator-supplied sessions have explicit, tested
   behavior rather than being silently overridden by the persistence feature.

## Passkeys and embedded browsers

Remembering a CLI session does not make an MCP server a browser authenticator.
Using a stored passkey requires a supported WebAuthn integration with the browser,
including origin and relying-party validation, user verification, and request
cancellation. Exporting private key material through an assistant is not part of
this proposal.

Never applies to the vault session, not to a website's passkey verification
requirements. A future provider must not claim that a user-verification step
occurred merely because the vault is still unlocked.

For clients that provide an embedded browser, a future Bitwarden credential
provider could keep credential operations local and expose only an authenticated
request/result channel. That work depends on browser-host support and deserves a
separate design. The Chrome `webAuthenticationProxy` API is one possible transport
in hosts that support it; its existence does not establish availability in every
embedded Chromium browser.

## Questions for maintainers

- Is a native lifetime selector and opt-in OS-backed persistence appropriate for
  this MCP server, or should session ownership live in a separate desktop broker?
- Which credential-store integrations and platforms should be supported first?
- Which policy sources and account identifiers should govern persistent sessions?
- Are the proposed absolute lifetime semantics and explicit Never option suitable,
  or should the product adopt an inactivity model with different UX?

## References

- [Interactive unlock flow](../../src/utils/unlock.ts)
- [CLI execution](../../src/utils/cli.ts)
- [Bitwarden CLI session-key behavior](https://bitwarden.com/help/cli/#unlock)
- [Bitwarden app timeout settings](https://bitwarden.com/help/vault-timeout/)
- [Bitwarden contribution process](https://contributing.bitwarden.com/contributing/)
- [Chrome webAuthenticationProxy](https://developer.chrome.com/docs/extensions/reference/api/webAuthenticationProxy)
