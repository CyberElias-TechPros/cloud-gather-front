/**
 * Per-provider adapters for OAuth-connected storage.
 *
 * Each adapter implements the same three verbs — `account`, `list`, `download` —
 * against the provider's public REST API. Adapters only exist where the provider
 * publishes a stable HTTP API; there is no simulated data anywhere in this file.
 * A provider without an adapter is still connectable and shows quota from its
 * token endpoint, but remote browsing returns `supported: false` so the UI can
 * say so honestly instead of showing a spinner forever.
 */

import { listObjects, presignGet, type S3Connection } from "./s3";

export interface ProviderAccount {
  email: string | null;
  displayName: string | null;
  totalSpace: number | null;
  usedSpace: number | null;
}

export interface RemoteEntry {
  id: string;
  name: string;
  size: number;
  isFolder: boolean;
  mimeType: string | null;
  updatedAt: string | null;
}

export interface ProviderAdapter {
  supported: boolean;
  account?: (accessToken: string) => Promise<ProviderAccount>;
  list?: (accessToken: string, folderId: string | null) => Promise<{ entries: RemoteEntry[]; nextPageToken: string | null }>;
  download?: (accessToken: string, fileId: string) => Promise<Response>;
}

const json = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return response.json();
};

const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const ADAPTERS: Record<string, ProviderAdapter> = {
  "google-drive": {
    supported: true,
    async account(accessToken) {
      const [about, profile] = await Promise.all([
        fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota,user", {
          headers: { authorization: `Bearer ${accessToken}` },
        }).then(json),
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { authorization: `Bearer ${accessToken}` },
        }).then(json).catch(() => null),
      ]);
      return {
        email: about?.user?.emailAddress ?? profile?.email ?? null,
        displayName: about?.user?.displayName ?? profile?.name ?? null,
        totalSpace: about?.storageQuota?.limit ? Number(about.storageQuota.limit) : null,
        usedSpace: about?.storageQuota?.usage ? Number(about.storageQuota.usage) : null,
      };
    },
    async list(accessToken, folderId) {
      const params = new URLSearchParams({
        fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
        pageSize: "200",
        q: folderId ? `'${folderId}' in parents and trashed = false` : "'root' in parents and trashed = false",
      });
      const data = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json);
      return {
        entries: (data.files ?? []).map((file: any) => ({
          id: file.id,
          name: file.name,
          size: Number(file.size ?? 0),
          isFolder: file.mimeType === GOOGLE_FOLDER_MIME,
          mimeType: GOOGLE_EXPORT[file.mimeType] ?? file.mimeType ?? null,
          updatedAt: file.modifiedTime ?? null,
        })),
        nextPageToken: data.nextPageToken ?? null,
      };
    },
    async download(accessToken, fileId) {
      // Native Google docs are exported; binary files stream with alt=media.
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json);
      if (GOOGLE_EXPORT[meta.mimeType]) {
        return fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(GOOGLE_EXPORT[meta.mimeType])}`,
          { headers: { authorization: `Bearer ${accessToken}` } },
        );
      }
      return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    },
  },

  dropbox: {
    supported: true,
    async account(accessToken) {
      const data = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json);
      const usage = await fetch("https://api.dropboxapi.com/2/users/get_space_usage", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json).catch(() => null);
      return {
        email: data?.email ?? null,
        displayName: data?.name?.display_name ?? null,
        totalSpace: usage?.allocation?.allocated ?? null,
        usedSpace: usage?.used ?? null,
      };
    },
    async list(accessToken, folderId) {
      const data = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ path: folderId ?? "", limit: 200 }),
      }).then(json);
      return {
        entries: (data.entries ?? []).map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          size: Number(entry.size ?? 0),
          isFolder: entry[".tag"] === "folder",
          mimeType: null,
          updatedAt: entry.server_modified ?? null,
        })),
        nextPageToken: data.has_more ? data.cursor : null,
      };
    },
    async download(accessToken, fileId) {
      return fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path: fileId }),
        },
      });
    },
  },

  onedrive: {
    supported: true,
    async account(accessToken) {
      const [me, drive] = await Promise.all([
        fetch("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${accessToken}` } }).then(json),
        fetch("https://graph.microsoft.com/v1.0/me/drive", { headers: { authorization: `Bearer ${accessToken}` } }).then(json).catch(() => null),
      ]);
      return {
        email: me?.mail ?? me?.userPrincipalName ?? null,
        displayName: me?.displayName ?? null,
        totalSpace: drive?.quota?.total ?? null,
        usedSpace: drive?.quota?.used ?? null,
      };
    },
    async list(accessToken, folderId) {
      const url = folderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$top=200`
        : "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200";
      const data = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } }).then(json);
      return {
        entries: (data.value ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
          size: Number(item.size ?? 0),
          isFolder: Boolean(item.folder),
          mimeType: item.file?.mimeType ?? null,
          updatedAt: item.lastModifiedDateTime ?? null,
        })),
        nextPageToken: data["@odata.nextLink"] ?? null,
      };
    },
    async download(accessToken, fileId) {
      return fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    },
  },

  box: {
    supported: true,
    async account(accessToken) {
      const me = await fetch("https://api.box.com/2.0/users/me?fields=name,login,space_amount,space_used", {
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json);
      return {
        email: me?.login ?? null,
        displayName: me?.name ?? null,
        totalSpace: me?.space_amount ?? null,
        usedSpace: me?.space_used ?? null,
      };
    },
    async list(accessToken, folderId) {
      const id = folderId ?? "0";
      const data = await fetch(`https://api.box.com/2.0/folders/${id}/items?limit=200&fields=id,name,type,size,modified_at`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }).then(json);
      return {
        entries: (data.entries ?? []).map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          size: Number(entry.size ?? 0),
          isFolder: entry.type === "folder",
          mimeType: null,
          updatedAt: entry.modified_at ?? null,
        })),
        nextPageToken: null,
      };
    },
    async download(accessToken, fileId) {
      return fetch(`https://api.box.com/2.0/files/${fileId}/content`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    },
  },

  pcloud: {
    supported: true,
    async account(accessToken) {
      const data = await fetch(`https://api.pcloud.com/userinfo?access_token=${encodeURIComponent(accessToken)}`).then(json);
      return {
        email: data?.email ?? null,
        displayName: data?.email ?? null,
        totalSpace: data?.quota ?? null,
        usedSpace: data?.usedquota ?? null,
      };
    },
  },

  "yandex-disk": {
    supported: true,
    async account(accessToken) {
      const data = await fetch("https://cloud-api.yandex.net/v1/disk/", {
        headers: { authorization: `OAuth ${accessToken}` },
      }).then(json);
      return {
        email: data?.user?.email ?? null,
        displayName: data?.user?.display_name ?? null,
        totalSpace: data?.total_space ?? null,
        usedSpace: data?.used_space ?? null,
      };
    },
  },

  mega: { supported: false },
  icedrive: { supported: false },
  sync: { supported: false },
  "amazon-s3": { supported: true },
  backblaze: { supported: true },
  cloudgather: { supported: true },
};

/**
 * S3-compatible providers are handled through the signature-V4 client instead of
 * an OAuth token, so they get their own entry point.
 */
export async function s3List(connection: S3Connection, prefix?: string) {
  const { objects, nextToken } = await listObjects(connection, {
    prefix,
    delimiter: "/",
    maxKeys: 500,
  });
  return {
    entries: objects.map((object) => ({
      id: object.id,
      name: object.name,
      size: object.size,
      isFolder: object.isFolder,
      mimeType: object.mimeType,
      updatedAt: object.updatedAt,
    })),
    nextPageToken: nextToken,
  };
}

export async function s3DownloadUrl(connection: S3Connection, key: string) {
  return presignGet(connection, key);
}

export function hasAdapter(provider: string): boolean {
  return ADAPTERS[provider]?.supported === true;
}
