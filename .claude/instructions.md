# Bitwarden MCP Server

## Project Overview

This is a **security-critical** TypeScript/Node.js MCP server that bridges AI models to Bitwarden CLI for secure password vault operations.

**Technology Stack:**

- TypeScript/Node.js ES modules with strict type checking
- Model Context Protocol SDK (@modelcontextprotocol/sdk)
- Zod for schema validation
- Node.js 22 (see .nvmrc)

## Core Architecture

### MCP Tool Pattern

Every Bitwarden operation follows this **mandatory** 4-layer security pattern:

1. **Schema Definition**: `const schema = z.object({...})`
2. **Tool Declaration**: `const tool: Tool = { name, description, inputSchema }`
3. **Handler Registration**: Switch case in CallToolRequestSchema handler
4. **Security Pipeline**: `validateInput() → buildSafeCommand() → executeCliCommand()`

### Security-First Command Execution

**CRITICAL SECURITY REQUIREMENT**: All CLI commands MUST use the security pipeline:

```typescript
// REQUIRED pattern for ALL command executions
const [isValid, validationResult] = validateInput(
  schema,
  request.params.arguments,
);
const command = buildSafeCommand('baseCommand', [param1, param2]);
const result = await executeCliCommand(command);
```

**NEVER** use string interpolation, concatenation, or direct shell commands. Always use `buildSafeCommand()`.

### Security Functions (ALWAYS USE)

```typescript
sanitizeInput(input: string): string          // Removes dangerous characters
escapeShellParameter(value: string): string   // Safely quotes parameters
buildSafeCommand(base: string, params: string[]): string // Combines safely
isValidBitwardenCommand(command: string): boolean // Validates against whitelist
```

## Development Workflows

### Essential Commands

- **Build**: `npm run build` (required before CLI testing)
- **Test**: `npm test` (security, validation, CLI, core tests)
- **Interactive Testing**: `npm run inspect` (MCP Inspector)
- **Linting**: `npm run lint` (ESLint + Prettier)

### Environment

- **BW_SESSION**: Required for Bitwarden CLI authentication
- **Test Setup**: `.jest/setEnvVars.js` mocks environment

### Testing Strategy

- `tests/security.spec.ts` - Command injection protection
- `tests/validation.spec.ts` - Zod schema validation
- `tests/cli-commands.spec.ts` - Bitwarden CLI integration
- `tests/core.spec.ts` - Tool logic and edge cases

## Security Considerations

**NEVER BYPASS** security functions. This handles sensitive password vault data with multiple protection layers:

- Input sanitization removes injection characters: `[;&|`$(){}[\]<>'"\\]`
- Command validation against Bitwarden CLI whitelist
- Parameter escaping with single quotes
- No direct shell command construction

When adding new tools, implement the full security pipeline and add tests to `tests/security.spec.ts`.

## Tool Categories

- **Session Management**: lock, unlock, sync, status
- **Data Retrieval**: list, get
- **Data Modification**: create, edit, delete
- **Utility**: generate (passwords/passphrases)

## Critical Files

- `src/index.ts`: Complete server implementation (1300+ lines)
- `tests/security.spec.ts`: Security validation suite
- `.jest/setEnvVars.js`: Test environment setup
