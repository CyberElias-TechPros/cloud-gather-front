/** Contract every storage-provider adapter implements. */
import type { Env } from "../env";

export type ProviderKind = "oauth" | "credentials";

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string | null;
  /** ISO timestamp. */
  expiresAt?: string | null;
  scopes?: string | null;
}

export interface RemoteAccount {
  accountId: string;
  email?: string | null;
  displayName?: string | null;
  totalSpace?: number | null;
  usedSpace?: number | null;
  rootFolderId?: string | null;
}

export interface RemoteEntry {
  id: string;
  name: string;
  path?: string | null;
  size: number;
  mimeType?: string | null;
  isFolder: boolean;
  modifiedAt?: string | null;
  webUrl?: string | null;
  parentId?: string | null;
}

export interface ListResult {
  entries: RemoteEntry[];
  nextCursor?: string | null;
}

/** A live, decrypted connection to one user's provider account. */
export interface Connection {
  env: Env;
  /** storage_providers.id */
  id: string;
  providerId: string;
  tokens: ProviderTokens;
  config: Record<string, unknown>;
  rootFolderId?: string | null;
}

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface AuthorizeOptions {
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  loginHint?: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Root folder identifier used when the caller passes no folder. */
  rootId: string;
  credentialFields?: CredentialField[];
  isConfigured(env: Env): boolean;
  missingConfigMessage(): string;

  authorizeUrl?(env: Env, options: AuthorizeOptions): string;
  exchangeCode?(env: Env, code: string, redirectUri: string, codeVerifier?: string): Promise<ProviderTokens>;
  refreshTokens?(env: Env, refreshToken: string): Promise<ProviderTokens>;
  /** Validates pasted credentials and returns the config blob to persist. */
  connectWithCredentials?(env: Env, values: Record<string, string>): Promise<{ tokens: ProviderTokens; config: Record<string, unknown> }>;

  getAccount(connection: Connection): Promise<RemoteAccount>;
  list(connection: Connection, folderId: string | null, cursor?: string | null): Promise<ListResult>;
  download(connection: Connection, fileId: string): Promise<Response>;
  upload(connection: Connection, parentId: string | null, name: string, body: ReadableStream | ArrayBuffer | Blob, size: number, mimeType: string): Promise<RemoteEntry>;
  createFolder(connection: Connection, parentId: string | null, name: string): Promise<RemoteEntry>;
  remove(connection: Connection, fileId: string, isFolder: boolean): Promise<void>;
  rename(connection: Connection, fileId: string, name: string, isFolder: boolean): Promise<RemoteEntry>;
  move?(connection: Connection, fileId: string, newParentId: string, isFolder: boolean): Promise<RemoteEntry>;
  search(connection: Connection, query: string): Promise<ListResult>;
  quota(connection: Connection): Promise<{ total: number | null; used: number | null }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryable = false,
    public reauthorize = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
