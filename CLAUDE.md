# Bitwarden MCP Server

Security-critical TypeScript MCP server providing AI models with access to Bitwarden through two complementary interfaces:

- **Vault Management**: Personal vault operations via Bitwarden CLI
- **Organization Administration**: Enterprise admin functions via Bitwarden Public API

**Stack:** TypeScript ES modules, MCP SDK, Zod validation, Node.js 22, HTTP client

## 🔒 Dual Security Architecture (MANDATORY)

### CLI Tools Security Pipeline

For vault management operations, every tool MUST follow this pattern - NO EXCEPTIONS:

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

### HTTP API Security Pipeline

For organization admin operations, every tool MUST follow this pattern - NO EXCEPTIONS:

```typescript
// 1. Validate input with Zod schema
const [isValid, validationResult] = validateInput(
  schema,
  request.params.arguments,
);
if (!isValid) return validationResult;

// 2. Build safe HTTP request (validate URL paths and parameters)
const request = buildSafeApiRequest(endpoint, method, validatedData);

// 3. Execute through authenticated HTTP pipeline
const result = await executeApiRequest(request);
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

**CLI Tools:**

1. **Schema**: `const schema = z.object({...})`
2. **Declaration**: `const tool: Tool = { name, description, inputSchema }`
3. **Handler**: Switch case with CLI security pipeline
4. **Execution**: `executeCliCommand()`

**API Tools:**

1. **Schema**: `const schema = z.object({...})`
2. **Declaration**: `const tool: Tool = { name, description, inputSchema }`
3. **Handler**: Switch case with API security pipeline
4. **Execution**: `executeApiRequest()`

### Tool Categories

**Vault Management (CLI-based):**

- **Session**: lock, unlock, sync, status
- **Retrieval**: list, get
- **Modification**: create, edit, delete
- **Utility**: generate

**Organization Administration (API-based):**

- **Collections**: list, create, update, delete collections
- **Members**: list, invite, update, remove organization members
- **Groups**: list, create, update, delete, manage group membership
- **Policies**: list, retrieve, update organization policies
- **Events**: retrieve organization audit logs and events

## Organization Administration Tools

The MCP server now supports comprehensive organization administration through the Bitwarden Public API. These tools enable enterprise-level management of users, access controls, and security policies.

### Collections Management

- **list-collections**: Retrieve all organization collections with access permissions
- **get-collection**: Get details of a specific collection by ID
- **create-collection**: Create new collections for organizing vault items
- **update-collection**: Modify collection properties and permissions
- **delete-collection**: Remove collections from the organization

### Members Management

- **list-members**: List all organization members with status and access details
- **get-member**: Retrieve specific member information and permissions
- **invite-member**: Send invitations to new users to join the organization
- **update-member**: Modify member roles, access levels, and permissions
- **remove-member**: Remove users from the organization
- **reinvite-member**: Resend invitation emails to pending members

### Groups Management

- **list-groups**: Retrieve all organization groups and their configurations
- **get-group**: Get details of a specific group including member assignments
- **create-group**: Create new groups for organizing members
- **update-group**: Modify group properties and access permissions
- **delete-group**: Remove groups from the organization
- **get-group-members**: List all members assigned to a specific group
- **update-group-members**: Add or remove members from groups

### Policies Management

- **list-policies**: Retrieve all organization policies and their current status
- **get-policy**: Get details of a specific policy by type
- **update-policy**: Enable, disable, or configure organization security policies

### Event Monitoring

- **list-events**: Retrieve organization audit logs with filtering options
- **get-events**: Get specific event details for compliance and security monitoring

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

**Base64 Encoding (create/edit):**

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

- `src/index.ts` - Server implementation
- `tests/security.spec.ts` - Security tests
- `.jest/setEnvVars.js` - Test environment

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
