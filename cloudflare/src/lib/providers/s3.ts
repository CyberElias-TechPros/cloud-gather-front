/**
 * Minimal AWS Signature V4 signer for S3-compatible object storage
 * (Amazon S3, Backblaze B2 S3 API, Cloudflare R2, MinIO, Wasabi, …).
 *
 * Implemented from the published algorithm so it can be verified against the
 * official AWS test vectors (see `tests/unit/s3.test.ts`).
 */

const encoder = new TextEncoder();

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface SignOptions {
  method: string;
  host: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  payloadHash: string;
  region: string;
  service?: string;
  date?: Date;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? encoder.encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", data));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

/** RFC 3986 encoding — S3 rejects the `encodeURIComponent` variants for some chars. */
export function uriEncode(value: string, encodeSlash = true): string {
  let out = "";
  for (const char of value) {
    if (/[A-Za-z0-9\-._~]/.test(char)) out += char;
    else if (char === "/") out += encodeSlash ? "%2F" : "/";
    else out += [...encoder.encode(char)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  }
  return out;
}

export function canonicalQueryString(query: Record<string, string> = {}): string {
  return Object.keys(query)
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(query[key] ?? "")}`)
    .join("&");
}

export async function signRequest(credentials: AwsCredentials, options: SignOptions): Promise<SignedRequest> {
  const service = options.service ?? "s3";
  const date = options.date ?? new Date();
  const amzDate = `${date.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: options.host,
    "x-amz-content-sha256": options.payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
  };
  if (credentials.sessionToken) headers["x-amz-security-token"] = credentials.sessionToken;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((key) => `${key}:${headers[key]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalQuery = canonicalQueryString(options.query);

  const canonicalRequest = [
    options.method.toUpperCase(),
    uriEncode(options.path, false),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    options.payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${options.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");

  let key: ArrayBuffer | Uint8Array = encoder.encode(`AWS4${credentials.secretAccessKey}`);
  key = await hmac(key, dateStamp);
  key = await hmac(key, options.region);
  key = await hmac(key, service);
  key = await hmac(key, "aws4_request");
  const signature = hex(await hmac(key, stringToSign));

  const url = `https://${options.host}${uriEncode(options.path, false)}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  return {
    url,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export interface S3Connection {
  endpoint: string;
  bucket: string;
  region: string;
  credentials: AwsCredentials;
  prefix?: string;
}

export interface RemoteObject {
  id: string;
  name: string;
  size: number;
  isFolder: boolean;
  updatedAt: string | null;
  mimeType: string | null;
}

/** Verifies credentials and bucket access with a cheapest-possible request. */
export async function probeBucket(connection: S3Connection): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const host = `${connection.bucket}.${connection.endpoint}`;
  const signed = await signRequest(connection.credentials, {
    method: "GET",
    host,
    path: "/",
    query: { "list-type": "2", "max-keys": "1", prefix: connection.prefix ?? "" },
    payloadHash: await sha256Hex(""),
    region: connection.region,
  });
  try {
    const response = await fetch(signed.url, { headers: signed.headers });
    if (response.status === 200) return { ok: true, name: connection.bucket };
    if (response.status === 403) return { ok: false, error: "The access key was rejected by the provider (403 Forbidden)." };
    if (response.status === 404) return { ok: false, error: `Bucket "${connection.bucket}" was not found at ${connection.endpoint}.` };
    return { ok: false, error: `The provider responded with ${response.status}.` };
  } catch (error) {
    return { ok: false, error: `Could not reach ${connection.endpoint}: ${(error as Error).message}` };
  }
}

/** ListObjectsV2, one page at a time (metadata only, no downloads). */
export async function listObjects(
  connection: S3Connection,
  options: { prefix?: string; delimiter?: string; continuationToken?: string; maxKeys?: number } = {},
): Promise<{ objects: RemoteObject[]; nextToken: string | null }> {
  const host = `${connection.bucket}.${connection.endpoint}`;
  const query: Record<string, string> = {
    "list-type": "2",
    "max-keys": String(Math.min(options.maxKeys ?? 200, 1000)),
    prefix: options.prefix ?? connection.prefix ?? "",
  };
  if (options.delimiter) query.delimiter = options.delimiter;
  if (options.continuationToken) query["continuation-token"] = options.continuationToken;

  const signed = await signRequest(connection.credentials, {
    method: "GET",
    host,
    path: "/",
    query,
    payloadHash: await sha256Hex(""),
    region: connection.region,
  });

  const response = await fetch(signed.url, { headers: signed.headers });
  if (!response.ok) throw new Error(`Provider listing failed with status ${response.status}`);
  const xml = await response.text();

  const objects: RemoteObject[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1];
    const key = text(block, "Key");
    if (!key) continue;
    const trimmedPrefix = query.prefix;
    const name = key.slice(trimmedPrefix.length) || key.split("/").filter(Boolean).pop() || key;
    if (!name || name.endsWith("/")) continue;
    objects.push({
      id: key,
      name,
      size: Number(text(block, "Size") ?? 0),
      isFolder: false,
      updatedAt: text(block, "LastModified"),
      mimeType: guessMime(name),
    });
  }
  for (const match of xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)) {
    const prefix = text(match[1], "Prefix");
    if (!prefix) continue;
    const name = prefix.slice(query.prefix.length).replace(/\/$/, "");
    if (!name) continue;
    objects.push({ id: prefix, name, size: 0, isFolder: true, updatedAt: null, mimeType: null });
  }

  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  return { objects, nextToken: truncated ? text(xml, "NextContinuationToken") : null };
}

/** Presigned GET URL — lets the browser stream directly from the provider. */
export async function presignGet(connection: S3Connection, key: string, expiresSeconds = 900): Promise<string> {
  const host = `${connection.bucket}.${connection.endpoint}`;
  const date = new Date();
  const amzDate = `${date.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${connection.region}/s3/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${connection.credentials.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  if (connection.credentials.sessionToken) query["X-Amz-Security-Token"] = connection.credentials.sessionToken;

  const canonicalRequest = [
    "GET",
    uriEncode(`/${key}`, false),
    canonicalQueryString(query),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  let key2: ArrayBuffer | Uint8Array = encoder.encode(`AWS4${connection.credentials.secretAccessKey}`);
  key2 = await hmac(key2, dateStamp);
  key2 = await hmac(key2, connection.region);
  key2 = await hmac(key2, "s3");
  key2 = await hmac(key2, "aws4_request");
  const signature = hex(await hmac(key2, `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`));

  const finalQuery = { ...query, "X-Amz-Signature": signature };
  return `https://${host}${uriEncode(`/${key}`, false)}?${canonicalQueryString(finalQuery)}`;
}

function text(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? decodeXml(match[1]) : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    svg: "image/svg+xml", heic: "image/heic", pdf: "application/pdf", txt: "text/plain",
    md: "text/markdown", csv: "text/csv", json: "application/json", zip: "application/zip",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp4: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav",
  };
  return map[ext] ?? "application/octet-stream";
}
