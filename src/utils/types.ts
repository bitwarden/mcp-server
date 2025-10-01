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
}

export interface ApiResponse {
  data?: unknown;
  errorMessage?: string;
  status?: number;
}

export interface BitwardenItem {
  readonly id?: string;
  name?: string;
  notes?: string;
  type?: number;
  folderId?: string;
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
