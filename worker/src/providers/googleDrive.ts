/** Google Drive adapter (Drive v3). */
import type { Env } from "../env";
import type { AuthorizeOptions, Connection, ListResult, ProviderAdapter, ProviderTokens, RemoteAccount, RemoteEntry } from "./types";
import { ProviderError } from "./types";
import { bearer, buildUrl, expiresInToIso, fetchJson, formBody, providerFetch, toIsoOrNull } from "./util";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,parents";

const clientId = (env: Env) => env.GOOGLE_DRIVE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
const clientSecret = (env: Env) => env.GOOGLE_DRIVE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

const toEntry = (file: DriveFile): RemoteEntry => ({
  id: file.id,
  name: file.name,
  size: Number(file.size || 0),
  mimeType: file.mimeType || null,
  isFolder: file.mimeType === FOLDER_MIME,
  modifiedAt: toIsoOrNull(file.modifiedTime),
  webUrl: file.webViewLink || null,
  parentId: file.parents?.[0] || null,
});

/** Google Workspace documents need an export format instead of a raw download. */
const EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: ".pptx",
  },
  "application/vnd.google-apps.drawing": { mime: "image/png", ext: ".png" },
};

export const googleDrive: ProviderAdapter = {
  id: "google-drive",
  name: "Google Drive",
  kind: "oauth",
  rootId: "root",

  isConfigured: (env) => Boolean(clientId(env) && clientSecret(env)),
  missingConfigMessage: () =>
    "Google Drive is not configured. Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET (or the shared GOOGLE_CLIENT_ID/SECRET) as Worker secrets.",

  authorizeUrl(env: Env, options: AuthorizeOptions) {
    return buildUrl("https://accounts.google.com/o/oauth2/v2/auth", {
      client_id: clientId(env)!,
      redirect_uri: options.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive openid email profile",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: options.state,
      login_hint: options.loginHint,
    });
  },

  async exchangeCode(env, code, redirectUri) {
    const data = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ code, client_id: clientId(env), client_secret: clientSecret(env), redirect_uri: redirectUri, grant_type: "authorization_code" }),
      },
    );
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresInToIso(data.expires_in), scopes: data.scope ?? null };
  },

  async refreshTokens(env, refreshToken): Promise<ProviderTokens> {
    const data = await fetchJson<{ access_token: string; expires_in?: number; scope?: string }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ refresh_token: refreshToken, client_id: clientId(env), client_secret: clientSecret(env), grant_type: "refresh_token" }),
    });
    return { accessToken: data.access_token, refreshToken, expiresAt: expiresInToIso(data.expires_in), scopes: data.scope ?? null };
  },

  async getAccount(connection): Promise<RemoteAccount> {
    const data = await fetchJson<{
      user?: { emailAddress?: string; displayName?: string; permissionId?: string };
      storageQuota?: { limit?: string; usage?: string };
    }>(`${API}/about?fields=user,storageQuota`, { headers: bearer(connection.tokens.accessToken) });
    return {
      accountId: data.user?.permissionId || data.user?.emailAddress || "google-drive",
      email: data.user?.emailAddress ?? null,
      displayName: data.user?.displayName ?? null,
      totalSpace: data.storageQuota?.limit ? Number(data.storageQuota.limit) : null,
      usedSpace: data.storageQuota?.usage ? Number(data.storageQuota.usage) : null,
      rootFolderId: "root",
    };
  },

  async list(connection, folderId, cursor): Promise<ListResult> {
    const parent = folderId || "root";
    const data = await fetchJson<{ files?: DriveFile[]; nextPageToken?: string }>(
      buildUrl(`${API}/files`, {
        q: `'${parent.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: `nextPageToken,files(${FIELDS})`,
        pageSize: 200,
        pageToken: cursor || undefined,
        orderBy: "folder,name_natural",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
      { headers: bearer(connection.tokens.accessToken) },
    );
    return { entries: (data.files || []).map(toEntry), nextCursor: data.nextPageToken ?? null };
  },

  async download(connection, fileId) {
    const meta = await fetchJson<DriveFile>(buildUrl(`${API}/files/${fileId}`, { fields: "id,name,mimeType,size" }), {
      headers: bearer(connection.tokens.accessToken),
    });
    const exportFormat = meta.mimeType ? EXPORT_MAP[meta.mimeType] : undefined;
    if (exportFormat) {
      const response = await providerFetch(buildUrl(`${API}/files/${fileId}/export`, { mimeType: exportFormat.mime }), {
        headers: bearer(connection.tokens.accessToken),
      });
      return new Response(response.body, {
        headers: { "content-type": exportFormat.mime, "x-cloudgather-filename": `${meta.name}${exportFormat.ext}` },
      });
    }
    const response = await providerFetch(buildUrl(`${API}/files/${fileId}`, { alt: "media", supportsAllDrives: true }), {
      headers: bearer(connection.tokens.accessToken),
    });
    return new Response(response.body, {
      headers: {
        "content-type": meta.mimeType || "application/octet-stream",
        ...(meta.size ? { "content-length": meta.size } : {}),
        "x-cloudgather-filename": meta.name,
      },
    });
  },

  async upload(connection, parentId, name, body, size, mimeType) {
    const boundary = `cg${crypto.randomUUID().replace(/-/g, "")}`;
    const metadata = JSON.stringify({ name, parents: [parentId || "root"] });
    const payload = body instanceof ArrayBuffer ? new Uint8Array(body) : body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : null;
    if (!payload) throw new ProviderError("Google Drive uploads require a buffered body.", 400);

    const head = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
    );
    const tail = new TextEncoder().encode(`\r\n--${boundary}--`);
    const buffer = new Uint8Array(head.length + payload.length + tail.length);
    buffer.set(head, 0);
    buffer.set(payload, head.length);
    buffer.set(tail, head.length + payload.length);

    const data = await fetchJson<DriveFile>(buildUrl(`${UPLOAD}/files`, { uploadType: "multipart", fields: FIELDS, supportsAllDrives: true }), {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": `multipart/related; boundary=${boundary}` },
      body: buffer,
    });
    return toEntry({ ...data, size: String(size) });
  },

  async createFolder(connection, parentId, name) {
    const data = await fetchJson<DriveFile>(buildUrl(`${API}/files`, { fields: FIELDS, supportsAllDrives: true }), {
      method: "POST",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId || "root"] }),
    });
    return toEntry(data);
  },

  async remove(connection, fileId) {
    await providerFetch(buildUrl(`${API}/files/${fileId}`, { supportsAllDrives: true }), {
      method: "DELETE",
      headers: bearer(connection.tokens.accessToken),
    });
  },

  async rename(connection, fileId, name) {
    const data = await fetchJson<DriveFile>(buildUrl(`${API}/files/${fileId}`, { fields: FIELDS, supportsAllDrives: true }), {
      method: "PATCH",
      headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return toEntry(data);
  },

  async move(connection, fileId, newParentId) {
    const current = await fetchJson<DriveFile>(buildUrl(`${API}/files/${fileId}`, { fields: "parents" }), {
      headers: bearer(connection.tokens.accessToken),
    });
    const data = await fetchJson<DriveFile>(
      buildUrl(`${API}/files/${fileId}`, {
        fields: FIELDS,
        addParents: newParentId || "root",
        removeParents: (current.parents || []).join(","),
        supportsAllDrives: true,
      }),
      { method: "PATCH", headers: { ...bearer(connection.tokens.accessToken), "content-type": "application/json" }, body: "{}" },
    );
    return toEntry(data);
  },

  async search(connection, query) {
    const escaped = query.replace(/['\\]/g, "\\$&");
    const data = await fetchJson<{ files?: DriveFile[]; nextPageToken?: string }>(
      buildUrl(`${API}/files`, {
        q: `name contains '${escaped}' and trashed = false`,
        fields: `nextPageToken,files(${FIELDS})`,
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
      { headers: bearer(connection.tokens.accessToken) },
    );
    return { entries: (data.files || []).map(toEntry), nextCursor: data.nextPageToken ?? null };
  },

  async quota(connection) {
    const account = await googleDrive.getAccount(connection);
    return { total: account.totalSpace ?? null, used: account.usedSpace ?? null };
  },
};
