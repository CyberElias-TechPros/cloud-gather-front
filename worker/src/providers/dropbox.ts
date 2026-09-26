/** Dropbox adapter (API v2). Paths, not IDs, address content. */
import type { Env } from "../env";
import type { AuthorizeOptions, Connection, ListResult, ProviderAdapter, ProviderTokens, RemoteAccount, RemoteEntry } from "./types";
import { ProviderError } from "./types";
import { bearer, buildUrl, expiresInToIso, fetchJson, formBody, providerFetch, toIsoOrNull } from "./util";

const RPC = "https://api.dropboxapi.com/2";
const CONTENT = "https://content.dropboxapi.com/2";

interface DropboxEntry {
  ".tag": "file" | "folder" | "deleted";
  id: string;
  name: string;
  path_display?: string;
  path_lower?: string;
  size?: number;
  server_modified?: string;
  content_hash?: string;
}

const toEntry = (entry: DropboxEntry): RemoteEntry => ({
  id: entry.path_display || entry.path_lower || entry.id,
  name: entry.name,
  path: entry.path_display ?? null,
  size: Number(entry.size || 0),
  mimeType: null,
  isFolder: entry[".tag"] === "folder",
  modifiedAt: toIsoOrNull(entry.server_modified),
  webUrl: entry.path_display ? `https://www.dropbox.com/home${entry.path_display}` : null,
});

const rpc = <T>(connection: Connection, path: string, body: unknown) =>
  fetchJson<T>(`${RPC}${path}`, {
    method: "POST",
    headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const dropbox: ProviderAdapter = {
  id: "dropbox",
  name: "Dropbox",
  kind: "oauth",
  rootId: "",

  isConfigured: (env) => Boolean(env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET),
  missingConfigMessage: () => "Dropbox is not configured. Add DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET as Worker secrets.",

  authorizeUrl(env: Env, options: AuthorizeOptions) {
    return buildUrl("https://www.dropbox.com/oauth2/authorize", {
      client_id: env.DROPBOX_CLIENT_ID!,
      redirect_uri: options.redirectUri,
      response_type: "code",
      token_access_type: "offline",
      state: options.state,
    });
  },

  async exchangeCode(env, code, redirectUri) {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      "https://api.dropboxapi.com/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ code, grant_type: "authorization_code", client_id: env.DROPBOX_CLIENT_ID, client_secret: env.DROPBOX_CLIENT_SECRET, redirect_uri: redirectUri }),
      },
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresInToIso(data.expires_in), scopes: data.scope ?? null };
  },

  async refreshTokens(env, refreshToken): Promise<ProviderTokens> {
    const data = await fetchJson<{ access_token: string; expires_in?: number }>("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: env.DROPBOX_CLIENT_ID, client_secret: env.DROPBOX_CLIENT_SECRET }),
    });
    return { accessToken: data.access_token, refreshToken, expiresAt: expiresInToIso(data.expires_in) };
  },

  async getAccount(connection): Promise<RemoteAccount> {
    const account = await rpc<{ account_id: string; email?: string; name?: { display_name?: string } }>(connection, "/users/get_current_account", null);
    const usage = await rpc<{ used?: number; allocation?: { allocated?: number; individual?: { allocated?: number } } }>(
      connection,
      "/users/get_space_usage",
      null,
    );
    return {
      accountId: account.account_id,
      email: account.email ?? null,
      displayName: account.name?.display_name ?? null,
      usedSpace: Number(usage.used || 0),
      totalSpace: Number(usage.allocation?.allocated || usage.allocation?.individual?.allocated || 0) || null,
      rootFolderId: "",
    };
  },

  async list(connection, folderId, cursor): Promise<ListResult> {
    const data = cursor
      ? await rpc<{ entries: DropboxEntry[]; cursor?: string; has_more?: boolean }>(connection, "/files/list_folder/continue", { cursor })
      : await rpc<{ entries: DropboxEntry[]; cursor?: string; has_more?: boolean }>(connection, "/files/list_folder", {
          path: folderId || "",
          recursive: false,
          include_deleted: false,
          limit: 500,
        });
    return {
      entries: (data.entries || []).filter((entry) => entry[".tag"] !== "deleted").map(toEntry),
      nextCursor: data.has_more ? data.cursor ?? null : null,
    };
  },

  async download(connection, fileId) {
    const response = await providerFetch(`${CONTENT}/files/download`, {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "Dropbox-API-Arg": JSON.stringify({ path: fileId }) },
    });
    const meta = JSON.parse(response.headers.get("dropbox-api-result") || "{}") as DropboxEntry;
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") || "application/octet-stream",
        "x-cloudgather-filename": meta.name || fileId.split("/").pop() || "download",
      },
    });
  },

  async upload(connection, parentId, name, body, size) {
    if (size > 150 * 1024 * 1024) {
      throw new ProviderError("Dropbox single-request uploads are limited to 150 MB. Upload to CloudGather storage instead.", 413);
    }
    const path = `${(parentId || "").replace(/\/$/, "")}/${name}`;
    const response = await providerFetch(`${CONTENT}/files/upload`, {
      method: "POST",
      headers: {
        ...bearer(connection.tokens.accessToken),
        "content-type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true, mute: false }),
      },
      body: body as BodyInit,
    });
    return toEntry((await response.json()) as DropboxEntry);
  },

  async createFolder(connection, parentId, name) {
    const path = `${(parentId || "").replace(/\/$/, "")}/${name}`;
    const data = await rpc<{ metadata: DropboxEntry }>(connection, "/files/create_folder_v2", { path, autorename: false });
    return toEntry({ ...data.metadata, ".tag": "folder" });
  },

  async remove(connection, fileId) {
    await rpc(connection, "/files/delete_v2", { path: fileId });
  },

  async rename(connection, fileId, name) {
    const parent = fileId.slice(0, fileId.lastIndexOf("/"));
    const data = await rpc<{ metadata: DropboxEntry }>(connection, "/files/move_v2", { from_path: fileId, to_path: `${parent}/${name}`, autorename: true });
    return toEntry(data.metadata);
  },

  async move(connection, fileId, newParentId) {
    const name = fileId.split("/").pop() || fileId;
    const data = await rpc<{ metadata: DropboxEntry }>(connection, "/files/move_v2", {
      from_path: fileId,
      to_path: `${(newParentId || "").replace(/\/$/, "")}/${name}`,
      autorename: true,
    });
    return toEntry(data.metadata);
  },

  async search(connection, query) {
    const data = await rpc<{ matches?: { metadata?: { metadata?: DropboxEntry } }[] }>(connection, "/files/search_v2", {
      query,
      options: { max_results: 100, file_status: "active" },
    });
    const entries = (data.matches || [])
      .map((match) => match.metadata?.metadata)
      .filter((entry): entry is DropboxEntry => Boolean(entry))
      .map(toEntry);
    return { entries, nextCursor: null };
  },

  async quota(connection) {
    const account = await dropbox.getAccount(connection);
    return { total: account.totalSpace ?? null, used: account.usedSpace ?? null };
  },
};
