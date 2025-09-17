# Bitwarden MCP Server

Security-critical TypeScript MCP server bridging AI models to Bitwarden CLI for password vault operations.

**Stack:** TypeScript ES modules, MCP SDK, Zod validation, Node.js 22

## 🔒 Security Pipeline (MANDATORY)

Every tool MUST follow this pattern - NO EXCEPTIONS:

```typescript
// 1. Validate input with Zod schema
const [isValid, validationResult] = validateInput(
  schema,
  request.params.arguments,
);
if (!isValid) return validationResult;

// 2. Build safe command (NEVER use string interpolation)
const command = buildSafeCommand('baseCommand', [param1, param2]);

// 3. Execute through security pipeline
const result = await executeCliCommand(command);
```

### Security Functions

- `sanitizeInput()` - Removes injection chars: `[;&|`$(){}[\]<>'"\\]`
- `escapeShellParameter()` - Safely quotes parameters
- `buildSafeCommand()` - Combines command parts securely
- `isValidBitwardenCommand()` - Validates against whitelist

### Security Definitions

Apply [Bitwarden security definitions](https://contributing.bitwarden.com/architecture/security/definitions).

## Architecture

### Tool Implementation Pattern

1. **Schema**: `const schema = z.object({...})`
2. **Declaration**: `const tool: Tool = { name, description, inputSchema }`
3. **Handler**: Switch case in CallToolRequestSchema
4. **Execution**: Security pipeline (see above)

### Tool Categories

- **Session**: lock, unlock, sync, status
- **Retrieval**: list, get
- **Modification**: create, edit, delete
- **Utility**: generate

## Development

### Commands

```bash
npm run build    # Required before CLI testing
npm test         # Run all test suites
npm run inspect  # MCP Inspector for interactive testing
npm run lint     # ESLint + Prettier
```

### Testing

- `tests/security.spec.ts` - Injection protection
- `tests/validation.spec.ts` - Schema validation
- `tests/cli-commands.spec.ts` - CLI integration
- `tests/core.spec.ts` - Tool logic

### Environment

- **BW_SESSION**: Required for Bitwarden CLI auth
- Test mocking: `.jest/setEnvVars.js`

## Implementation Patterns

### Base64 Encoding (create/edit)

```typescript
const itemBase64 = Buffer.from(JSON.stringify(item), 'utf8').toString('base64');
const command = buildSafeCommand('create', ['item', itemBase64]);
```

### MCP Response Format

```typescript
return {
  content: [{ type: 'text', text: result.output || result.errorOutput }],
  isError: !!result.errorOutput,
};
```

## Key Files

- `src/index.ts` - Server implementation
- `tests/security.spec.ts` - Security tests
- `.jest/setEnvVars.js` - Test environment

## Code Style

Follow [Bitwarden code style standards](https://contributing.bitwarden.com/contributing/code-style/).

## Requirements

- Bitwarden CLI (`bw`) installed and configured
- Node.js 22 with ES modules
- BW_SESSION environment variable
