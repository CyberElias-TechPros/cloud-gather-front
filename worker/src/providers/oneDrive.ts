/** OneDrive / SharePoint adapter via Microsoft Graph. */
import type { Env } from "../env";
import type { AuthorizeOptions, Connection, ListResult, ProviderAdapter, ProviderTokens, RemoteAccount, RemoteEntry } from "./types";
import { bearer, buildUrl, expiresInToIso, fetchJson, formBody, providerFetch, toIsoOrNull } from "./util";

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = "offline_access openid email profile Files.ReadWrite.All User.Read";

const clientId = (env: Env) => env.ONEDRIVE_CLIENT_ID || env.MICROSOFT_CLIENT_ID;
const clientSecret = (env: Env) => env.ONEDRIVE_CLIENT_SECRET || env.MICROSOFT_CLIENT_SECRET;
const tenant = (env: Env) => env.ONEDRIVE_TENANT || env.MICROSOFT_TENANT || "common";

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  parentReference?: { id?: string; path?: string };
}

const toEntry = (item: DriveItem): RemoteEntry => ({
  id: item.id,
  name: item.name,
  path: item.parentReference?.path ? `${item.parentReference.path.replace("/drive/root:", "")}/${item.name}` : null,
  size: Number(item.size || 0),
  mimeType: item.file?.mimeType ?? null,
  isFolder: Boolean(item.folder),
  modifiedAt: toIsoOrNull(item.lastModifiedDateTime),
  webUrl: item.webUrl ?? null,
  parentId: item.parentReference?.id ?? null,
});

const itemPath = (folderId: string | null) => (folderId && folderId !== "root" ? `/me/drive/items/${folderId}` : "/me/drive/root");

export const oneDrive: ProviderAdapter = {
  id: "onedrive",
  name: "OneDrive",
  kind: "oauth",
  rootId: "root",

  isConfigured: (env) => Boolean(clientId(env) && clientSecret(env)),
  missingConfigMessage: () =>
    "OneDrive is not configured. Add ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET (or shared MICROSOFT_CLIENT_ID/SECRET) as Worker secrets.",

  authorizeUrl(env: Env, options: AuthorizeOptions) {
    return buildUrl(`https://login.microsoftonline.com/${tenant(env)}/oauth2/v2.0/authorize`, {
      client_id: clientId(env)!,
      response_type: "code",
      redirect_uri: options.redirectUri,
      response_mode: "query",
      scope: SCOPES,
      state: options.state,
      prompt: "select_account",
    });
  },

  async exchangeCode(env, code, redirectUri) {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      `https://login.microsoftonline.com/${tenant(env)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ code, client_id: clientId(env), client_secret: clientSecret(env), redirect_uri: redirectUri, grant_type: "authorization_code", scope: SCOPES }),
      },
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresInToIso(data.expires_in), scopes: data.scope ?? null };
  },

  async refreshTokens(env, refreshToken): Promise<ProviderTokens> {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      `https://login.microsoftonline.com/${tenant(env)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ refresh_token: refreshToken, client_id: clientId(env), client_secret: clientSecret(env), grant_type: "refresh_token", scope: SCOPES }),
      },
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken, expiresAt: expiresInToIso(data.expires_in) };
  },

  async getAccount(connection): Promise<RemoteAccount> {
    const me = await fetchJson<{ id: string; mail?: string; userPrincipalName?: string; displayName?: string }>(`${GRAPH}/me`, {
      headers: bearer(connection.tokens.accessToken),
    });
    const drive = await fetchJson<{ id: string; quota?: { total?: number; used?: number } }>(`${GRAPH}/me/drive`, {
      headers: bearer(connection.tokens.accessToken),
    });
    return {
      accountId: me.id,
      email: me.mail || me.userPrincipalName || null,
      displayName: me.displayName ?? null,
      totalSpace: drive.quota?.total ?? null,
      usedSpace: drive.quota?.used ?? null,
      rootFolderId: "root",
    };
  },

  async list(connection, folderId, cursor): Promise<ListResult> {
    const url = cursor || `${GRAPH}${itemPath(folderId)}/children?$top=200&$orderby=folder,name`;
    const data = await fetchJson<{ value: DriveItem[]; "@odata.nextLink"?: string }>(url, { headers: bearer(connection.tokens.accessToken) });
    return { entries: (data.value || []).map(toEntry), nextCursor: data["@odata.nextLink"] ?? null };
  },

  async download(connection, fileId) {
    const meta = await fetchJson<DriveItem>(`${GRAPH}/me/drive/items/${fileId}`, { headers: bearer(connection.tokens.accessToken) });
    const response = await providerFetch(`${GRAPH}/me/drive/items/${fileId}/content`, { headers: bearer(connection.tokens.accessToken) });
    return new Response(response.body, {
      headers: {
        "content-type": meta.file?.mimeType || response.headers.get("content-type") || "application/octet-stream",
        "x-cloudgather-filename": meta.name,
      },
    });
  },

  async upload(connection, parentId, name, body, size, mimeType) {
    const base = parentId && parentId !== "root" ? `${GRAPH}/me/drive/items/${parentId}:/${encodeURIComponent(name)}:` : `${GRAPH}/me/drive/root:/${encodeURIComponent(name)}:`;
    if (size <= 4 * 1024 * 1024) {
      const data = await fetchJson<DriveItem>(`${base}/content`, {
        method: "PUT",
        headers: { ...bearer(connection.tokens.accessToken), "content-type": mimeType || "application/octet-stream" },
        body: body as BodyInit,
      });
      return toEntry(data);
    }
    // Large files: resumable upload session, single PUT of the whole range.
    const session = await fetchJson<{ uploadUrl: string }>(`${base}/createUploadSession`, {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename", name } }),
    });
    const data = await fetchJson<DriveItem>(session.uploadUrl, {
      method: "PUT",
      headers: { "content-length": String(size), "content-range": `bytes 0-${size - 1}/${size}` },
      body: body as BodyInit,
    });
    return toEntry(data);
  },

  async createFolder(connection, parentId, name) {
    const data = await fetchJson<DriveItem>(`${GRAPH}${itemPath(parentId)}/children`, {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
    });
    return toEntry(data);
  },

  async remove(connection, fileId) {
    await providerFetch(`${GRAPH}/me/drive/items/${fileId}`, { method: "DELETE", headers: bearer(connection.tokens.accessToken) });
  },

  async rename(connection, fileId, name) {
    const data = await fetchJson<DriveItem>(`${GRAPH}/me/drive/items/${fileId}`, {
      method: "PATCH",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return toEntry(data);
  },

  async move(connection, fileId, newParentId) {
    const data = await fetchJson<DriveItem>(`${GRAPH}/me/drive/items/${fileId}`, {
      method: "PATCH",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ parentReference: { id: newParentId || "root" } }),
    });
    return toEntry(data);
  },

  async search(connection, query) {
    const data = await fetchJson<{ value: DriveItem[] }>(`${GRAPH}/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=100`, {
      headers: bearer(connection.tokens.accessToken),
    });
    return { entries: (data.value || []).map(toEntry), nextCursor: null };
  },

  async quota(connection) {
    const drive = await fetchJson<{ quota?: { total?: number; used?: number } }>(`${GRAPH}/me/drive`, {
      headers: bearer(connection.tokens.accessToken),
    });
    return { total: drive.quota?.total ?? null, used: drive.quota?.used ?? null };
  },
};
