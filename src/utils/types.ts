/**
 * Common types and interfaces used across the Bitwarden MCP Server
 */

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface CliResponse {
  output?: string;
  errorOutput?: string;
  // Support validation error format
  content?: readonly [{ readonly type: 'text'; readonly text: string }];
  isError?: boolean;
}

export interface ApiResponse {
  data?: unknown;
  errorOutput?: string;
  errorMessage?: string;
  status?: number;
  // Support validation error format
  content?: readonly [{ readonly type: 'text'; readonly text: string }];
  isError?: boolean;
}

export interface BitwardenItem {
  readonly id?: string;
  name?: string;
  notes?: string;
  type?: number;
  login?: {
    username?: string;
    password?: string;
    uris?: readonly {
      readonly uri: string;
      readonly match?: number | undefined;
    }[];
    totp?: string;
  };
}

export interface BitwardenFolder {
  readonly id?: string;
  name?: string;
}
