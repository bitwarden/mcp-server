# Bitwarden MCP Server

Security-critical TypeScript MCP server providing AI models with access to Bitwarden through two complementary interfaces:

- **Vault Management**: Personal vault operations via Bitwarden CLI
- **Organization Administration**: Enterprise admin functions via Bitwarden Public API

**Stack:** TypeScript ES modules, MCP SDK, Zod validation, Node.js 22, HTTP client

## 🔒 Dual Security Architecture (MANDATORY)

### CLI Tools Security Pipeline

For vault management operations, every tool MUST follow this pattern - NO EXCEPTIONS:

```typescript
// Modern pattern using withValidation higher-order function
export const handleCommand = withValidation(schema, async (validatedArgs) => {
  // 1. Build safe command (NEVER use string interpolation)
  const command = buildSafeCommand('baseCommand', [param1, param2]);

  // 2. Execute through security pipeline
  const result = await executeCliCommand(command);
  return result;
});
```

### HTTP API Security Pipeline

For organization admin operations, every tool MUST follow this pattern - NO EXCEPTIONS:

```typescript
// Modern pattern using withValidation higher-order function
export const handleApiCommand = withValidation(
  schema,
  async (validatedArgs) => {
    // Execute through authenticated HTTP pipeline with validated endpoint
    const result = await executeApiRequest(endpoint, method, validatedData);
    return result;
  },
);
```

### Security Functions

**CLI Security:**

- `sanitizeInput()` - Removes injection chars: `[;&|`$(){}[\]<>'"\\]`
- `escapeShellParameter()` - Safely quotes parameters
- `buildSafeCommand()` - Combines command parts securely
- `isValidBitwardenCommand()` - Validates against whitelist

**API Security:**

- `validateApiEndpoint()` - Validates API endpoint paths
- `sanitizeApiParameters()` - Sanitizes HTTP request parameters
- `buildSafeApiRequest()` - Constructs authenticated HTTP requests
- `validateBearerToken()` - Ensures valid OAuth2 access token

### Security Definitions

Apply [Bitwarden security definitions](https://contributing.bitwarden.com/architecture/security/definitions).

## 🚀 withValidation Pattern

### Overview

The `withValidation` higher-order function pattern eliminates validation code duplication across all handlers while maintaining type safety and security.

### Pattern Benefits

- **Type Safety**: Full TypeScript inference for validated arguments
- **Consistent Error Handling**: Standardized validation error responses
- **Clean Separation**: Business logic separated from validation concerns
- **Maintainability**: Single place to modify validation behavior

### Implementation

**withValidation Function:**

```typescript
export function withValidation<T, R>(
  schema: z.ZodSchema<T>,
  handler: (validatedArgs: T) => Promise<R>,
) {
  return async (args: unknown): Promise<R> => {
    const [success, validatedArgs] = validateInput(schema, args);
    if (!success) {
      return validatedArgs as R;
    }
    return handler(validatedArgs);
  };
}
```

**Usage Examples:**

```typescript
// CLI Handler
export const handleUnlock = withValidation(
  unlockSchema,
  async (validatedArgs) => {
    const { password } = validatedArgs; // Fully typed!
    const command = buildSafeCommand('unlock', [password, '--raw']);
    return executeCliCommand(command);
  },
);

// API Handler
export const handleCreateOrgCollection = withValidation(
  createCollectionRequestSchema,
  async (validatedArgs) => {
    const { name, externalId } = validatedArgs; // Fully typed!
    const body = { name, externalId };
    return executeApiRequest('/public/collections', 'POST', body);
  },
);
```

## Architecture

### Dual Interface Pattern

The MCP server provides two distinct operational interfaces:

**CLI Interface (Personal Vault)**

- Executes Bitwarden CLI commands for individual vault operations
- Requires `BW_SESSION` environment variable
- Direct command execution with shell security

**API Interface (Organization Admin)**

- Makes authenticated HTTP requests to Bitwarden Public API
- Requires OAuth2 client credentials (`CLIENT_ID`, `CLIENT_SECRET`)
- RESTful JSON communication

### Tool Implementation Pattern

1. **Schema**: `const schema = z.object({...})`
2. **Declaration**: `const tool: Tool = { name, description, inputSchema }`
3. **Handler**: `withValidation(schema, async (validatedArgs) => { ... })`
4. **Execution**: Direct execution within validated handler

**CLI Tools:**

```typescript
export const handleCommand = withValidation(
  commandSchema,
  async (validatedArgs) => {
    return executeCliCommand(buildSafeCommand('cmd', [validatedArgs.param]));
  },
);
```

**API Tools:**

```typescript
export const handleApiCommand = withValidation(
  apiSchema,
  async (validatedArgs) => {
    return executeApiRequest('/public/endpoint', 'GET', validatedArgs);
  },
);
```

### Tool Categories

**Vault Management (CLI-based):**

- **Session**: lock, unlock, sync, status
- **Retrieval**: list, get
- **Item Management**: create, edit, delete, restore
- **Folder Management**: create, edit
- **Utility**: generate
- **Organization**: list and confirm organization members, manage and move organization items
- **Device Approval**: list, approve, and deny devices

**Organization Administration (API-based):**

- **Collections**: list, create, update, delete collections
- **Members**: list, invite, update, remove organization members
- **Groups**: list, create, update, delete, manage group membership
- **Policies**: list, retrieve, update organization policies
- **Events**: retrieve organization audit logs and events
- **Organization**: manage organization subscriptions

## Organization Administration Tools

The MCP server now supports comprehensive organization administration through the Bitwarden Public API. These tools enable enterprise-level management of users, access controls, and security policies.

### API Specification Compliance

**All API tools, handlers, and schemas are based on the official [Bitwarden Public API Swagger Documentation](https://bitwarden.com/help/public-api/).**

Key compliance features:

- **Endpoint Accuracy**: All API endpoints use the correct `/public/` prefix patterns as specified in the official swagger documentation
- **Schema Validation**: Zod schemas mirror the exact request/response formats defined in the API specification
- **HTTP Methods**: Proper REST verbs (GET, POST, PUT, DELETE) matching the swagger definitions
- **Parameter Handling**: Query parameters, path parameters, and request bodies follow specification exactly
- **Response Formats**: Handler responses conform to expected API data structures

**Examples of Specification Compliance:**

- Collections: `GET/POST/PUT/DELETE /public/collections`
- Members: `GET/POST/PUT/DELETE /public/members`
- Groups: `GET/POST/PUT/DELETE /public/groups`
- Group Members: `GET/PUT /public/groups/{id}/member-ids` (not `/members`)
- Events: `GET /public/events` with proper query parameter handling

This ensures that all organization management operations work correctly with Bitwarden's production API services and maintain compatibility with future API updates.

### Collections Management

- **list_org_collections**: Retrieve all organization collections with access permissions
- **get_org_collection**: Get details of a specific collection by ID
- **update_org_collection**: Modify collection properties and permissions
- **delete_org_collection**: Remove collections from the organization

### Members Management

- **list_org_members**: List all organization members with status and access details
- **get_org_member**: Retrieve specific member information and permissions
- **invite_org_member**: Send invitations to new users to join the organization
- **update_org_member**: Modify member roles, access levels, and permissions
- **remove_org_member**: Remove users from the organization
- **reinvite_org_member**: Resend invitation emails to pending members
- **get_org_member_groups**: Get member's group assignments
- **update_org_member_groups**: Update member's group assignments

### Groups Management

- **list_org_groups**: Retrieve all organization groups and their configurations
- **get_org_group**: Get details of a specific group including member assignments
- **create_org_group**: Create new groups for organizing members
- **update_org_group**: Modify group properties and access permissions
- **delete_org_group**: Remove groups from the organization
- **get_org_group_members**: List all members assigned to a specific group
- **update_org_group_members**: Add or remove members from groups

### Policies Management

- **list_org_policies**: Retrieve all organization policies and their current status
- **get_org_policy**: Get details of a specific policy by type
- **update_org_policy**: Enable, disable, or configure organization security policies

### Event Monitoring

- **get_org_events**: Retrieve organization audit logs with filtering options

### Organization Management

- **get_org_subscription**: Get subscription details
- **update_org_subscription**: Update subscription settings
- **import_org_users_and_groups**: Import members and groups

### API Capabilities vs CLI Limitations

**API-Only Features:**

- Organization member management (invite, remove, role assignment)
- Group-based access control management
- Enterprise policy configuration
- Audit log and event monitoring
- Collection-level permission management
- Bulk operations on organization resources

**CLI-Only Features:**

- Individual vault item management (passwords, notes, cards, identities)
- Personal vault operations (sync, lock, unlock)
- Password generation utilities
- Personal folder organization
- Individual item sharing

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

**CLI Authentication:**

- **BW_SESSION**: Required for Bitwarden CLI vault operations

**API Authentication:**

- **BW_CLIENT_ID**: Organization API client ID (format: "organization.{uuid}")
- **BW_CLIENT_SECRET**: Organization API client secret
- **BW_API_BASE_URL**: API base URL (default: https://api.bitwarden.com)
- **BW_IDENTITY_URL**: Identity server URL (default: https://identity.bitwarden.com)

**Test Environment:**

- Test mocking: `.jest/setEnvVars.js`

### Authentication Differences

**CLI Authentication (Personal Vault):**

- Uses user's master password to unlock vault
- Session token (`BW_SESSION`) obtained via `bw unlock --raw`
- Session tokens expire and require re-authentication
- Access limited to user's personal vault items

**API Authentication (Organization Admin):**

- Uses OAuth2 Client Credentials flow
- Organization API key (`client_id` and `client_secret`) obtained from Admin Console
- Bearer tokens have 1-hour expiration, automatically refreshed
- Access limited to organization-level resources (no individual vault items)
- Requires Teams or Enterprise plan

## Implementation Patterns

### CLI Operations

**Base64 Encoding:**

Operations where JSON data needs to be passed in should always base64 encode the JSON object.

```typescript
const itemBase64 = Buffer.from(JSON.stringify(item), 'utf8').toString('base64');
const command = buildSafeCommand('create', ['item', itemBase64]);
```

**CLI Response Format:**

```typescript
return {
  content: [{ type: 'text', text: result.output || result.errorOutput }],
  isError: !!result.errorOutput,
};
```

### API Operations

**OAuth2 Token Management:**

```typescript
async function getAccessToken(): Promise<string> {
  const tokenResponse = await fetch(`${IDENTITY_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'api.organization',
      client_id: BW_CLIENT_ID,
      client_secret: BW_CLIENT_SECRET,
    }),
  });
  return tokenResponse.access_token;
}
```

**API Request Pattern:**

```typescript
async function executeApiRequest(endpoint: string, method: string, data?: any) {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(data && { body: JSON.stringify(data) }),
  });
  return response.json();
}
```

**API Response Format:**

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  isError: !response.ok,
};
```

## Key Files

### Core Architecture

- `src/index.ts` - Main server entry point

### Handlers (Business Logic)

- `src/handlers/cli.ts` - CLI command handlers
- `src/handlers/api.ts` - API endpoint handlers

### Schemas (Validation)

- `src/schemas/cli.ts` - Zod validation schemas for CLI operations
- `src/schemas/api.ts` - Zod validation schemas for API operations

### Tools (MCP Interface)

- `src/tools/cli.ts` - CLI tool definitions for MCP protocol
- `src/tools/api.ts` - API tool definitions for MCP protocol
- `src/tools/index.ts` - Centralized tool exports

### Utilities (Shared Services)

- `src/utils/api.ts` - HTTP client with OAuth2 authentication and token management
- `src/utils/cli.ts` - CLI command execution with security wrappers
- `src/utils/config.ts` - Environment configuration management
- `src/utils/security.ts` - Security functions including `buildSafeCommand` and endpoint validation
- `src/utils/types.ts` - TypeScript type definitions for CLI and API responses
- `src/utils/validation.ts` - Input validation utilities with `withValidation` higher-order function and consistent error formatting

### Testing

- `tests/security.spec.ts` - Security validation tests
- `tests/api.spec.ts` - API functionality tests
- `tests/cli-commands.spec.ts` - CLI command tests
- `tests/core.spec.ts` - Core server functionality tests
- `tests/validation.spec.ts` - Input validation tests
- `.jest/setEnvVars.js` - Test environment configuration

## Code Style

Follow [Bitwarden code style standards](https://contributing.bitwarden.com/contributing/code-style/).

## Requirements

### For Vault Management (CLI)

- Bitwarden CLI (`bw`) installed and configured
- Node.js 22 with ES modules
- `BW_SESSION` environment variable
- Personal Bitwarden account

### For Organization Administration (API)

- Node.js 22 with ES modules
- Bitwarden Teams or Enterprise organization
- Organization API key (client_id and client_secret)
- `BW_CLIENT_ID` and `BW_CLIENT_SECRET` environment variables
- Organization owner or admin permissions

### Setup Instructions

**CLI Setup:**

```bash
# Install Bitwarden CLI
npm install -g @bitwarden/cli

# Login and get session
bw login
export BW_SESSION=$(bw unlock --raw)
```

**API Setup:**

```bash
# Get organization API key from Admin Console:
# Settings > Organization info > API key section

export BW_CLIENT_ID="organization.your-client-id"
export BW_CLIENT_SECRET="your-client-secret"

# Optional: Configure custom endpoints for self-hosted
export BW_API_BASE_URL="https://api.bitwarden.com"
export BW_IDENTITY_URL="https://identity.bitwarden.com"
```

## References

### CLI Documentation

- **[Bitwarden CLI Command Reference](https://bitwarden.com/help/cli/)** - Complete documentation for all Bitwarden CLI commands and usage patterns

### API Documentation

- **[Bitwarden Public API Swagger Documentation](https://bitwarden.com/help/public-api/)** - Official API specification for organization administration
