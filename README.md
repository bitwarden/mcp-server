# Bitwarden MCP Server

Model Context Protocol (MCP) server that enables interaction with the Bitwarden password manager vault via the MCP protocol. The server allows AI models to securely communicate with a user's Bitwarden vault through defined tool interfaces.

## Prerequisites

- Node.js 22
- **For CLI operations**: Bitwarden CLI (`bw`) installed, authenticated, and valid session token
- **For API operations**: Bitwarden organization with API access and valid client credentials

## Installation

### Option One: Configuration in your AI app

Open up your application configuration, e.g. for Claude Desktop:

```json
{
  "mcpServers": {
    "bitwarden": {
      "command": "npx",
      "args": ["-y", "@bitwarden/mcp-server"]
    }
  }
}
```

### Option Two: Local checkout

Requires that this repository be checked out locally. Once that's done:

```bash
npm install
npm run build
```

## Setup

The server supports two authentication methods:

### Option A: CLI Authentication (for personal vault operations)

1. **Install Bitwarden CLI**:

   ```bash
   npm install -g @bitwarden/cli
   ```

2. **Log in to Bitwarden**:

   ```bash
   bw login
   ```

3. **Get session token**:
   ```bash
   export BW_SESSION=$(bw unlock --raw)
   ```

### Option B: API Authentication (for organization management)

1. **Create API credentials** in your Bitwarden organization settings

2. **Set environment variables**:

   ```bash
   export BW_CLIENT_ID="your_client_id"
   export BW_CLIENT_SECRET="your_client_secret"
   ```

3. **Optional: Set custom API URLs** (if using self-hosted):
   ```bash
   export BW_API_BASE_URL="https://api.bitwarden.com"
   export BW_IDENTITY_URL="https://identity.bitwarden.com"
   ```

> **Note**: You can use both authentication methods simultaneously for full functionality.

## Testing

### Running unit tests

The project includes Jest unit tests covering validation, CLI commands, and core functionality.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test validation.spec.ts

# Run tests matching a pattern
npm test -- --testNamePattern="validation"
```

## Inspection and development

### MCP Inspector

Use the MCP Inspector to test the server interactively:

```bash
# Start the inspector
npm run inspect
```

This will:

1. Start the MCP server
2. Launch the inspector UI in your browser
3. Allow you to test all available tools interactively

### Available tools

The server provides comprehensive Bitwarden functionality through two categories of tools:

#### Personal Vault Tools (CLI Authentication)

| Tool       | Description                  | Required Parameters                               |
| ---------- | ---------------------------- | ------------------------------------------------- |
| `lock`     | Lock the vault               | None                                              |
| `unlock`   | Unlock with master password  | `password`                                        |
| `sync`     | Sync vault data              | None                                              |
| `status`   | Check CLI status             | None                                              |
| `list`     | List vault items/folders     | `type` (items/folders/collections/organizations)  |
| `get`      | Get specific item/folder     | `object`, `id`                                    |
| `generate` | Generate password/passphrase | Various optional parameters                       |
| `create`   | Create new item or folder    | `objectType`, `name`, additional fields for items |
| `edit`     | Edit existing item or folder | `objectType`, `id`, optional fields to update     |
| `delete`   | Delete vault item/folder     | `object`, `id`, optional `permanent`              |

#### Organization Management Tools (API Authentication)

##### Collections Management

| Tool                | Description                   | Required Parameters |
| ------------------- | ----------------------------- | ------------------- |
| `list-collections`  | List organization collections | None                |
| `get-collection`    | Get collection details        | `id`                |
| `create-collection` | Create new collection         | `name`              |
| `update-collection` | Update existing collection    | `id`                |
| `delete-collection` | Delete collection             | `id`                |

##### Members Management

| Tool                      | Description                       | Required Parameters |
| ------------------------- | --------------------------------- | ------------------- |
| `list-members`            | List organization members         | None                |
| `get-member`              | Get member details                | `id`                |
| `invite-member`           | Invite new member                 | `email`, `type`     |
| `update-member`           | Update existing member            | `id`                |
| `remove-member`           | Remove member from organization   | `id`                |
| `reinvite-member`         | Re-invite member                  | `id`                |
| `get-member-group-ids`    | Get member's group assignments    | `id`                |
| `update-member-group-ids` | Update member's group assignments | `id`, `groupIds`    |

##### Groups Management

| Tool                      | Description                       | Required Parameters |
| ------------------------- | --------------------------------- | ------------------- |
| `list-groups`             | List organization groups          | None                |
| `get-group`               | Get group details                 | `id`                |
| `create-group`            | Create new group                  | `name`              |
| `update-group`            | Update existing group             | `id`, `name`        |
| `delete-group`            | Delete group                      | `id`                |
| `get-group-member-ids`    | Get group's member assignments    | `id`                |
| `update-group-member-ids` | Update group's member assignments | `id`, `memberIds`   |

##### Policies Management

| Tool            | Description                | Required Parameters |
| --------------- | -------------------------- | ------------------- |
| `list-policies` | List organization policies | None                |
| `get-policy`    | Get policy details         | `type`              |
| `update-policy` | Update organization policy | `type`, `enabled`   |

##### Organization Management

| Tool                               | Description                  | Required Parameters |
| ---------------------------------- | ---------------------------- | ------------------- |
| `get-organization-subscription`    | Get subscription details     | None                |
| `update-organization-subscription` | Update subscription settings | None                |
| `import-organization`              | Import members and groups    | None                |

##### Events and Auditing

| Tool          | Description                 | Required Parameters |
| ------------- | --------------------------- | ------------------- |
| `list-events` | Get organization audit logs | None                |

### Manual testing

1. **Start the server**:

   ```bash
   export BW_SESSION=$(bw unlock --raw)
   node dist/index.js
   ```

2. **Test with an MCP client** or use the inspector to send tool requests.

### Debugging

- **Enable debug logging** by setting environment variables:

  ```bash
  export DEBUG=bitwarden:*
  export NODE_ENV=development
  ```

- **Check Bitwarden CLI status**:

  ```bash
  bw status
  ```

- **Verify session token**:
  ```bash
  echo $BW_SESSION
  ```

## Security considerations

- **Never commit** sensitive credentials (`BW_SESSION`, `BW_CLIENT_ID`, `BW_CLIENT_SECRET`)
- **Use environment variables** for all sensitive configuration
- **Validate all inputs** using Zod schemas (already implemented)
- **Test with non-production data** when possible
- **Limit API permissions** to only what's necessary for your use case
- **Monitor API usage** through your organization's audit logs
- **Use HTTPS** for all API communications (default)
- Understand the security and privacy impacts of exposing sensitive vault data to LLM and AI tools. Using a self-hosted or local LLM may be appropriate, for example.

## Troubleshooting

### Common issues

1. **"Please set the BW_SESSION environment variable"**
   - Run: `export BW_SESSION=$(bw unlock --raw)`

2. **"BW_CLIENT_ID and BW_CLIENT_SECRET environment variables are required"**
   - Set your API credentials: `export BW_CLIENT_ID="your_id"` and `export BW_CLIENT_SECRET="your_secret"`
   - Verify credentials are valid in your Bitwarden organization settings

3. **API authentication failures**
   - Check that your organization has API access enabled
   - Verify client credentials have appropriate permissions
   - Ensure you're using the correct API URLs for your instance

4. **Tests failing with environment errors**
   - Use the environment mocking helpers in tests
   - Ensure test cleanup with `restoreEnvVars()`

5. **Inspector not starting**
   - Check that the server builds successfully: `npm run build`
   - Verify Node.js version is 22

6. **CLI commands failing**
   - Verify Bitwarden CLI is installed: `bw --version`
   - Check vault is unlocked: `bw status`
   - Ensure valid session token: `echo $BW_SESSION`
