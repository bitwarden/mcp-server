# Bitwarden MCP Server Instructions

## Project overview

- **Technology**: TypeScript/Node.js ES modules with strict type checking
- **Framework**: Model Context Protocol SDK (@modelcontextprotocol/sdk)
- **Main functionality**: Secure MCP server that bridges AI models to Bitwarden CLI
- **Architecture**: Single-file server (`src/index.ts`) with comprehensive security layers

## Core architecture patterns

### MCP tool structure

Each Bitwarden operation follows a consistent 4-layer pattern:

1. **Schema Definition** (Zod): `const lockSchema = z.object({...})`
2. **Tool Declaration**: `const lockTool: Tool = { name, description, inputSchema }`
3. **Handler Registration**: Switch case in `CallToolRequestSchema` handler
4. **Security Layer**: `validateInput() → buildSafeCommand() → executeCliCommand()`

### Security-first command execution

**CRITICAL**: All CLI commands use the security pipeline:

```typescript
// Pattern for all command executions
const [isValid, validationResult] = validateInput(
  schema,
  request.params.arguments,
);
const command = buildSafeCommand('baseCommand', [param1, param2]);
const result = await executeCliCommand(command);
```

**Never** use string interpolation or concatenation for CLI commands. Always use `buildSafeCommand()`.

### Input validation pattern

```typescript
const [isValid, validationResult] = validateInput(schema, input);
if (!isValid) {
  return validationResult; // Pre-formatted error response
}
// validationResult contains validated, typed data
```

## Development workflows

### Essential commands

- **Build**: `npm run build` (required before testing CLI integration)
- **Test**: `npm test` (includes security, validation, CLI, and core tests)
- **Interactive Testing**: `npm run inspect` (MCP Inspector - browser-based tool testing)
- **Linting**: `npm run lint` (ESLint + Prettier, enforced in CI)

### Environment requirements

- **BW_SESSION**: Required environment variable for Bitwarden CLI authentication
- **Test Setup**: Uses `.jest/setEnvVars.js` to mock environment in tests
- **Node.js**: Specifically requires Node.js 22 (see `.nvmrc`)

### Testing strategy

- **Security Tests**: `tests/security.spec.ts` - Command injection protection
- **Validation Tests**: `tests/validation.spec.ts` - Zod schema validation
- **CLI Tests**: `tests/cli-commands.spec.ts` - Bitwarden CLI integration
- **Core Tests**: `tests/core.spec.ts` - Tool logic and edge cases

## Project-specific conventions

### Security functions

```typescript
// Always use these for command construction:
sanitizeInput(input: string): string          // Removes dangerous characters
escapeShellParameter(value: string): string   // Safely quotes parameters
buildSafeCommand(base: string, params: string[]): string // Combines safely
isValidBitwardenCommand(command: string): boolean // Validates against whitelist
```

### Base64 pattern for complex data

Create/edit operations encode JSON data as base64:

```typescript
const itemJson = JSON.stringify(itemObject);
const itemBase64 = Buffer.from(itemJson, 'utf8').toString('base64');
const command = buildSafeCommand('create', ['item', itemBase64]);
```

### Error response format

All tool responses follow MCP standard:

```typescript
return {
  content: [{ type: 'text', text: result.output || result.errorOutput }],
  isError: result.errorOutput ? true : false,
};
```

## Integration points

### External dependencies

- **Bitwarden CLI** (`bw`): Must be installed and authenticated on host system
- **MCP SDK**: Provides server framework and type definitions (`@modelcontextprotocol/sdk`)
- **Zod**: Schema validation library

### Tool categories

- **Session Management**: `lock`, `unlock`, `sync`, `status`
- **Data Retrieval**: `list`, `get`
- **Data Modification**: `create`, `edit`, `delete`
- **Utility**: `generate` (passwords/passphrases)

### Critical files

- `src/index.ts`: Complete server implementation (1300+ lines)
- `tests/security.spec.ts`: Security validation suite
- `.jest/setEnvVars.js`: Test environment setup
- `package.json`: ES module configuration with strict TypeScript

## Security considerations

**NEVER BYPASS** the security functions. This codebase handles sensitive password vault data with multiple protection layers:

- Input sanitization removes injection characters: `[;&|`$(){}[\]<>'"\\]`
- Command validation against Bitwarden CLI whitelist
- Parameter escaping with single quotes
- No direct shell command construction

When adding new tools, always implement the full security pipeline and add comprehensive tests to `tests/security.spec.ts`.
