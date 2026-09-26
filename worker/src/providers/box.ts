/** Box adapter (Content API 2.0). */
import type { Env } from "../env";
import type { AuthorizeOptions, Connection, ListResult, ProviderAdapter, ProviderTokens, RemoteAccount, RemoteEntry } from "./types";
import { bearer, buildUrl, expiresInToIso, fetchJson, formBody, providerFetch, toIsoOrNull } from "./util";

const API = "https://api.box.com/2.0";
const UPLOAD = "https://upload.box.com/api/2.0";
const FIELDS = "id,name,size,modified_at,type,parent,shared_link";

interface BoxItem {
  id: string;
  name: string;
  type: "file" | "folder" | "web_link";
  size?: number;
  modified_at?: string;
  parent?: { id?: string } | null;
  shared_link?: { url?: string } | null;
}

const toEntry = (item: BoxItem): RemoteEntry => ({
  id: item.id,
  name: item.name,
  size: Number(item.size || 0),
  mimeType: null,
  isFolder: item.type === "folder",
  modifiedAt: toIsoOrNull(item.modified_at),
  webUrl: item.shared_link?.url || `https://app.box.com/${item.type === "folder" ? "folder" : "file"}/${item.id}`,
  parentId: item.parent?.id ?? null,
});

export const box: ProviderAdapter = {
  id: "box",
  name: "Box",
  kind: "oauth",
  rootId: "0",

  isConfigured: (env) => Boolean(env.BOX_CLIENT_ID && env.BOX_CLIENT_SECRET),
  missingConfigMessage: () => "Box is not configured. Add BOX_CLIENT_ID and BOX_CLIENT_SECRET as Worker secrets.",

  authorizeUrl(env: Env, options: AuthorizeOptions) {
    return buildUrl("https://account.box.com/api/oauth2/authorize", {
      client_id: env.BOX_CLIENT_ID!,
      response_type: "code",
      redirect_uri: options.redirectUri,
      state: options.state,
    });
  },

  async exchangeCode(env, code, redirectUri) {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number }>("https://api.box.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ code, grant_type: "authorization_code", client_id: env.BOX_CLIENT_ID, client_secret: env.BOX_CLIENT_SECRET, redirect_uri: redirectUri }),
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresInToIso(data.expires_in) };
  },

  async refreshTokens(env, refreshToken): Promise<ProviderTokens> {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number }>("https://api.box.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: env.BOX_CLIENT_ID, client_secret: env.BOX_CLIENT_SECRET }),
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken, expiresAt: expiresInToIso(data.expires_in) };
  },

  async getAccount(connection): Promise<RemoteAccount> {
    const me = await fetchJson<{ id: string; login?: string; name?: string; space_amount?: number; space_used?: number }>(
      `${API}/users/me?fields=id,login,name,space_amount,space_used`,
      { headers: bearer(connection.tokens.accessToken) },
    );
    return {
      accountId: me.id,
      email: me.login ?? null,
      displayName: me.name ?? null,
      totalSpace: me.space_amount ?? null,
      usedSpace: me.space_used ?? null,
      rootFolderId: "0",
    };
  },

  async list(connection, folderId, cursor): Promise<ListResult> {
    const offset = Number(cursor || 0);
    const data = await fetchJson<{ entries: BoxItem[]; total_count: number; limit: number; offset: number }>(
      buildUrl(`${API}/folders/${folderId || "0"}/items`, { fields: FIELDS, limit: 200, offset, sort: "name", direction: "ASC" }),
      { headers: bearer(connection.tokens.accessToken) },
    );
    const nextOffset = offset + (data.entries?.length || 0);
    return { entries: (data.entries || []).map(toEntry), nextCursor: nextOffset < (data.total_count || 0) ? String(nextOffset) : null };
  },

  async download(connection, fileId) {
    const meta = await fetchJson<BoxItem>(buildUrl(`${API}/files/${fileId}`, { fields: FIELDS }), { headers: bearer(connection.tokens.accessToken) });
    const response = await providerFetch(`${API}/files/${fileId}/content`, { headers: bearer(connection.tokens.accessToken), redirect: "follow" });
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") || "application/octet-stream",
        "x-cloudgather-filename": meta.name,
      },
    });
  },

  async upload(connection, parentId, name, body, size, mimeType) {
    const form = new FormData();
    form.set("attributes", JSON.stringify({ name, parent: { id: parentId || "0" } }));
    const blob = body instanceof Blob ? body : new Blob([body as ArrayBuffer], { type: mimeType || "application/octet-stream" });
    form.set("file", blob, name);
    const data = await fetchJson<{ entries: BoxItem[] }>(`${UPLOAD}/files/content`, {
      method: "POST",
      headers: bearer(connection.tokens.accessToken),
      body: form,
    });
    return toEntry({ ...data.entries[0], size });
  },

  async createFolder(connection, parentId, name) {
    const data = await fetchJson<BoxItem>(`${API}/folders`, {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name, parent: { id: parentId || "0" } }),
    });
    return toEntry(data);
  },

  async remove(connection, fileId, isFolder) {
    const url = isFolder ? `${API}/folders/${fileId}?recursive=true` : `${API}/files/${fileId}`;
    await providerFetch(url, { method: "DELETE", headers: bearer(connection.tokens.accessToken) });
  },

  async rename(connection, fileId, name, isFolder) {
    const data = await fetchJson<BoxItem>(`${API}/${isFolder ? "folders" : "files"}/${fileId}`, {
      method: "PUT",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return toEntry(data);
  },

  async move(connection, fileId, newParentId, isFolder) {
    const data = await fetchJson<BoxItem>(`${API}/${isFolder ? "folders" : "files"}/${fileId}`, {
      method: "PUT",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ parent: { id: newParentId || "0" } }),
    });
    return toEntry(data);
  },

  async search(connection, query) {
    const data = await fetchJson<{ entries: BoxItem[] }>(buildUrl(`${API}/search`, { query, limit: 100, fields: FIELDS }), {
      headers: bearer(connection.tokens.accessToken),
    });
    return { entries: (data.entries || []).filter((entry) => entry.type !== "web_link").map(toEntry), nextCursor: null };
  },

  async quota(connection) {
    const account = await box.getAccount(connection);
    return { total: account.totalSpace ?? null, used: account.usedSpace ?? null };
  },
};
