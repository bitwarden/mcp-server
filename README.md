# Bitwarden MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with secure access to Bitwarden password manager functionality through two complementary interfaces:

- **Vault Management and CLI tools** via Bitwarden CLI
- **Organization Administration** via Bitwarden Public API

[![npm version](https://img.shields.io/npm/v/@bitwarden/mcp-server.svg)](https://www.npmjs.com/package/@bitwarden/mcp-server)

> [!WARNING]
> This MCP server is designed exclusively for local use and must never be hosted publicly or exposed over a network.
>
> When you grant an AI assistant access to this server, you are providing the ability to:
>
> - Read vault items including passwords, secure notes, and sensitive data
> - Create, modify, and delete vault items
> - Access organization secrets and administrative functions
> - Expose credentials and vault contents through AI responses
>
> **You are responsible for:**
>
> - Ensuring this server runs only on your local machine or self-hosted environment
> - Understanding what data you're exposing to your AI assistant
> - Being aware that AI responses may inadvertently reveal sensitive information
> - Using appropriate AI providers (consider self-hosted or local LLMs for sensitive data)
> - Never sharing configuration files containing session tokens or API credentials
> - Monitoring logs for unexpected activity
>
> **Never:**
>
> - Deploy this server to cloud hosting, containers, or public servers
> - Share your MCP configuration files with others
> - Use this server over untrusted networks
> - Grant access to untrusted AI clients or services
>
> Use this tool responsibly and at your own risk.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that enables AI assistants to securely interact with local tools and services. This server exposes Bitwarden's vault management and organization administration capabilities to MCP-compatible AI clients like Claude Desktop.

## Features

### Vault Management and CLI tools (CLI)

- **Session Management**: Lock vault, sync with server, check status
- **Item Operations**: List, retrieve, create, edit, delete, restore vault items
  - Supports logins, secure notes, cards, and identities
  - Advanced filtering by URL, folder, collection, or trash status
- **Folder Management**: Organize items with folders
- **Attachments**: Upload, download, and manage file attachments
- **Password Tools**: Generate secure passwords and retrieve TOTP codes
- **Bitwarden Send**: Create and manage secure ephemeral shares (text/file)
- **Organization Items**: Move items to organizations, manage collections
- **Device Approval**: Approve or deny new device login requests
- **Member Management**: Confirm organization member registrations

### Organization Administration (API)

- **Collections**: Create, update, delete, and manage collection permissions
- **Members**: Invite, update roles, remove members, manage group assignments
- **Groups**: Create role-based access groups and assign members
- **Policies**: Configure and enforce organization security policies
- **Audit Logs**: Retrieve organization event history
- **Subscriptions**: View and update organization billing information
- **Bulk Import**: Import users and groups from external systems

## Quick Start

### Prerequisites

**For Vault Management and CLI tools:**

- [Bitwarden CLI](https://bitwarden.com/help/cli/) installed (ex. `npm install -g @bitwarden/cli`)
- Node.js 22+
- Bitwarden account

**For Organization Administration:**

- Node.js 22+
- Bitwarden Teams or Enterprise organization
- Organization owner or admin permissions

### Configuration

> [!WARNING]
> The configuration files below will contain sensitive credentials that grant access to your Bitwarden vault. Keep these files secure, never commit them to version control, and never share them with others. Ensure your MCP client (e.g., Claude Desktop) is configured to run the server locally only.

#### Option 1: Claude Desktop (Recommended)

Add to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bitwarden": {
      "command": "npx",
      "args": ["-y", "@bitwarden/mcp-server"],
      "env": {
        "BW_SESSION": "your-session-token-here"
      }
    }
  }
}
```

**Get your session token:**

```bash
bw login
bw unlock --raw
```

To enable organization administration features, add API credentials:

```json
{
  "mcpServers": {
    "bitwarden": {
      "command": "npx",
      "args": ["-y", "@bitwarden/mcp-server"],
      "env": {
        "BW_SESSION": "your-session-token-here",
        "BW_CLIENT_ID": "organization.your-client-id",
        "BW_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

**Get organization API credentials:**

1. Go to your Bitwarden Web Vault
2. Navigate to your organization → Settings → My Organization
3. Scroll to "API Key" section
4. Click "View API Key" and authenticate

#### Option 2: Locally Built and Referenced

Requires that this repository be checked out locally. Once that's done:

```bash
npm install
npm run build
```

Then reference the built `dist/index.js` file from Claude desktop:

```json
{
  "mcpServers": {
    "bitwarden": {
      "command": "node",
      "args": ["local/path/to/mcp-server/dist/index.js"],
      "env": {
        "BW_SESSION": "your-session-token-here"
      }
    }
  }
}
```

#### Option 3: Other MCP Clients

Any MCP-compatible client can connect to this server via stdio transport. Refer to your client's documentation for configuration details.

### Environment Variables

| Variable                 | Required For    | Description                                      | Default                            |
| ------------------------ | --------------- | ------------------------------------------------ | ---------------------------------- |
| `BW_SESSION`             | CLI operations  | Session token from `bw unlock --raw`             | -                                  |
| `BW_CLIENT_ID`           | API operations  | Organization API client ID                       | -                                  |
| `BW_CLIENT_SECRET`       | API operations  | Organization API client secret                   | -                                  |
| `BW_API_BASE_URL`        | API operations  | Bitwarden API base URL                           | `https://api.bitwarden.com`        |
| `BW_IDENTITY_URL`        | API operations  | OAuth2 identity server URL                       | `https://identity.bitwarden.com`   |
| `BW_ALLOWED_DIRECTORIES` | File operations | Comma-separated list of allowed file directories | `os.tmpdir() + '/bitwarden-files'` |

**Note:** For self-hosted Bitwarden instances, set `BW_API_BASE_URL` and `BW_IDENTITY_URL` to your server URLs.

## Usage Examples

Once configured, you can interact with Bitwarden through your AI assistant:

**Vault:**

- "List all my login items"
- "Get my credentials for github"
- "Create a new secure note for my home WiFi information"
- "Generate a 32-character password and save it for apple.com"
- "Create a Send link for this file"

**Organization Administration:**

- "List all members in my organization"
- "Invite user@example.com as an organization admin"
- "Create a 'Development Team' collection"
- "Show me the last 100 audit log events"
- "What security policies are enabled?"

## Available Tools

### Vault Management and CLI Tools

- **Session**: `lock`, `sync`, `status`
- **Retrieval**: `list`, `get`
- **Items**: `create_item`, `edit_item`, `delete`, `restore`
- **Folders**: `create_folder`, `edit_folder`
- **Attachments**: `create_attachment`
- **Organizations**: `create_org_collection`, `edit_org_collection`, `edit_item_collections`, `move`, `confirm`
- **Device Approval**: `device_approval_list`, `device_approval_approve`, `device_approval_approve_all`, `device_approval_deny`, `device_approval_deny_all`
- **Send**: `create_text_send`, `create_file_send`, `list_send`, `get_send`, `edit_send`, `delete_send`, `remove_send_password`
- **Utilities**: `generate`

### Organization Administration

- **Collections**: `list_org_collections`, `get_org_collection`, `update_org_collection`, `delete_org_collection`
- **Members**: `list_org_members`, `get_org_member`, `invite_org_member`, `update_org_member`, `remove_org_member`, `reinvite_org_member`, `get_org_member_groups`, `update_org_member_groups`
- **Groups**: `list_org_groups`, `get_org_group`, `create_org_group`, `update_org_group`, `delete_org_group`, `get_org_group_members`, `update_org_group_members`
- **Policies**: `list_org_policies`, `get_org_policy`, `update_org_policy`
- **Events**: `get_org_events`
- **Subscriptions**: `get_org_subscription`, `update_org_subscription`
- **Import**: `import_org_users_and_groups`

## Development

### Setup

```bash
git clone https://github.com/bitwarden/mcp-server.git
cd mcp-server
npm install
```

### Commands

```bash
npm run build        # Compile TypeScript
npm test             # Run test suite
npm run lint         # Check code style
npm run lint:fix     # Auto-fix linting issues
npm run inspect      # Test with MCP Inspector
```

### Testing with MCP Inspector

The MCP Inspector provides an interactive testing environment:

```bash
npm run build
npm run inspect
```

This opens a web interface where you can:

- Browse available tools
- Test tool execution with custom inputs
- View request/response payloads
- Debug tool behavior

### Best Practices

- Store credentials securely (use system keychains or environment managers)
- Rotate session tokens regularly
- Review audit logs periodically for suspicious activity
- Never commit credentials to version control

### Testing

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

### Debugging

**Enable debug logging** by setting environment variables:

```bash
export DEBUG=bitwarden:*
export NODE_ENV=development
```

## Security Considerations

- **Never commit** sensitive credentials (`BW_SESSION`, `BW_CLIENT_ID`, `BW_CLIENT_SECRET`)
- **Use environment variables** for all sensitive configuration
- **Validate all inputs** using Zod schemas (already implemented)
- **Test with non-production data** when possible
- **Monitor API usage** through your organization's audit logs
- Understand the security and privacy impacts of exposing sensitive vault data to LLM and AI tools. Using a self-hosted or local LLM may be appropriate, for example.

## Troubleshooting

### CLI Issues

- **Vault is locked**

  ```bash
  bw unlock --raw
  # Copy the token and update BW_SESSION in your MCP config
  ```

- **Session key is invalid**
  - Session tokens expire after inactivity
  - Run `bw unlock --raw` to get a fresh token
  - Update your MCP configuration with the new token

### API Issues

- **Invalid client credentials**
  - Verify `BW_CLIENT_ID` starts with `organization.`
  - Ensure `BW_CLIENT_SECRET` is correct
  - Check that API keys haven't been rotated in the Admin Console

- **403 Forbidden**
  - Verify you have organization owner or admin permissions
  - Some operations require specific roles (e.g., managing members)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](https://contributing.bitwarden.com/) for guidelines.
