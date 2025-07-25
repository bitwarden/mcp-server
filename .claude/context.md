# Bitwarden MCP Server Context

## Input Validation Pattern

```typescript
const [isValid, validationResult] = validateInput(schema, input);
if (!isValid) {
  return validationResult; // Pre-formatted error response
}
// validationResult contains validated, typed data
```

## Base64 Pattern for Complex Data

Create/edit operations encode JSON data as base64:

```typescript
const itemJson = JSON.stringify(itemObject);
const itemBase64 = Buffer.from(itemJson, 'utf8').toString('base64');
const command = buildSafeCommand('create', ['item', itemBase64]);
```

## Error Response Format

All tool responses follow MCP standard:

```typescript
return {
  content: [{ type: 'text', text: result.output || result.errorOutput }],
  isError: result.errorOutput ? true : false,
};
```

## External Dependencies

- **Bitwarden CLI** (`bw`): Must be installed and authenticated on host system
- **MCP SDK**: Provides server framework and type definitions
- **Zod**: Schema validation library

## Package Configuration

ES module configuration with strict TypeScript in `package.json`
