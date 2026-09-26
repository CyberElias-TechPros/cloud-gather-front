import { api, apiDownload } from "@/lib/api";
import type { LinkVisit, PublicLink, ShareRecord } from "@/types/api";
import type { FileItem } from "@/types/file";

/* ---------------------------------------------------------- email shares */

export const listSentShares = async () => (await api<{ shares: ShareRecord[] }>("/shares/sent")).shares;
export const listReceivedShares = async () => (await api<{ shares: ShareRecord[] }>("/shares/received")).shares;

export const updateShare = (shareId: string, changes: { permission_level?: "view" | "edit"; expires_at?: string | null }) =>
  api<{ share: ShareRecord }>(`/shares/${shareId}`, { method: "PATCH", body: JSON.stringify(changes) });

export const revokeShare = (shareId: string) => api(`/shares/${shareId}`, { method: "DELETE" });

export const downloadSharedFile = (shareId: string, filename: string) =>
  apiDownload(`/shares/${shareId}/download`, filename);

/* ---------------------------------------------------------- public links */

export interface CreateLinkInput {
  expires_in_days?: number | null;
  expires_at?: string | null;
  password?: string | null;
  max_downloads?: number | null;
  allow_download?: boolean;
  note?: string | null;
}

export const createLink = (fileId: string, input: CreateLinkInput = {}) =>
  api<{ link: PublicLink; warning: string }>(`/files/${fileId}/links`, { method: "POST", body: JSON.stringify(input) });

export const listFileLinks = async (fileId: string) => (await api<{ links: PublicLink[] }>(`/files/${fileId}/links`)).links;

export const listLinks = async () => (await api<{ links: PublicLink[] }>("/links")).links;

export const updateLink = (linkId: string, changes: Partial<CreateLinkInput> & { revoked?: boolean }) =>
  api<{ link: PublicLink }>(`/links/${linkId}`, { method: "PATCH", body: JSON.stringify(changes) });

export const revokeLink = (linkId: string) => api(`/links/${linkId}`, { method: "DELETE" });

export const listLinkVisits = async (linkId: string) => (await api<{ visits: LinkVisit[] }>(`/links/${linkId}/visits`)).visits;

/* ------------------------------------------------------- anonymous access */

export interface PublicLinkView {
  link: {
    id: string;
    requires_password: boolean;
    allow_download: boolean;
    downloads_remaining: number | null;
    expires_at: string | null;
    note: string | null;
  };
  file: FileItem;
  owner: { display_name: string };
}

export const viewPublicLink = (token: string, access?: string) =>
  api<PublicLinkView>(`/public/links/${encodeURIComponent(token)}${access ? `?access=${encodeURIComponent(access)}` : ""}`);

export const unlockPublicLink = (token: string, password: string) =>
  api<{ access: string; expires_in: number }>(`/public/links/${encodeURIComponent(token)}/unlock`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });

export const publicDownloadUrl = (token: string, access?: string) =>
  `/public/links/${encodeURIComponent(token)}/download${access ? `?access=${encodeURIComponent(access)}` : ""}`;

export const downloadPublicLink = (token: string, filename: string, access?: string) =>
  apiDownload(publicDownloadUrl(token, access), filename);
