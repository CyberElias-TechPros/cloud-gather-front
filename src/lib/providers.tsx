import React from "react";
import { GoogleDriveIcon, DropboxIcon, OneDriveIcon, BoxIcon } from "@/components/icons/provider-icons";

export type ProviderKind = "oauth" | "credentials";

export interface ProviderMeta {
  id: string;
  name: string;
  description: string;
  kind: ProviderKind;
  icon: React.FC<{ className?: string }>;
  /** Tailwind color classes used for the provider chip/badge. */
  color: string;
  docsUrl?: string;
  /** Credential fields for providers connected with API keys (kind: "credentials"). */
  credentialFields?: { key: string; label: string; type: "text" | "password"; required: boolean; helpText?: string }[];
}

/**
 * Catalogue of supported storage providers. This is presentation metadata only —
 * connection state lives in the `storage_providers` table.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Personal and Workspace drives, including shared drives you have access to.",
    kind: "oauth",
    icon: GoogleDriveIcon,
    color: "text-[#1A73E8]",
    docsUrl: "https://developers.google.com/drive",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Files and folders from your Dropbox account, including shared folders.",
    kind: "oauth",
    icon: DropboxIcon,
    color: "text-[#0061FF]",
    docsUrl: "https://www.dropbox.com/developers",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Personal OneDrive and OneDrive for Business files via Microsoft Graph.",
    kind: "oauth",
    icon: OneDriveIcon,
    color: "text-[#0364B8]",
    docsUrl: "https://learn.microsoft.com/graph/api/resources/drive",
  },
  {
    id: "box",
    name: "Box",
    description: "Box cloud content for individuals and teams.",
    kind: "oauth",
    icon: BoxIcon,
    color: "text-[#0061D5]",
    docsUrl: "https://developer.box.com",
  },
  {
    id: "amazon-s3",
    name: "Amazon S3",
    description: "Any S3 bucket via access keys. Great for archives and backups.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#FF9900]",
    docsUrl: "https://aws.amazon.com/s3/",
    credentialFields: [
      { key: "accessKeyId", label: "Access key ID", type: "text", required: true },
      { key: "secretAccessKey", label: "Secret access key", type: "password", required: true },
      { key: "region", label: "Region", type: "text", required: true, helpText: "e.g. us-east-1" },
      { key: "bucket", label: "Bucket", type: "text", required: true },
    ],
  },
  {
    id: "backblaze",
    name: "Backblaze B2",
    description: "Backblaze B2 cloud storage buckets.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#E21E29]",
    docsUrl: "https://www.backblaze.com/b2/docs/",
    credentialFields: [
      { key: "keyId", label: "Key ID", type: "text", required: true },
      { key: "appKey", label: "Application key", type: "password", required: true },
      { key: "bucket", label: "Bucket", type: "text", required: true },
    ],
  },
  {
    id: "pcloud",
    name: "pCloud",
    description: "Your pCloud drive, including crypto folders where permitted.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#17A814]",
    docsUrl: "https://docs.pcloud.com",
    credentialFields: [
      { key: "email", label: "pCloud email", type: "text", required: true },
      { key: "password", label: "Password / app password", type: "password", required: true },
    ],
  },
  {
    id: "yandex-disk",
    name: "Yandex Disk",
    description: "Files stored in Yandex Disk.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#CC0000]",
    docsUrl: "https://yandex.com/dev/disk",
    credentialFields: [
      { key: "oauthToken", label: "OAuth token", type: "password", required: true, helpText: "Create at oauth.yandex.com" },
    ],
  },
  {
    id: "mega",
    name: "MEGA",
    description: "MEGA cloud drive (end-to-end encrypted providers have limited browsing support).",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#D9272E]",
    docsUrl: "https://mega.nz",
    credentialFields: [
      { key: "email", label: "MEGA email", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    id: "icedrive",
    name: "Icedrive",
    description: "Icedrive cloud storage.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#2D9CDB]",
    docsUrl: "https://icedrive.net",
    credentialFields: [
      { key: "email", label: "Icedrive email", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    id: "sync",
    name: "Sync.com",
    description: "Sync.com encrypted storage.",
    kind: "credentials",
    icon: BoxIcon,
    color: "text-[#00A3E0]",
    docsUrl: "https://www.sync.com",
    credentialFields: [
      { key: "apiKey", label: "API token", type: "password", required: true },
    ],
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as string[];

export function getProviderMeta(id: string | null | undefined): ProviderMeta | undefined {
  if (!id) return undefined;
  return PROVIDERS.find((p) => p.id === id);
}

export function getProviderName(id: string | null | undefined): string {
  return getProviderMeta(id)?.name ?? (id || "Unknown provider");
}

export function getProviderIcon(id: string | null | undefined): React.FC<{ className?: string }> {
  return getProviderMeta(id)?.icon ?? BoxIcon;
}

/** Display name helper for FileItem.provider fields. */
export function providerDisplayName(providerName: string): string {
  return getProviderName(providerName);
}
