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
  card?: {
    cardholderName?: string;
    number?: string;
    brand?: string;
    expMonth?: string;
    expYear?: string;
    code?: string;
  };
  identity?: {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    company?: string;
    email?: string;
    phone?: string;
    ssn?: string;
    username?: string;
    passportNumber?: string;
    licenseNumber?: string;
  };
  secureNote?: {
    type?: number;
  };
}

export interface BitwardenFolder {
  readonly id?: string;
  name?: string;
}

export interface BitwardenSend {
  readonly id?: string;
  readonly accessId?: string;
  name?: string;
  notes?: string;
  type?: number; // 0: Text, 1: File
  text?: {
    text?: string;
    hidden?: boolean;
  };
  file?: {
    fileName?: string;
    size?: number;
    sizeName?: string;
  };
  password?: string;
  maxAccessCount?: number;
  accessCount?: number;
  revisionDate?: string;
  expirationDate?: string;
  deletionDate?: string;
  disabled?: boolean;
  hideEmail?: boolean;
}

// Payload for `bw send create`. The CLI passes these booleans straight to the
// SDK, which rejects missing values ("invalid type: unit value, expected a boolean").
interface BitwardenSendCreateBase {
  name: string;
  notes?: string;
  password?: string;
  maxAccessCount?: number;
  expirationDate?: string;
  deletionDate: string;
  disabled: boolean;
  hideEmail: boolean;
}

export interface BitwardenTextSendCreate extends BitwardenSendCreateBase {
  type: 0;
  text: {
    text: string;
    hidden: boolean;
  };
}

export interface BitwardenFileSendCreate extends BitwardenSendCreateBase {
  type: 1;
  // The CLI sets file.fileName itself from the --file path, but needs the object to exist.
  file: Record<string, never>;
}
