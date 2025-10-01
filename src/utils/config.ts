/**
 * Configuration and constants for the Bitwarden MCP Server
 */

// API Configuration
export const API_BASE_URL =
  process.env['BW_API_BASE_URL'] || 'https://api.bitwarden.com';
export const IDENTITY_URL =
  process.env['BW_IDENTITY_URL'] || 'https://identity.bitwarden.com';
export const CLIENT_ID = process.env['BW_CLIENT_ID'];
export const CLIENT_SECRET = process.env['BW_CLIENT_SECRET'];
