/**
 * OpenAI Apps SDK Response Adapter
 *
 * Converts standard MCP responses to OpenAI Apps SDK format.
 * OpenAI Apps SDK requires responses with:
 * - structuredContent: Model-visible structured data
 * - content: Text/markdown content (same as MCP)
 * - _meta: UI-only metadata (hidden from model)
 */

interface MCPResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface OpenAIResponse {
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text: string }>;
  _meta?: Record<string, unknown>;
}

/**
 * Converts MCP response format to OpenAI Apps SDK format
 *
 * @param mcpResponse - Standard MCP response with content and isError
 * @returns OpenAI-formatted response with structuredContent and _meta
 */
export function convertToOpenAIFormat(
  mcpResponse: MCPResponse,
): OpenAIResponse {
  const openaiResponse: OpenAIResponse = {
    content: mcpResponse.content,
  };

  // Add structured content if available
  // Try to parse JSON responses for structured data
  if (mcpResponse.content && mcpResponse.content.length > 0) {
    const firstContent = mcpResponse.content[0];
    if (!firstContent) {
      return openaiResponse;
    }
    const textContent = firstContent.text;

    // Attempt to parse JSON responses
    try {
      const parsed = JSON.parse(textContent);
      if (typeof parsed === 'object' && parsed !== null) {
        // If parsed is an array, wrap it in an object
        if (Array.isArray(parsed)) {
          openaiResponse.structuredContent = {
            items: parsed,
            count: parsed.length,
          };
        } else {
          openaiResponse.structuredContent = parsed;
        }
      }
    } catch {
      // Not JSON, leave as plain text
      // Could enhance this to extract structured data from text
    }
  }

  // Add metadata for OpenAI
  openaiResponse._meta = {
    'openai/locale': 'en-US',
    isError: mcpResponse.isError || false,
  };

  return openaiResponse;
}

/**
 * Type guard to check if response is an MCP response
 */
export function isMCPResponse(response: unknown): response is MCPResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'content' in response &&
    Array.isArray((response as MCPResponse).content)
  );
}
