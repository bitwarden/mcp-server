# Bitwarden MCP Server - Claude Code Configuration

This document provides comprehensive guidelines for developing and maintaining the Bitwarden MCP Server.

## Architecture Overview

### Dual Interface Pattern

The MCP server exposes two distinct operational interfaces:

**1. CLI Interface (Vault Management and CLI Tools)**

- Wraps Bitwarden CLI (`bw`) commands for personal vault operations
- Requires `BW_SESSION` environment variable
- Executes shell commands with security hardening
- Returns plain text or JSON responses from CLI

**2. API Interface (Organization Administration)**

- Makes authenticated HTTP requests to Bitwarden Public API
- Requires OAuth2 client credentials (`BW_CLIENT_ID`, `BW_CLIENT_SECRET`)
- Uses RESTful JSON communication
- Returns structured JSON responses

### Request Flow

```
AI Client (Claude Desktop)
    ↓
MCP Protocol (stdio transport)
    ↓
index.ts (tool routing)
    ↓
┌─────────────────────┬──────────────────────┐
│   CLI Handler       │   API Handler        │
│   ↓                 │   ↓                  │
│   Security Layer    │   OAuth2 Client      │
│   ↓                 │   ↓                  │
│   Bitwarden CLI     │   Bitwarden API      │
└─────────────────────┴──────────────────────┘
```

## Code Organization

### Key Principles

1. **Separation of Concerns**: Tools (definitions) → Schemas (validation) → Handlers (logic) → Utils (execution)
2. **Type Safety**: End-to-end TypeScript with Zod runtime validation
3. **Security First**: All inputs validated and sanitized before execution
4. **Consistent Patterns**: Same structure for CLI and API tools

## Security Architecture

### Mandatory Security Pipeline

**EVERY tool must follow the security pipeline - NO EXCEPTIONS.**

#### CLI Tools Security Pipeline

```typescript
// 1. Define Zod schema
const schema = z.object({
  param: z.string(),
});

// 2. Create handler with withValidation wrapper
export const handleCommand = withValidation(schema, async (validatedArgs) => {
  // 3. Execute command (automatically validates and uses spawn())
  const result = await executeCliCommand('baseCommand', [validatedArgs.param]);

  // 4. Return formatted response
  return {
    content: [{ type: 'text', text: result.output || result.errorOutput }],
    isError: !!result.errorOutput,
  };
});
```

#### API Tools Security Pipeline

```typescript
// 1. Define Zod schema matching API spec
const schema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

// 2. Create handler with withValidation wrapper
export const handleApiCommand = withValidation(
  schema,
  async (validatedArgs) => {
    // 3. Execute authenticated request
    const result = await executeApiRequest(
      `/public/endpoint/${validatedArgs.id}`,
      'PUT',
      { name: validatedArgs.name },
    );

    // 4. Return formatted response
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  },
);
```

### Security Functions

#### CLI Security

- **`sanitizeInput(input: string)`**: Strips dangerous characters `[;&|`$(){}[\]<>'"\\]` from base command
- **`validateParameter(param: string)`**: Validates parameters for null bytes and newlines
- **`buildSafeCommand(base: string, args: string[])`**: Returns array `[command, ...args]` for spawn() (used internally by `executeCliCommand`)
- **`executeCliCommand(command: string, parameters: string[])`**: Single entry point for CLI execution - internally calls `buildSafeCommand()` then uses `spawn()` to prevent shell injection
- **`isValidBitwardenCommand(cmd: string)`**: Validates against whitelist of allowed Bitwarden commands
- **`validateFilePath(path: string)`**: Prevents path traversal attacks

#### API Security

- **`validateApiEndpoint(endpoint: string)`**: Ensures endpoint matches `/public/` pattern
- **`getAccessToken()`**: Manages OAuth2 token lifecycle with automatic refresh
- **`executeApiRequest(endpoint, method, data?)`**: Authenticated HTTP wrapper

### Security Rules

1. **Use spawn() with argument arrays** - NEVER use exec() or string interpolation for commands
2. **Always validate inputs** with Zod schemas before processing
3. **Whitelist allowed commands** - never trust user input
4. **Pass arguments as array elements** to spawn() which handles them as literal strings
5. **Validate file paths** to prevent directory traversal
6. **Use environment variables** for credentials, never hardcode
7. **Disable shell** - Always use `shell: false` option with spawn()

## The `withValidation` Pattern

### Purpose

Eliminates validation code duplication while maintaining type safety and consistent error handling.

### Implementation

```typescript
// Located in: src/utils/validation.ts
export function withValidation<T, R>(
  schema: z.ZodSchema<T>,
  handler: (validatedArgs: T) => Promise<R>,
) {
  return async (args: unknown): Promise<R> => {
    const [success, validatedArgs] = validateInput(schema, args);
    if (!success) {
      return validatedArgs as R; // Returns formatted error response
    }
    return handler(validatedArgs);
  };
}
```

### Benefits

- **Type Inference**: `validatedArgs` is fully typed based on Zod schema
- **Error Consistency**: All validation errors formatted identically
- **Code Reduction**: No repeated try/catch or validation boilerplate
- **Single Responsibility**: Handlers only contain business logic

### Usage Pattern

```typescript
// Schema
const createItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['login', 'note', 'card', 'identity']),
});

// Handler with automatic validation
export const handleCreateItem = withValidation(
  createItemSchema,
  async (validatedArgs) => {
    // validatedArgs is typed: { name: string, type: 'login' | 'note' | 'card' | 'identity' }
    const { name, type } = validatedArgs;

    // Business logic only - no validation code needed
    const item = { name, type };
    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const result = await executeCliCommand('create', ['item', encoded]);

    return {
      content: [{ type: 'text', text: result.output }],
      isError: false,
    };
  },
);
```

## Adding New Tools

### Step-by-Step Guide

**1. Define the Schema** (`src/schemas/cli.ts` or `src/schemas/api.ts`)

```typescript
export const myNewToolSchema = z.object({
  requiredField: z.string().min(1),
  optionalField: z.number().optional(),
});
```

**2. Define the Tool** (`src/tools/cli.ts` or `src/tools/api.ts`)

```typescript
export const myNewTool: Tool = {
  name: 'my_new_tool',
  description:
    'Clear, concise description for AI to understand when to use this tool',
  inputSchema: {
    type: 'object',
    properties: {
      requiredField: {
        type: 'string',
        description: 'What this field is for',
      },
      optionalField: {
        type: 'number',
        description: 'What this optional field is for',
      },
    },
    required: ['requiredField'],
  },
};
```

**3. Export the Tool** (`src/tools/index.ts`)

```typescript
import { myNewTool } from './cli.js';

export const cliTools: Tool[] = [
  // ... existing tools
  myNewTool,
];
```

**4. Implement the Handler** (`src/handlers/cli.ts` or `src/handlers/api.ts`)

```typescript
export const handleMyNewTool = withValidation(
  myNewToolSchema,
  async (validatedArgs) => {
    // Implementation
    const result = await executeCliCommand('bw-command', [
      validatedArgs.requiredField,
    ]);

    return {
      content: [{ type: 'text', text: result.output }],
      isError: !!result.errorOutput,
    };
  },
);
```

**5. Register the Handler** (`src/index.ts`)

```typescript
// Import at top
import { handleMyNewTool } from './handlers/cli.js';

// Add case in switch statement
switch (name) {
  // ... existing cases
  case 'my_new_tool':
    return await handleMyNewTool(args);
```

**6. Write Tests** (`tests/cli-commands.spec.ts` or `tests/api.spec.ts`)

```typescript
describe('myNewTool', () => {
  it('should execute successfully with valid input', async () => {
    const result = await handleMyNewTool({ requiredField: 'test' });
    expect(result.isError).toBe(false);
  });

  it('should reject invalid input', async () => {
    const result = await handleMyNewTool({ requiredField: '' });
    expect(result.isError).toBe(true);
  });
});
```

**7. Update Documentation**

If appropriate, `CLAUDE.md` and/or `README.md` may need updating with any changes and/or additions.

## CLI Tool Development

### CLI Command Patterns

**Simple Commands (No Arguments)**

```typescript
export const handleSync = withValidation(syncSchema, async () => {
  return executeCliCommand('sync', []);
});
```

**Commands with Parameters**

```typescript
export const handleList = withValidation(listSchema, async (validatedArgs) => {
  const params = [validatedArgs.type];

  if (validatedArgs.search) {
    params.push('--search', validatedArgs.search);
  }

  return executeCliCommand('list', params);
});
```

**Commands with Base64-Encoded JSON**

```typescript
export const handleCreateItem = withValidation(
  createItemSchema,
  async (validatedArgs) => {
    const item = {
      type: validatedArgs.type,
      name: validatedArgs.name,
      // ... other fields
    };

    const encoded = Buffer.from(JSON.stringify(item), 'utf8').toString(
      'base64',
    );

    return executeCliCommand('create', ['item', encoded]);
  },
);
```

### CLI Response Formatting

Always return this structure:

```typescript
return {
  content: [{ type: 'text', text: result.output || result.errorOutput }],
  isError: !!result.errorOutput,
};
```

## API Tool Development

### API Request Patterns

**GET Requests**

```typescript
export const handleListOrgCollections = withValidation(
  listOrgCollectionsSchema,
  async () => {
    return executeApiRequest('/public/collections', 'GET');
  },
);
```

**GET with Path Parameters**

```typescript
export const handleGetOrgCollection = withValidation(
  getOrgCollectionSchema,
  async (validatedArgs) => {
    return executeApiRequest(
      `/public/collections/${validatedArgs.collectionId}`,
      'GET',
    );
  },
);
```

**POST/PUT with Request Body**

```typescript
export const handleUpdateOrgCollection = withValidation(
  updateOrgCollectionSchema,
  async (validatedArgs) => {
    const { collectionId, ...body } = validatedArgs;
    return executeApiRequest(
      `/public/collections/${collectionId}`,
      'PUT',
      body,
    );
  },
);
```

**GET with Query Parameters**

```typescript
export const handleGetOrgEvents = withValidation(
  getOrgEventsSchema,
  async (validatedArgs) => {
    const params = new URLSearchParams();
    if (validatedArgs.start) params.append('start', validatedArgs.start);
    if (validatedArgs.end) params.append('end', validatedArgs.end);

    return executeApiRequest(`/public/events?${params.toString()}`, 'GET');
  },
);
```

### API Response Formatting

Always return this structure:

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  isError: !response.ok,
};
```

### API Specification Compliance

**All API tools must conform to the [Bitwarden Public API Swagger Documentation](https://bitwarden.com/help/public-api/).**

Key requirements:

- Use exact endpoint paths from swagger (e.g., `/public/collections`, not `/collections`)
- Match HTTP methods specified in API docs
- Include all required fields in request bodies
- Use correct query parameter names
- Follow naming conventions for IDs (e.g., `collectionId`, not `collection_id`)

## Testing

### Test Structure

```
tests/
├── core.spec.ts          # Server initialization and tool registration
├── validation.spec.ts    # Schema validation logic
├── security.spec.ts      # Input sanitization and injection prevention
├── cli-commands.spec.ts  # CLI tool integration tests
└── api.spec.ts          # API tool integration tests
```

### Writing Tests

**Validation Tests**

```typescript
import { myNewToolSchema } from '../src/schemas/cli.js';

describe('myNewToolSchema', () => {
  it('should accept valid input', () => {
    const result = myNewToolSchema.safeParse({ requiredField: 'test' });
    expect(result.success).toBe(true);
  });

  it('should reject empty required field', () => {
    const result = myNewToolSchema.safeParse({ requiredField: '' });
    expect(result.success).toBe(false);
  });
});
```

**Handler Tests**

```typescript
import { handleMyNewTool } from '../src/handlers/cli.js';

describe('handleMyNewTool', () => {
  it('should build correct command', async () => {
    const result = await handleMyNewTool({ requiredField: 'test-value' });
    expect(result.isError).toBe(false);
    // Add expectations about result content
  });
});
```

**Security Tests**

```typescript
import { sanitizeInput } from '../src/utils/security.js';

describe('sanitizeInput', () => {
  it('should remove dangerous characters', () => {
    const input = 'test; rm -rf /';
    const sanitized = sanitizeInput(input);
    expect(sanitized).toBe('test rm -rf ');
  });
});
```

### Running Tests

```bash
npm test                  # Run all tests with coverage
npm run test:watch        # Watch mode for TDD
npm test -- security      # Run specific test file
```

### Test Environment

Tests use mocked environment variables set in `.jest/setEnvVars.js`:

```javascript
process.env.BW_SESSION = 'mock-session-token';
process.env.BW_CLIENT_ID = 'organization.mock-id';
process.env.BW_CLIENT_SECRET = 'mock-secret';
```

## OAuth2 Token Management

### Token Lifecycle

```typescript
let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Request new token
  const response = await fetch(`${IDENTITY_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'api.organization',
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  });

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // 1 min buffer

  return accessToken;
}
```

### Token Features

- **Automatic Refresh**: Tokens refreshed 1 minute before expiry
- **In-Memory Caching**: Reduces unnecessary token requests
- **Error Handling**: Failed requests trigger re-authentication
- **Thread Safe**: Single token instance shared across all API calls

## Common Patterns

### Filter Handling (CLI)

```typescript
// Optional filters
if (validatedArgs.folderid) {
  args.push('--folderid', validatedArgs.folderid);
}

// Boolean flags
if (validatedArgs.trash) {
  args.push('--trash');
}

// Special values
// User can pass "null" or "notnull" as strings to CLI
```

### Collection/Array Parameters (API)

```typescript
// Zod schema for array of objects
collections: z.array(
  z.object({
    id: z.string().uuid(),
    readOnly: z.boolean(),
  }),
).optional();

// Handler
if (validatedArgs.collections) {
  body.collections = validatedArgs.collections;
}
```

### Error Handling

```typescript
try {
  const result = await executeCliCommand(command);
  return {
    content: [{ type: 'text', text: result.output }],
    isError: false,
  };
} catch (error) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}
```

## Code Style

Follow [Bitwarden Code Style Guidelines](https://contributing.bitwarden.com/contributing/code-style/):

- **Formatting**: Prettier handles all formatting
- **Linting**: ESLint enforces code quality
- **TypeScript**: Strict mode enabled, no `any` types
- **Naming**: camelCase for variables/functions, PascalCase for types
- **Imports**: Explicit `.js` extensions for ES modules
- **Comments**: JSDoc for public APIs, inline for complex logic

### Pre-commit Hooks

Husky automatically runs on staged files:

- Prettier formatting
- ESLint fixing

### Manual Checks

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## Deployment

### Building

```bash
npm run build
# Compiles TypeScript to dist/
# Makes dist/index.js executable
```

### Publishing

```bash
npm version patch|minor|major
npm run build
npm publish
```

### Versioning

Follow semantic versioning: `YYYY.M.PATCH`

- `YYYY`: Year
- `M`: Month (no leading zero)
- `PATCH`: Patch number

Example: `2025.10.0`

## References

### Official Documentation

- [Bitwarden CLI Reference](https://bitwarden.com/help/cli/)
- [Bitwarden Public API Swagger](https://bitwarden.com/help/public-api/)
- [Bitwarden Send CLI Reference](https://bitwarden.com/help/send-cli/)
- [MCP Specification](https://modelcontextprotocol.io/)

### Internal Documentation

- [Bitwarden Contributing Guide](https://contributing.bitwarden.com/)
- [Bitwarden Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Bitwarden Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)

### Tools & Libraries

- [Zod Documentation](https://zod.dev/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Jest Testing Framework](https://jestjs.io/)

## Troubleshooting Development Issues

### Build Errors

**"Cannot find module" errors**

- Ensure imports use `.js` extension (ES modules require explicit extensions)
- Check TypeScript version matches `package.json`

**Permission errors on `dist/index.js`**

- Build script includes `shx chmod +x` - ensure `shx` is installed

### Test Failures

**Environment variable errors**

- Check `.jest/setEnvVars.js` is being loaded
- Verify mocked values match test expectations

**Timeout errors**

- Increase Jest timeout: `jest.setTimeout(10000)`
- Check for async operations without `await`

### Runtime Errors

**"Session key is invalid" in tests**

- Tests should mock CLI execution, not call real `bw` command
- Use dependency injection or spy on `executeCliCommand`

**OAuth2 token errors**

- Ensure mock credentials match expected format
- Check token caching logic doesn't interfere with tests

## Best Practices

### DO

✅ Use `withValidation` for all handlers
✅ Define Zod schemas for all inputs
✅ Use `buildSafeCommand` for CLI operations
✅ Follow API specification exactly
✅ Write tests for new tools
✅ Document complex logic
✅ Handle errors gracefully
✅ Use TypeScript strict mode
✅ Cache API tokens appropriately

### DON'T

❌ Use string interpolation for commands
❌ Skip input validation
❌ Execute arbitrary user-provided commands
❌ Hardcode credentials
❌ Ignore error responses
❌ Use `any` types
❌ Commit sensitive data
❌ Modify security functions without review
❌ Bypass the validation pipeline
