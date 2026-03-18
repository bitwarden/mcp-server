# Squad Charter — Bitwarden MCP Server

## Mission

Extend Bitwarden's MCP server with Squad-native credential management for AI agent teams. Focus: restricted access patterns, collection-based isolation, audit trails.

## Objectives

1. **Restricted Access Patterns** — Enable AI agents to request credentials scoped to specific collections and roles, preventing over-privileged access.
2. **Collection-Based Isolation** — Map squad agent boundaries to Bitwarden collections, ensuring agents only see what they need.
3. **Audit Trails** — Instrument all credential access with structured logs for traceability across agent sessions.
4. **MCP Protocol Alignment** — All new capabilities exposed as MCP tools/resources following the protocol spec.

## Principles

- **Least Privilege** — Agents get minimum access needed for their task.
- **Defense in Depth** — Multiple layers: collection scoping, role checks, audit logging.
- **Upstream First** — Prefer upstreamable changes. Keep squad-specific extensions cleanly separated.
- **No Secrets in Code** — Ever. Configuration via environment, Bitwarden vault, or MCP resource URIs.

## Theme

Security/detective noir — fitting the password manager domain. The squad operates like a heist crew: each member has a specialty, trust is earned, and every move is logged.
