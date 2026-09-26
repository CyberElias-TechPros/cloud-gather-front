/**
 * S3-compatible adapter — covers Amazon S3, Backblaze B2 (S3 API), Wasabi,
 * Cloudflare R2, MinIO and anything else that speaks SigV4.
 *
 * Objects are addressed by key; "folders" are `/`-delimited prefixes.
 */
import type { Env } from "../env";
import type { Connection, CredentialField, ListResult, ProviderAdapter, RemoteAccount, RemoteEntry } from "./types";
import { ProviderError } from "./types";
import { signAwsV4 } from "../core/crypto";
import { providerFetch } from "./util";
import { guessMimeType } from "../core/util";

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

function readConfig(connection: Connection): S3Config {
  const config = connection.config as unknown as S3Config;
  if (!config?.accessKeyId || !config?.secretAccessKey || !config?.bucket) {
    throw new ProviderError("This S3 connection is missing credentials. Reconnect the account.", 400, false, true);
  }
  return { ...config, region: config.region || "us-east-1" };
}

function endpointUrl(config: S3Config, key = "", query: Record<string, string> = {}): URL {
  const host = config.endpoint
    ? config.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : `s3.${config.region}.amazonaws.com`;
  const pathStyle = config.forcePathStyle ?? Boolean(config.endpoint);
  const base = pathStyle ? `https://${host}/${config.bucket}` : `https://${config.bucket}.${host}`;
  const url = new URL(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`.replace(/\/+$/, key ? "" : "/"));
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url;
}

async function s3Fetch(config: S3Config, method: string, url: URL, body?: BodyInit | null, headers: Record<string, string> = {}) {
  const signed = await signAwsV4({
    method,
    url,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    headers,
  });
  return providerFetch(url.toString(), { method, headers: signed, body: body ?? undefined });
}

/** Tiny XML value extractor — avoids pulling a parser into the Worker bundle. */
function extractAll(xml: string, tag: string): string[] {
  const matches = xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"));
  return [...matches].map((match) => match[1]);
}
const extract = (xml: string, tag: string): string | null => extractAll(xml, tag)[0] ?? null;
const decodeXml = (value: string) =>
  value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const CREDENTIAL_FIELDS: CredentialField[] = [
  { key: "accessKeyId", label: "Access key ID", type: "text", required: true },
  { key: "secretAccessKey", label: "Secret access key", type: "password", required: true },
  { key: "bucket", label: "Bucket name", type: "text", required: true },
  { key: "region", label: "Region", type: "text", required: true, placeholder: "us-east-1" },
  {
    key: "endpoint",
    label: "Custom endpoint",
    type: "text",
    required: false,
    helpText: "Leave blank for Amazon S3. Example: s3.us-west-002.backblazeb2.com",
  },
];

export function createS3Adapter(providerId: string, name: string, defaults: Partial<S3Config> = {}, helpText?: string): ProviderAdapter {
  return {
    id: providerId,
    name,
    kind: "credentials",
    rootId: "",
    credentialFields: CREDENTIAL_FIELDS.map((field) =>
      field.key === "endpoint" && helpText ? { ...field, helpText, required: Boolean(defaults.endpoint) === false && providerId !== "amazon-s3" } : field,
    ),
    isConfigured: () => true,
    missingConfigMessage: () => `${name} requires bucket credentials.`,

    async connectWithCredentials(_env: Env, values: Record<string, string>) {
      const config: S3Config = {
        accessKeyId: values.accessKeyId?.trim(),
        secretAccessKey: values.secretAccessKey?.trim(),
        bucket: values.bucket?.trim(),
        region: (values.region || defaults.region || "us-east-1").trim(),
        endpoint: (values.endpoint || defaults.endpoint || "").trim() || undefined,
        forcePathStyle: defaults.forcePathStyle,
      };
      if (!config.accessKeyId || !config.secretAccessKey || !config.bucket) {
        throw new ProviderError("Access key, secret and bucket are all required.", 400);
      }
      // Validate immediately so users learn about bad keys at connect time.
      const url = endpointUrl(config, "", { "list-type": "2", "max-keys": "1" });
      await s3Fetch(config, "GET", url);
      return { tokens: { accessToken: "s3" }, config: config as unknown as Record<string, unknown> };
    },

    async getAccount(connection): Promise<RemoteAccount> {
      const config = readConfig(connection);
      return {
        accountId: `${config.bucket}@${config.endpoint || config.region}`,
        email: null,
        displayName: `${config.bucket} (${config.region})`,
        totalSpace: null,
        usedSpace: null,
        rootFolderId: "",
      };
    },

    async list(connection, folderId, cursor): Promise<ListResult> {
      const config = readConfig(connection);
      const prefix = folderId ? `${folderId.replace(/\/?$/, "/")}` : "";
      const url = endpointUrl(config, "", {
        "list-type": "2",
        delimiter: "/",
        "max-keys": "500",
        ...(prefix ? { prefix } : {}),
        ...(cursor ? { "continuation-token": cursor } : {}),
      });
      const xml = await (await s3Fetch(config, "GET", url)).text();

      const folders: RemoteEntry[] = extractAll(xml, "CommonPrefixes").map((block) => {
        const key = decodeXml(extract(block, "Prefix") || "");
        const name = key.replace(/\/$/, "").split("/").pop() || key;
        return { id: key.replace(/\/$/, ""), name, path: `/${key}`, size: 0, isFolder: true, mimeType: null, modifiedAt: null };
      });

      const files: RemoteEntry[] = extractAll(xml, "Contents")
        .map((block) => {
          const key = decodeXml(extract(block, "Key") || "");
          return {
            id: key,
            name: key.split("/").pop() || key,
            path: `/${key}`,
            size: Number(extract(block, "Size") || 0),
            mimeType: guessMimeType(key),
            isFolder: false,
            modifiedAt: extract(block, "LastModified"),
          };
        })
        .filter((entry) => entry.name && !entry.id.endsWith("/"));

      const truncated = extract(xml, "IsTruncated") === "true";
      return { entries: [...folders, ...files], nextCursor: truncated ? extract(xml, "NextContinuationToken") : null };
    },

    async download(connection, fileId) {
      const config = readConfig(connection);
      const response = await s3Fetch(config, "GET", endpointUrl(config, fileId));
      return new Response(response.body, {
        headers: {
          "content-type": response.headers.get("content-type") || guessMimeType(fileId),
          ...(response.headers.get("content-length") ? { "content-length": response.headers.get("content-length")! } : {}),
          "x-cloudgather-filename": fileId.split("/").pop() || "download",
        },
      });
    },

    async upload(connection, parentId, name, body, size, mimeType) {
      const config = readConfig(connection);
      const key = parentId ? `${parentId.replace(/\/?$/, "/")}${name}` : name;
      const payload = body instanceof Blob ? await body.arrayBuffer() : (body as ArrayBuffer);
      await s3Fetch(config, "PUT", endpointUrl(config, key), payload as BodyInit, {
        "content-type": mimeType || guessMimeType(name),
        "content-length": String(size),
      });
      return { id: key, name, path: `/${key}`, size, mimeType: mimeType || guessMimeType(name), isFolder: false, modifiedAt: new Date().toISOString() };
    },

    async createFolder(connection, parentId, name) {
      const config = readConfig(connection);
      const key = `${parentId ? `${parentId.replace(/\/?$/, "/")}` : ""}${name}/`;
      await s3Fetch(config, "PUT", endpointUrl(config, key), new ArrayBuffer(0), { "content-length": "0" });
      return { id: key.replace(/\/$/, ""), name, path: `/${key}`, size: 0, isFolder: true, mimeType: null, modifiedAt: new Date().toISOString() };
    },

    async remove(connection, fileId, isFolder) {
      const config = readConfig(connection);
      if (!isFolder) {
        await s3Fetch(config, "DELETE", endpointUrl(config, fileId));
        return;
      }
      let cursor: string | null = null;
      do {
        const url = endpointUrl(config, "", {
          "list-type": "2",
          prefix: `${fileId.replace(/\/?$/, "/")}`,
          "max-keys": "500",
          ...(cursor ? { "continuation-token": cursor } : {}),
        });
        const xml: string = await (await s3Fetch(config, "GET", url)).text();
        const keys = extractAll(xml, "Contents").map((block) => decodeXml(extract(block, "Key") || ""));
        for (const key of keys) await s3Fetch(config, "DELETE", endpointUrl(config, key));
        cursor = extract(xml, "IsTruncated") === "true" ? extract(xml, "NextContinuationToken") : null;
      } while (cursor);
    },

    async rename(connection, fileId, name, isFolder) {
      const config = readConfig(connection);
      const parent = fileId.includes("/") ? fileId.slice(0, fileId.lastIndexOf("/")) : "";
      const target = parent ? `${parent}/${name}` : name;
      await copyObject(config, fileId, target);
      await s3Fetch(config, "DELETE", endpointUrl(config, fileId));
      return { id: target, name, path: `/${target}`, size: 0, isFolder, mimeType: guessMimeType(name), modifiedAt: new Date().toISOString() };
    },

    async move(connection, fileId, newParentId, isFolder) {
      const config = readConfig(connection);
      const name = fileId.split("/").pop() || fileId;
      const target = newParentId ? `${newParentId.replace(/\/?$/, "/")}${name}` : name;
      await copyObject(config, fileId, target);
      await s3Fetch(config, "DELETE", endpointUrl(config, fileId));
      return { id: target, name, path: `/${target}`, size: 0, isFolder, mimeType: guessMimeType(name), modifiedAt: new Date().toISOString() };
    },

    async search(connection, query) {
      // S3 has no search API: scan a bounded number of keys and filter locally.
      const config = readConfig(connection);
      const needle = query.toLowerCase();
      const entries: RemoteEntry[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const url = endpointUrl(config, "", { "list-type": "2", "max-keys": "1000", ...(cursor ? { "continuation-token": cursor } : {}) });
        const xml: string = await (await s3Fetch(config, "GET", url)).text();
        for (const block of extractAll(xml, "Contents")) {
          const key = decodeXml(extract(block, "Key") || "");
          const name = key.split("/").pop() || key;
          if (name.toLowerCase().includes(needle)) {
            entries.push({
              id: key,
              name,
              path: `/${key}`,
              size: Number(extract(block, "Size") || 0),
              mimeType: guessMimeType(key),
              isFolder: false,
              modifiedAt: extract(block, "LastModified"),
            });
          }
          if (entries.length >= 100) break;
        }
        cursor = extract(xml, "IsTruncated") === "true" ? extract(xml, "NextContinuationToken") : null;
        pages += 1;
      } while (cursor && entries.length < 100 && pages < 5);
      return { entries, nextCursor: null };
    },

    async quota(connection) {
      // Buckets are effectively unbounded; report measured usage of the first pages.
      const config = readConfig(connection);
      let used = 0;
      let cursor: string | null = null;
      let pages = 0;
      do {
        const url = endpointUrl(config, "", { "list-type": "2", "max-keys": "1000", ...(cursor ? { "continuation-token": cursor } : {}) });
        const xml: string = await (await s3Fetch(config, "GET", url)).text();
        for (const block of extractAll(xml, "Contents")) used += Number(extract(block, "Size") || 0);
        cursor = extract(xml, "IsTruncated") === "true" ? extract(xml, "NextContinuationToken") : null;
        pages += 1;
      } while (cursor && pages < 5);
      return { total: null, used };
    },
  };

  async function copyObject(config: S3Config, from: string, to: string) {
    await s3Fetch(config, "PUT", endpointUrl(config, to), null, {
      "x-amz-copy-source": `/${config.bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
    });
  }
}

export const amazonS3 = createS3Adapter("amazon-s3", "Amazon S3", { region: "us-east-1" }, "Leave blank for Amazon S3 endpoints.");
export const backblaze = createS3Adapter(
  "backblaze",
  "Backblaze B2",
  { region: "us-west-002", endpoint: "s3.us-west-002.backblazeb2.com", forcePathStyle: false },
  "Your B2 S3 endpoint, e.g. s3.us-west-002.backblazeb2.com",
);
export const s3Compatible = createS3Adapter(
  "s3-compatible",
  "S3-compatible storage",
  { forcePathStyle: true },
  "Endpoint for Wasabi, MinIO, Cloudflare R2, DigitalOcean Spaces, etc.",
);
