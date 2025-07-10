# Bitwarden MCP Server

Model Context Protocol (MCP) server that enables interaction with the Bitwarden password manager vault via the MCP protocol. The server allows AI models to securely communicate with a user's Bitwarden vault through defined tool interfaces.

## Prerequisites

- Node.js 22
- Bitwarden CLI (`bw`) installed and authenticated
- Valid Bitwarden session token

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

The server provides the following Bitwarden CLI tools:

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

- **Never commit** the `BW_SESSION` token
- **Use environment variables** for sensitive configuration
- **Validate all inputs** using Zod schemas (already implemented)
- **Test with non-production data** when possible
- Understand the security and privacy impacts of exposing sensitive vault data to an LLM and AI tools. Using a self-hosted LLM may be appropriate, for example.

## Troubleshooting

### Common issues

1. **"Please set the BW_SESSION environment variable"**

   - Run: `export BW_SESSION=$(bw unlock --raw)`

2. **Tests failing with environment errors**

   - Use the environment mocking helpers in tests
   - Ensure test cleanup with `restoreEnvVars()`

3. **Inspector not starting**

   - Check that the server builds successfully: `npm run build`
   - Verify Node.js version is 22

4. **CLI commands failing**
   - Verify Bitwarden CLI is installed: `bw --version`
   - Check vault is unlocked: `bw status`
   - Ensure valid session token: `echo $BW_SESSION`
