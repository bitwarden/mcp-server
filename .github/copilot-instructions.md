# Bitwarden MCP Server Instructions

## Project overview

- **Technology**: TypeScript/Node.js
- **Framework**: Model Context Protocol SDK (@modelcontextprotocol/sdk)
- **Main functionality**: Provides tools to interact with the Bitwarden CLI

## Coding standards

When working with this codebase, follow these guidelines:

1. **Security First**: This code deals with password vault data -- never suggest code that could compromise security
2. **Error Handling**: All external calls (especially CLI commands) must have proper error handling
3. **Type Safety**: Use TypeScript's static typing features for maximum safety and clarity
4. **Clean Architecture**: Keep tool definitions separate from their implementations
5. **Linting**: All code must pass ESLint and Prettier checks before being committed -- run `npm run lint` to check code
6. **Documentation**: Use JSDoc comments for all public functions and classes to ensure clarity
7. **Version Control**: Use meaningful commit messages
8. **Unit Testing**: Write unit tests with Jest for all new features and ensure they pass before merging
9. **Environment Variables**: Use `.env` files for configuration and sensitive data, ensuring they are not committed to version control
10. **Code Reviews**: All code changes must go through a pull request and be reviewed by at least one other developer
11. **Dependency Management**: Keep dependencies up to date and use `npm audit` to check for vulnerabilities
12. **Performance**: Optimize for performance, especially in tools that interact with the Bitwarden CLI
13. **Logging**: Use structured logging for all operations, especially those that interact with the Bitwarden CLI
14. **Modular Design**: Keep tools modular and reusable, allowing for easy addition of new tools in the future
15. **Consistent Naming**: Use consistent naming conventions for variables, functions, and classes
16. **Avoid Hardcoding**: Do not hardcode sensitive information or configuration values; use environment variables instead
17. **Use of Promises**: Prefer using async/await syntax for asynchronous operations to improve readability

## Project structure

- `src/index.ts`: Main entry point defining MCP server setup and tool handlers
- Other source files should be organized by functionality

## Adding new tools

When adding new tools to the MCP server:

1. Define the tool object with proper name, description, and input schema
2. Add the tool to the list of tools returned by the ListTools handler
3. Implement the tool's logic in the CallTool handler
4. Add comprehensive error handling for the tool

Example of a tool definition:

```typescript
const newTool: Tool = {
  name: 'toolName',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of parameter 1',
      },
      // Add more parameters as needed
    },
    required: ['param1'], // List required parameters
  },
};
```

## Functional testing

Use the MCP inspector tool for testing your server implementation:

```
npm run inspect
```

## Security considerations

- Always validate user input
- Never expose sensitive information in logs or responses
- Use the Bitwarden CLI's security mechanisms properly
- Remember that the BW_SESSION environment variable must be set securely
