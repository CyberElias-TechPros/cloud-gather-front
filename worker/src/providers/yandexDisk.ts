/** Yandex Disk adapter — connects with a user-supplied OAuth token. */
import type { Connection, CredentialField, ListResult, ProviderAdapter, RemoteAccount, RemoteEntry } from "./types";
import { ProviderError } from "./types";
import { buildUrl, fetchJson, providerFetch, toIsoOrNull } from "./util";

const API = "https://cloud-api.yandex.net/v1/disk";

interface YandexResource {
  name: string;
  path: string;
  type: "dir" | "file";
  size?: number;
  mime_type?: string;
  modified?: string;
  public_url?: string;
}

const auth = (connection: Connection) => ({ authorization: `OAuth ${connection.tokens.accessToken}` });
const normalize = (path: string | null | undefined) => {
  const value = (path || "disk:/").replace(/^disk:/, "");
  return `disk:${value.startsWith("/") ? value : `/${value}`}`;
};

const toEntry = (resource: YandexResource): RemoteEntry => ({
  id: resource.path,
  name: resource.name,
  path: resource.path.replace(/^disk:/, ""),
  size: Number(resource.size || 0),
  mimeType: resource.mime_type ?? null,
  isFolder: resource.type === "dir",
  modifiedAt: toIsoOrNull(resource.modified),
  webUrl: resource.public_url ?? null,
});

const CREDENTIAL_FIELDS: CredentialField[] = [
  {
    key: "oauthToken",
    label: "OAuth token",
    type: "password",
    required: true,
    helpText: "Create a token at oauth.yandex.com with cloud_api:disk.* scopes.",
  },
];

export const yandexDisk: ProviderAdapter = {
  id: "yandex-disk",
  name: "Yandex Disk",
  kind: "credentials",
  rootId: "disk:/",
  credentialFields: CREDENTIAL_FIELDS,

  isConfigured: () => true,
  missingConfigMessage: () => "Yandex Disk requires a personal OAuth token.",

  async connectWithCredentials(_env, values) {
    const token = (values.oauthToken || "").trim();
    if (!token) throw new ProviderError("An OAuth token is required.", 400);
    await fetchJson(`${API}`, { headers: { authorization: `OAuth ${token}` } });
    return { tokens: { accessToken: token }, config: {} };
  },

  async getAccount(connection): Promise<RemoteAccount> {
    const data = await fetchJson<{ total_space?: number; used_space?: number; user?: { login?: string; display_name?: string; uid?: string } }>(API, {
      headers: auth(connection),
    });
    return {
      accountId: data.user?.uid || data.user?.login || "yandex",
      email: data.user?.login ?? null,
      displayName: data.user?.display_name ?? null,
      totalSpace: data.total_space ?? null,
      usedSpace: data.used_space ?? null,
      rootFolderId: "disk:/",
    };
  },

  async list(connection, folderId, cursor): Promise<ListResult> {
    const offset = Number(cursor || 0);
    const data = await fetchJson<{ _embedded?: { items: YandexResource[]; total: number; limit: number; offset: number } }>(
      buildUrl(`${API}/resources`, { path: normalize(folderId), limit: 200, offset, sort: "name" }),
      { headers: auth(connection) },
    );
    const items = data._embedded?.items || [];
    const next = offset + items.length;
    return { entries: items.map(toEntry), nextCursor: next < (data._embedded?.total || 0) ? String(next) : null };
  },

  async download(connection, fileId) {
    const link = await fetchJson<{ href: string }>(buildUrl(`${API}/resources/download`, { path: normalize(fileId) }), { headers: auth(connection) });
    const response = await providerFetch(link.href);
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") || "application/octet-stream",
        "x-cloudgather-filename": fileId.split("/").pop() || "download",
      },
    });
  },

  async upload(connection, parentId, name, body, size, mimeType) {
    const path = `${normalize(parentId).replace(/\/$/, "")}/${name}`;
    const link = await fetchJson<{ href: string }>(buildUrl(`${API}/resources/upload`, { path, overwrite: "true" }), { headers: auth(connection) });
    await providerFetch(link.href, { method: "PUT", body: body as BodyInit });
    return { id: path, name, path: path.replace(/^disk:/, ""), size, mimeType: mimeType || null, isFolder: false, modifiedAt: new Date().toISOString() };
  },

  async createFolder(connection, parentId, name) {
    const path = `${normalize(parentId).replace(/\/$/, "")}/${name}`;
    await fetchJson(buildUrl(`${API}/resources`, { path }), { method: "PUT", headers: auth(connection) });
    return { id: path, name, path: path.replace(/^disk:/, ""), size: 0, isFolder: true, mimeType: null, modifiedAt: new Date().toISOString() };
  },

  async remove(connection, fileId) {
    await providerFetch(buildUrl(`${API}/resources`, { path: normalize(fileId), permanently: "false" }), {
      method: "DELETE",
      headers: auth(connection),
    });
  },

  async rename(connection, fileId, name, isFolder) {
    const path = normalize(fileId);
    const parent = path.slice(0, path.lastIndexOf("/"));
    const target = `${parent}/${name}`;
    await fetchJson(buildUrl(`${API}/resources/move`, { from: path, path: target, overwrite: "false" }), { method: "POST", headers: auth(connection) });
    return { id: target, name, path: target.replace(/^disk:/, ""), size: 0, isFolder, mimeType: null, modifiedAt: new Date().toISOString() };
  },

  async move(connection, fileId, newParentId, isFolder) {
    const name = fileId.split("/").pop() || fileId;
    const target = `${normalize(newParentId).replace(/\/$/, "")}/${name}`;
    await fetchJson(buildUrl(`${API}/resources/move`, { from: normalize(fileId), path: target, overwrite: "false" }), {
      method: "POST",
      headers: auth(connection),
    });
    return { id: target, name, path: target.replace(/^disk:/, ""), size: 0, isFolder, mimeType: null, modifiedAt: new Date().toISOString() };
  },

  async search(connection, query) {
    const data = await fetchJson<{ items?: YandexResource[] }>(buildUrl(`${API}/resources/files`, { limit: 200, media_type: "" }), {
      headers: auth(connection),
    });
    const needle = query.toLowerCase();
    return { entries: (data.items || []).filter((item) => item.name.toLowerCase().includes(needle)).map(toEntry), nextCursor: null };
  },

  async quota(connection) {
    const account = await yandexDisk.getAccount(connection);
    return { total: account.totalSpace ?? null, used: account.usedSpace ?? null };
  },
};
