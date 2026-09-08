import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { FileItem } from "@/types/file";
import { getProviderName } from "@/lib/providers";

/**
 * Data-access layer for the user's unified file workspace.
 *
 * All operations run against Supabase with RLS enforcing ownership; the
 * explicit `.eq("user_id", …)` guards below are defense-in-depth (they make
 * intent obvious and protect against RLS misconfiguration).
 */

export type SortBy = "name" | "date" | "size";
export type SortDirection = "asc" | "desc";

export interface ActivityEvent {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

function orderClause(query: ReturnType<typeof supabase.from>, sortBy: SortBy, direction: SortDirection) {
  const column = sortBy === "name" ? "filename" : sortBy === "date" ? "updated_at" : "size";
  return query.order(column, { ascending: direction === "asc" }).order("filename", { ascending: true });
}

/** List a folder's contents (root when parentFolderId is null). */
export async function listFiles(
  parentFolderId: string | null = null,
  sortBy: SortBy = "date",
  direction: SortDirection = "desc"
): Promise<FileItem[]> {
  let query = supabase.from("files").select("*");
  query =
    parentFolderId === null
      ? query.is("parent_folder_id", null)
      : query.eq("parent_folder_id", parentFolderId);
  const { data, error } = await orderClause(query, sortBy, direction);
  if (error) throw new Error(`Could not load files: ${error.message}`);
  return (data ?? []) as FileItem[];
}

/** List every file (flat) — used by Recents / Storage breakdowns. */
export async function listAllFiles(
  sortBy: SortBy = "date",
  direction: SortDirection = "desc"
): Promise<FileItem[]> {
  const { data, error } = await orderClause(supabase.from("files").select("*"), sortBy, direction);
  if (error) throw new Error(`Could not load files: ${error.message}`);
  return (data ?? []) as FileItem[];
}

/** Build the chain of ancestor folders for breadcrumbs. */
export async function getFolderPath(folderId: string): Promise<FileItem[]> {
  const chain: FileItem[] = [];
  let currentId: string | null = folderId;
  for (let depth = 0; depth < 16 && currentId; depth++) {
    const { data, error } = await supabase
      .from("files")
      .select("id, filename, parent_folder_id, is_folder")
      .eq("id", currentId)
      .maybeSingle();
    if (error || !data) break;
    chain.unshift(data as unknown as FileItem);
    currentId = data.parent_folder_id;
  }
  return chain;
}

/** Create a folder. Returns the new record. Throws with a friendly message. */
export async function createFolder(name: string, parentFolderId: string | null = null): Promise<FileItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required.");
  if (trimmed.length > 255) throw new Error("Folder name is too long (max 255 characters).");
  if (/[/\\]/.test(trimmed)) throw new Error("Folder names cannot contain slashes.");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");

  // Compute a full path so listing/search stays consistent.
  let path = `/${trimmed}`;
  if (parentFolderId) {
    const ancestors = await getFolderPath(parentFolderId);
    const parent = ancestors[ancestors.length - 1];
    if (parent) path = `${parent.path}/${trimmed}`.replace(/\/{2,}/g, "/");
  }

  const { data, error } = await supabase
    .from("files")
    .insert({
      filename: trimmed,
      path,
      is_folder: true,
      parent_folder_id: parentFolderId,
      size: 0,
      user_id: userData.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("An item with this name already exists here.");
    throw new Error(`Could not create folder: ${error.message}`);
  }
  return data as unknown as FileItem;
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // must match the storage bucket limit

export interface UploadProgress {
  fileName: string;
  percent: number;
}

/**
 * Upload a file into CloudGather storage (private bucket) and catalogue it.
 * The upload uses XMLHttpRequest (instead of fetch) purely to get real
 * upload-progress events.
 */
export function uploadFile(
  file: File,
  parentFolderId: string | null = null,
  onProgress?: (progress: UploadProgress) => void
): Promise<FileItem> {
  return new Promise<FileItem>((resolve, reject) => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        reject(new Error("You need to sign in first."));
        return;
      }
      if (file.size === 0) {
        reject(new Error(`"${file.name}" is empty.`));
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        reject(new Error(`"${file.name}" is larger than the 100 MB limit.`));
        return;
      }

      onProgress?.({ fileName: file.name, percent: 2 });

      const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[/\\]/g, "_")}`;
      const bucket = supabase.storage.from("user_uploads");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${supabaseUrl}/storage/v1/object/user_uploads/${encodeURIComponent(storagePath)}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);

      let storageDone = false;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          // Reserve 2% for setup and 15% for the DB record.
          const percent = 2 + Math.round((event.loaded / event.total) * 83);
          onProgress?.({ fileName: file.name, percent });
        }
      };

      const cleanup = () => {
        if (storageDone) void bucket.remove([storagePath]);
      };

      xhr.onload = async () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let message = `Upload failed (${xhr.status})`;
          try {
            const payload = JSON.parse(xhr.responseText);
            if (payload.message) message = payload.message;
            if (payload.error && payload.error.includes("exceeded the maximum allowed size")) {
              message = `"${file.name}" is larger than the 100 MB limit.`;
            }
          } catch {
            /* keep default message */
          }
          reject(new Error(message));
          return;
        }
        storageDone = true;
        onProgress?.({ fileName: file.name, percent: 88 });

        try {
          // Full path mirrors the folder structure for consistency.
          let path = `/${file.name}`;
          if (parentFolderId) {
            const ancestors = await getFolderPath(parentFolderId);
            const parent = ancestors[ancestors.length - 1];
            if (parent) path = `${parent.path}/${file.name}`.replace(/\/{2,}/g, "/");
          }

          const { data, error } = await supabase
            .from("files")
            .insert({
              filename: file.name,
              size: file.size,
              mime_type: file.type || null,
              path,
              parent_folder_id: parentFolderId,
              provider_file_id: storagePath,
              user_id: user.id,
            })
            .select()
            .single();

          if (error) {
            cleanup();
            reject(new Error(error.code === "23505" ? "An item with this name already exists here." : `Could not save ${file.name}: ${error.message}`));
            return;
          }
          onProgress?.({ fileName: file.name, percent: 100 });
          resolve(data as unknown as FileItem);
        } catch (err) {
          cleanup();
          reject(err as Error);
        }
      };

      xhr.onerror = () => reject(new Error(`Network error while uploading "${file.name}".`));
      xhr.onabort = () => reject(new Error(`Upload of "${file.name}" cancelled.`));

      xhr.send(file);
    })();
  });
}

/** Delete a file (and its stored object) or a folder with all descendants. */
export async function deleteFile(file: FileItem): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("You need to sign in first.");

  // Folder: delete descendants bottom-up (both their storage and their rows).
  if (file.is_folder) {
    const { data: descendants, error } = await supabase
      .from("files")
      .select("id, provider_file_id, is_folder")
      .like("path", `${file.path}/%`)
      .eq("user_id", user.id);
    if (error) throw new Error(`Could not list folder contents: ${error.message}`);

    const storagePaths = (descendants ?? [])
      .map((d) => (d.is_folder ? null : d.provider_file_id))
      .filter((p): p is string => Boolean(p));
    if (storagePaths.length > 0) {
      await supabase.storage.from("user_uploads").remove(storagePaths);
    }
    if ((descendants ?? []).length > 0) {
      const ids = (descendants ?? []).map((d) => d.id);
      const { error: delError } = await supabase.from("files").delete().in("id", ids).eq("user_id", user.id);
      if (delError) throw new Error(`Could not delete folder contents: ${delError.message}`);
    }
  } else if (file.provider_file_id && !file.provider_id) {
    await supabase.storage.from("user_uploads").remove([file.provider_file_id]);
  }

  const { error } = await supabase.from("files").delete().eq("id", file.id).eq("user_id", user.id);
  if (error) throw new Error(`Could not delete "${file.filename}": ${error.message}`);
}

export async function renameFile(file: FileItem, newName: string): Promise<FileItem> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Name is required.");
  if (trimmed === file.filename) return file;
  if (trimmed.length > 255) throw new Error("Name is too long (max 255 characters).");
  if (/[/\\]/.test(trimmed)) throw new Error("Names cannot contain slashes.");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");

  // Keep path (and descendants' paths) consistent.
  const parentPath = file.path.substring(0, file.path.length - file.filename.length);
  const newPath = `${parentPath}${trimmed}`;

  const { data, error } = await supabase
    .from("files")
    .update({ filename: trimmed, path: newPath })
    .eq("id", file.id)
    .eq("user_id", userData.user.id)
    .select()
    .single();
  if (error) {
    throw new Error(error.code === "23505" ? "An item with this name already exists here." : `Could not rename: ${error.message}`);
  }

  if (file.is_folder) {
    // Update descendant paths from old prefix to new prefix.
    const { data: descendants } = await supabase
      .from("files")
      .select("id, path")
      .like("path", `${file.path}/%`)
      .eq("user_id", userData.user.id);
    for (const child of descendants ?? []) {
      const childPath = `${newPath}${child.path.substring(file.path.length)}`;
      await supabase.from("files").update({ path: childPath }).eq("id", child.id);
    }
  }

  return data as unknown as FileItem;
}

export async function toggleStar(file: FileItem): Promise<boolean> {
  const next = !file.is_starred;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");
  const { error } = await supabase
    .from("files")
    .update({ is_starred: next })
    .eq("id", file.id)
    .eq("user_id", userData.user.id);
  if (error) throw new Error(`Could not update "${file.filename}": ${error.message}`);
  return next;
}

/** Download a file's bytes via an authenticated storage URL. */
export async function downloadFile(file: FileItem): Promise<void> {
  if (file.is_folder) throw new Error("Folders can't be downloaded as a single file.");
  if (!file.provider_file_id) throw new Error("This file has no stored content to download.");
  const { data, error } = await supabase.storage
    .from("user_uploads")
    .createSignedUrl(file.provider_file_id, 60, { download: file.filename });
  if (error || !data) throw new Error(`Could not generate a download link: ${error?.message ?? "unknown error"}`);
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Temporary preview URL for images. */
export async function getPreviewUrl(file: FileItem): Promise<string | null> {
  if (!file.provider_file_id) return null;
  const { data, error } = await supabase.storage.from("user_uploads").createSignedUrl(file.provider_file_id, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

// ── Shares ───────────────────────────────────────────────────────────────────

export interface FileShare {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_id: string | null;
  shared_with_email: string | null;
  permission_level: "view" | "edit" | "admin";
  created_at: string;
  expires_at: string | null;
}

export async function listShares(fileId: string): Promise<FileShare[]> {
  const { data, error } = await supabase
    .from("file_shares")
    .select("*")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load shares: ${error.message}`);
  return (data ?? []) as FileShare[];
}

export async function shareFile(
  file: FileItem,
  email: string,
  permissionLevel: "view" | "edit" = "view",
  expiresAt: string | null = null
): Promise<FileShare> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error("Enter a valid email address.");
  if (expiresAt && new Date(expiresAt) <= new Date()) throw new Error("Expiry date must be in the future.");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");

  const { data, error } = await supabase
    .from("file_shares")
    .insert({
      file_id: file.id,
      owner_id: userData.user.id,
      shared_with_email: trimmed,
      permission_level: permissionLevel,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Already shared with ${trimmed}.`);
    throw new Error(`Could not share: ${error.message}`);
  }
  // Mark file as shared for quick filtering.
  await supabase.from("files").update({ is_shared: true }).eq("id", file.id).eq("user_id", userData.user.id);
  return data as unknown as FileShare;
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase.from("file_shares").delete().eq("id", shareId);
  if (error) throw new Error(`Could not revoke share: ${error.message}`);
}

// ── Storage providers (connections) ─────────────────────────────────────────

export interface StorageProvider {
  id: string;
  user_id: string;
  provider_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  total_space: number | null;
  used_space: number | null;
  priority: number;
  status: "connected" | "disconnected" | "error" | string;
  provider_user_email: string | null;
  created_at: string;
  updated_at: string;
}

export async function listProviders(): Promise<StorageProvider[]> {
  const { data, error } = await supabase
    .from("storage_providers")
    .select("id, user_id, provider_name, access_token, refresh_token, token_expires_at, total_space, used_space, priority, status, provider_user_email, created_at, updated_at")
    .order("priority", { ascending: true });
  if (error) throw new Error(`Could not load providers: ${error.message}`);
  return (data ?? []) as StorageProvider[];
}

export async function disconnectProvider(providerId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");
  // Remove the row entirely so stored tokens are destroyed, not just flagged.
  const { error } = await supabase
    .from("storage_providers")
    .delete()
    .eq("id", providerId)
    .eq("user_id", userData.user.id);
  if (error) throw new Error(`Could not disconnect provider: ${error.message}`);
}

export async function updateProviderOrder(orderedIds: string[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You need to sign in first.");
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("storage_providers").update({ priority: index + 1 }).eq("id", id).eq("user_id", userData.user!.id)
    )
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

export async function recordActivity(
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return; // activity logging is best-effort
  await supabase.from("audit_logs").insert({
    user_id: userData.user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    details: (details ?? {}) as Database["public"]["Tables"]["audit_logs"]["Insert"]["details"],
  });
}

export async function listActivity(limit = 20): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, user_id, action, resource_type, resource_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return (data ?? []) as ActivityEvent[];
}

export { getProviderName };
