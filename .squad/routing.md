# Work Routing

## Routing Rules

| Work Type | Primary | Backup | Notes |
|-----------|---------|--------|-------|
| TypeScript/MCP implementation | Q | Ethan | Core protocol and tooling work |
| Security review | Natasha | Ethan | All PRs touching auth, crypto, or access control |
| Architecture decisions | Ethan | Q | Scope changes, API design |
| Code review | Ethan | Q | All PRs require at least one review |
| Session logging | Scribe | — | Automatic; no routing needed |
| Bug fixes | Q | Natasha | Depending on domain |
| Dependency updates | Q | Natasha | Security audit required for new deps |

## Escalation

- **Unclear requirements** → Ethan (Lead)
- **Security concerns** → Natasha (Security)
- **MCP protocol questions** → Q (Tech Lead)
- **Cross-squad coordination** → Ethan, then escalate to home squad (tamresearch1)

## Labels

| Label | Meaning |
|-------|---------|
| `squad:copilot` | AI agent can pick up |
| `squad:review` | Needs human review before merge |
| `squad:security` | Natasha must review |
| `squad:upstream` | Relates to upstream bitwarden/mcp-server |
