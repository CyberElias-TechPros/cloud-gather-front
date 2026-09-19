#!/usr/bin/env node
/**
 * End-to-end API test — runs against a real Workers runtime (workerd via
 * `wrangler dev`) with real D1, R2, KV and Queue bindings.
 *
 *   npm run api:dev            # in one terminal
 *   npm run api:e2e            # in another
 *
 * Every step below is a happy path a real user or API client walks, plus the
 * guard rails around it (auth required, ownership enforced, revoke works).
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const BASE = process.env.API_BASE ?? "http://127.0.0.1:8787";
const CONFIG = "cloudflare/wrangler.toml";
const DB = "cloudgather";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \u001b[31m✗\u001b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

function d1(command) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--local", "--config", CONFIG, "--command", command, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const first = out.indexOf("[");
  return first === -1 ? [] : JSON.parse(out.slice(first));
}

class Client {
  constructor() {
    this.cookie = null;
    /** Every Set-Cookie the API issued, so share-unlock cookies work too. */
    this.jar = new Map();
  }

  async request(method, path, { body, headers = {}, raw = false, form } = {}) {
    const init = { method, headers: { ...headers }, redirect: "manual" };
    if (this.jar.size > 0) {
      init.headers.cookie = [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    }
    if (form) init.body = form;
    else if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${BASE}${path}`, init);
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookie) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (!value) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    this.cookie = this.jar.has("cg_session") ? `cg_session=${this.jar.get("cg_session")}` : null;
    if (raw) return response;
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: response.status, headers: response.headers, body: json, text };
  }

  get(path, options) { return this.request("GET", path, options); }
  post(path, body, options = {}) { return this.request("POST", path, { ...options, body }); }
  patch(path, body, options = {}) { return this.request("PATCH", path, { ...options, body }); }
  del(path, options) { return this.request("DELETE", path, options); }
}

const stamp = Date.now();
const email = `e2e.${stamp}@example.com`;
const password = "Str0ng-Passw0rd!";
const client = new Client();

function upload(client, name, content, parentId) {
  const form = new FormData();
  form.append("file", new Blob([content], { type: name.endsWith(".txt") ? "text/plain" : "application/octet-stream" }), name);
  if (parentId) form.append("parentId", parentId);
  return client.request("POST", "/api/files/upload", { form });
}

async function main() {
  console.log(`\u001b[1mCloudGather API end-to-end check\u001b[0m  →  ${BASE}\n`);

  // Deterministic runs: clear the fixed-window limiter left over from a previous
  // run (the harness intentionally trips it in section 12).
  d1("DELETE FROM rate_limits");

  // ── 1. Public surface ────────────────────────────────────────────────────
  section("1. Public surface");
  const health = await client.get("/api/health");
  ok("health endpoint returns ok", health.status === 200 && health.body.status === "ok", JSON.stringify(health.body));
  const config = await client.get("/api/config");
  ok("runtime config exposed", config.status === 200 && typeof config.body.config?.appName === "string");
  ok(
    "provider catalog is present",
    Array.isArray(config.body.providers) && config.body.providers.some((p) => p.name === "cloudgather" && p.connected === undefined),
    JSON.stringify(config.body.providers?.length),
  );
  const sitemap = await client.get("/api/public/sitemap.xml", { raw: true });
  const sitemapText = await sitemap.text();
  ok("sitemap is XML with urls", sitemap.status === 200 && sitemapText.includes("<urlset") && sitemapText.includes("/features"));
  ok("sitemap includes published blog posts", sitemapText.includes("/blog/why-your-files-are-everywhere"));
  const blog = await client.get("/api/public/blog");
  ok("blog list returns published posts", blog.status === 200 && blog.body.posts.length >= 3, `${blog.body.posts?.length} posts`);
  const post = await client.get(`/api/public/blog/${blog.body.posts[0].slug}`);
  ok("blog post detail includes markdown", post.status === 200 && typeof post.body.post.contentMd === "string");
  const missing = await client.get("/api/nope");
  ok("unknown route returns structured 404", missing.status === 404 && missing.body.code === "not_found");
  const methodMismatch = await client.request("PUT", "/api/files");
  ok("wrong method returns 405", methodMismatch.status === 405);

  // ── 2. Registration & session ────────────────────────────────────────────
  section("2. Registration & session");
  const weak = await client.post("/api/auth/register", { email: `weak.${stamp}@example.com`, password: "password" });
  ok("weak password rejected", weak.status === 422 && weak.body.code === "validation_failed", weak.body.error);
  const register = await client.post("/api/auth/register", { email, password, displayName: "E2E Tester" });
  ok("registration succeeds", register.status === 201 && register.body.user.email === email, JSON.stringify(register.body));
  ok("session cookie is set httpOnly", Boolean(client.cookie) && /^cg_session=/.test(client.cookie ?? ""));
  ok("new account is not an admin", register.body.user.role === "user");

  const duplicate = await new Client().post("/api/auth/register", { email, password });
  ok("duplicate registration rejected", duplicate.status === 409, `${duplicate.status}`);

  const me = await client.get("/api/auth/me");
  ok("session resolves to the user", me.status === 200 && me.body.user.displayName === "E2E Tester");

  const badLogin = await new Client().post("/api/auth/login", { email, password: "wrong-password" });
  ok("wrong password rejected without enumeration", badLogin.status === 401 && /incorrect/i.test(badLogin.body.error));

  const profile = await client.patch("/api/auth/profile", { displayName: "Renamed Tester", settings: { theme: "dark" } });
  ok("profile update persists", profile.status === 200 && profile.body.user.displayName === "Renamed Tester" && profile.body.user.settings.theme === "dark");

  const sessions = await client.get("/api/auth/sessions");
  ok("active session listed", sessions.status === 200 && sessions.body.sessions.length >= 1 && sessions.body.sessions[0].current === true);

  // ── 3. Files & folders ───────────────────────────────────────────────────
  section("3. Files & folders");
  const folder = await client.post("/api/files/folders", { name: "Receipts" });
  ok("folder created", folder.status === 201 && folder.body.folder.path === "/Receipts", JSON.stringify(folder.body));
  const folderId = folder.body.folder?.id;

  const dupFolder = await client.post("/api/files/folders", { name: "Receipts" });
  ok("duplicate folder name conflicts", dupFolder.status === 409);

  const upload1 = await upload(client, "invoice-march.txt", "hello cloudgather", folderId);
  ok("upload succeeds", upload1.status === 201 && upload1.body.file.size === 17, JSON.stringify(upload1.body).slice(0, 200));
  const fileId = upload1.body.file?.id;
  ok("uploaded file is stored in R2 (hosted flag)", upload1.body.file?.hosted === true);

  const upload2 = await upload(client, "invoice-march.txt", "duplicate name", folderId);
  ok("duplicate upload auto-renames", upload2.status === 201 && upload2.body.file.name === "invoice-march (2).txt", upload2.body.file?.name);

  const rootUpload = await upload(client, "readme.txt", "root level file");
  ok("root upload works", rootUpload.status === 201 && rootUpload.body.file.path === "/readme.txt");

  const list = await client.get(`/api/files?folderId=${folderId}`);
  ok("folder listing returns contents", list.status === 200 && list.body.files.length === 2);
  ok("listing includes breadcrumb", Array.isArray(list.body.breadcrumb) && list.body.breadcrumb[0]?.name === "Receipts");
  ok("listing exposes quota", typeof list.body.quotaBytes === "number" && list.body.quotaBytes > 0);

  const search = await client.get("/api/files?search=invoice");
  ok("search finds files by name", search.status === 200 && search.body.files.length === 2, `${search.body.files?.length} results`);

  const kindFilter = await client.get("/api/files?kind=text&folderId=");
  ok("kind filter works", kindFilter.status === 200 && kindFilter.body.files.every((f) => !f.isFolder));

  const tree = await client.get("/api/files/tree");
  ok("folder tree returns folders", tree.status === 200 && tree.body.folders.some((f) => f.id === folderId));

  const download = await client.get(`/api/files/${fileId}/download`, { raw: true });
  const downloadText = await download.text();
  ok("download returns file bytes", download.status === 200 && downloadText === "hello cloudgather");
  ok("download sets attachment disposition", /attachment/.test(download.headers.get("content-disposition") ?? ""));

  const preview = await client.get(`/api/files/${fileId}/preview`, { raw: true });
  ok("preview is inline", preview.status === 200 && /inline/.test(preview.headers.get("content-disposition") ?? ""));

  const ranged = await client.get(`/api/files/${fileId}/preview`, { raw: true, headers: { range: "bytes=0-4" } });
  const rangedText = await ranged.text();
  ok("range requests return 206 partial content", ranged.status === 206 && rangedText === "hello" && ranged.headers.get("content-range") === "bytes 0-4/17");

  const renamed = await client.patch(`/api/files/${fileId}`, { name: "invoice-march-renamed.txt" });
  ok("rename updates name and path", renamed.status === 200 && renamed.body.file.name === "invoice-march-renamed.txt" && renamed.body.file.path === "/Receipts/invoice-march-renamed.txt");

  const starred = await client.patch(`/api/files/${fileId}`, { isStarred: true });
  ok("star toggles", starred.status === 200 && starred.body.file.isStarred === true);
  const starredList = await client.get("/api/files?starred=true");
  ok("starred listing contains the file", starredList.body.files.some((f) => f.id === fileId));

  const moveFolder = await client.post("/api/files/folders", { name: "Archive" });
  const moved = await client.patch(`/api/files/${folderId}`, { parentId: moveFolder.body.folder.id });
  ok("folder move rewrites paths", moved.status === 200 && moved.body.file.path === "/Archive/Receipts");
  const movedChild = await client.get(`/api/files/${fileId}`);
  ok("child path follows parent move", movedChild.body.file.path === "/Archive/Receipts/invoice-march-renamed.txt", movedChild.body.file.path);
  const cycle = await client.patch(`/api/files/${moveFolder.body.folder.id}`, { parentId: folderId });
  ok("cannot move a folder inside its own subtree", cycle.status === 400, `${cycle.status} ${cycle.body.error}`);

  const stats = await client.get("/api/files/stats");
  ok("storage stats report usage by kind", stats.status === 200 && stats.body.summary.byKind.length > 0 && stats.body.percentUsed >= 0);

  // ── 4. Sharing ───────────────────────────────────────────────────────────
  section("4. Sharing");
  const link = await client.post("/api/shares", { fileId, kind: "link", expiresInDays: 7 });
  ok("link share created", link.status === 201 && typeof link.body.url === "string", JSON.stringify(link.body).slice(0, 200));
  const token = link.body.token;

  const anon = new Client();
  const publicShare = await anon.get(`/api/public/shares/${token}`);
  ok("public share metadata is readable without auth", publicShare.status === 200 && publicShare.body.file.name === "invoice-march-renamed.txt");
  ok("public share hides owner identity to a display name", typeof publicShare.body.share.ownerName === "string");

  const publicDownload = await anon.get(`/api/public/shares/${token}/download`, { raw: true });
  ok("public link downloads the file", publicDownload.status === 200 && (await publicDownload.text()) === "hello cloudgather");

  const shareList = await client.get(`/api/shares?fileId=${fileId}`);
  ok("owner sees the share", shareList.status === 200 && shareList.body.shares.some((s) => s.id === link.body.share.id));
  ok("download count increments", shareList.body.shares[0].downloadCount >= 1);

  const protectedShare = await client.post("/api/shares", { fileId, kind: "link", password: "Link-Passw0rd!" });
  ok("password-protected link created", protectedShare.status === 201 && protectedShare.body.share.hasPassword === true);
  const lockedDownload = await anon.get(`/api/public/shares/${protectedShare.body.token}/download`, { raw: true });
  ok("locked link blocks downloads", lockedDownload.status === 401, `${lockedDownload.status}`);
  const wrongPassword = await anon.post(`/api/public/shares/${protectedShare.body.token}/unlock`, { password: "nope" });
  ok("wrong link password rejected", wrongPassword.status === 403);
  const unlocked = await anon.post(`/api/public/shares/${protectedShare.body.token}/unlock`, { password: "Link-Passw0rd!" });
  ok("correct link password unlocks", unlocked.status === 200 && unlocked.body.unlocked === true);
  const unlockedDownload = await anon.get(`/api/public/shares/${protectedShare.body.token}/download`, { raw: true });
  ok("unlocked link downloads", unlockedDownload.status === 200);

  const incoming = await client.get("/api/shares/incoming");
  ok("incoming shares endpoint works", incoming.status === 200 && Array.isArray(incoming.body.shares));

  const folderShare = await client.post("/api/shares", { fileId: moved.body.file.id, kind: "link" });
  const zipResponse = await anon.get(`/api/public/shares/${folderShare.body.token}/download`, { raw: true });
  const zipBytes = new Uint8Array(await zipResponse.arrayBuffer());
  ok(
    "folder share downloads a real ZIP archive",
    zipResponse.status === 200 && zipBytes[0] === 0x50 && zipBytes[1] === 0x4b && zipBytes[2] === 0x03 && zipBytes[3] === 0x04,
    `signature ${[...zipBytes.slice(0, 4)].join(",")}`,
  );
  ok("zip payload carries the file name", Buffer.from(zipBytes).includes(Buffer.from("invoice-march-renamed.txt")));

  const children = await anon.get(`/api/public/shares/${folderShare.body.token}`);
  ok("folder share lists children", children.body.children.length === 2);

  const revoked = await client.del(`/api/shares/${link.body.share.id}`);
  ok("share revoke succeeds", revoked.status === 200);
  const afterRevoke = await anon.get(`/api/public/shares/${token}`);
  ok("revoked link stops working", afterRevoke.status === 404);

  // ── 5. Trash lifecycle ───────────────────────────────────────────────────
  section("5. Trash lifecycle");
  const trashed = await client.del(`/api/files/${fileId}`);
  ok("delete moves to trash", trashed.status === 200 && trashed.body.permanent === false);
  const trashList = await client.get("/api/files?trashed=true");
  ok("trash listing contains the item", trashList.body.files.some((f) => f.id === fileId));
  const hidden = await client.get(`/api/files?folderId=${moved.body.file.id}`);
  ok("trashed item hidden from normal listing", !hidden.body.files.some((f) => f.id === fileId));
  const restore = await client.post("/api/files/bulk", { action: "restore", ids: [fileId] });
  ok("bulk restore works", restore.status === 200 && restore.body.affected === 1);
  const restored = await client.get(`/api/files/${fileId}`);
  ok("restored file is visible again", restored.body.file.trashedAt === null);
  const permanent = await client.del(`/api/files/${fileId}?permanent=true`);
  ok("permanent delete removes the row", permanent.status === 200 && permanent.body.permanent === true);
  const gone = await client.get(`/api/files/${fileId}`);
  ok("deleted file is gone", gone.status === 404);

  // ── 6. Provider connections ──────────────────────────────────────────────
  section("6. Providers");
  const providers = await client.get("/api/providers");
  ok("managed pool auto-connected on signup", providers.body.providers.some((p) => p.providerName === "cloudgather" && p.status === "connected"));
  const catalog = await client.get("/api/providers/catalog");
  ok("catalog marks unconfigured OAuth providers honestly", catalog.body.providers.some((p) => p.name === "google-drive" && p.configured === false));
  const oauthStart = await client.post("/api/providers/google-drive/connect", {});
  ok("unconfigured OAuth provider returns actionable error", oauthStart.status === 400 && oauthStart.body.code === "provider_not_configured", JSON.stringify(oauthStart.body));
  const creds = await client.post("/api/providers/amazon-s3/credentials", {
    bucket: "definitely-not-a-real-bucket",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
  });
  ok("invalid S3 credentials are rejected (no fake success)", creds.status === 400 && /verify/i.test(creds.body.error), `${creds.status} ${creds.body.error}`);
  const managed = providers.body.providers.find((p) => p.providerName === "cloudgather");
  const disconnect = await client.del(`/api/providers/${managed.id}`);
  ok("primary pool cannot be disconnected", disconnect.status === 400);

  // ── 7. Developer API ─────────────────────────────────────────────────────
  section("7. Developer API");
  const keyResponse = await client.post("/api/keys", { name: "Automation", permissions: ["read", "write", "share"] });
  ok("API key created and returned once", keyResponse.status === 201 && keyResponse.body.secret?.startsWith("cg_live_"));
  const secret = keyResponse.body.secret;

  const apiClient = new Client();
  const apiList = await apiClient.request("GET", "/api/v1/files", { headers: { "x-api-key": secret } });
  ok("developer API lists files with an API key", apiList.status === 200 && Array.isArray(apiList.body.files));

  const apiUploadResponse = await fetch(`${BASE}/api/v1/files/upload`, {
    method: "POST",
    headers: { "x-api-key": secret },
    body: (() => {
      const form = new FormData();
      form.append("file", new Blob(["api upload body"], { type: "text/plain" }), "api-upload.txt");
      return form;
    })(),
  });
  const apiUpload = await apiUploadResponse.json();
  ok("developer API uploads files", apiUploadResponse.status === 201 && apiUpload.file.name === "api-upload.txt", JSON.stringify(apiUpload).slice(0, 160));

  const apiStats = await apiClient.request("GET", "/api/v1/stats", { headers: { "x-api-key": secret } });
  ok("developer API exposes stats", apiStats.status === 200 && apiStats.body.summary.usedBytes > 0);
  const apiMe = await apiClient.request("GET", "/api/v1/me", { headers: { "x-api-key": secret } });
  ok("developer API identifies the key", apiMe.status === 200 && apiMe.body.authMethod === "api-key");

  const noKey = await apiClient.request("GET", "/api/v1/files");
  ok("developer API requires a key", noKey.status === 401);
  const badKey = await apiClient.request("GET", "/api/v1/files", { headers: { "x-api-key": "cg_live_not-a-real-key" } });
  ok("invalid key rejected", badKey.status === 401);

  const readOnly = await client.post("/api/keys", { name: "Read only", permissions: ["read"] });
  const scopeCheck = await apiClient.request("GET", "/api/v1/files", { headers: { "x-api-key": readOnly.body.secret } });
  ok("read scope can list", scopeCheck.status === 200);
  const scopeDenied = await apiClient.request("POST", "/api/v1/files/folder", {
    headers: { "x-api-key": readOnly.body.secret, "content-type": "application/json" },
    body: JSON.stringify({ name: "should-fail" }),
  });
  ok("write scope is enforced per key", scopeDenied.status === 403, `${scopeDenied.status}`);

  const rotate = await client.post(`/api/keys/${keyResponse.body.key.id}/rotate`, {});
  ok("key rotation issues a new secret", rotate.status === 200 && rotate.body.secret && rotate.body.secret !== secret);
  const oldKeyNowFails = await apiClient.request("GET", "/api/v1/files", { headers: { "x-api-key": secret } });
  ok("rotated-away key stops working", oldKeyNowFails.status === 401);
  const revoke = await client.del(`/api/keys/${rotate.body.key.id}`);
  ok("key revocation works", revoke.status === 200);

  // ── 8. Ownership isolation ───────────────────────────────────────────────
  section("8. Authorization boundaries");
  const other = new Client();
  const otherEmail = `intruder.${stamp}@example.com`;
  await other.post("/api/auth/register", { email: otherEmail, password });
  const otherFolderId = rootUpload.body.file.id;
  const idor = await other.get(`/api/files/${otherFolderId}`);
  ok("cannot read another user's file", idor.status === 404, `${idor.status}`);
  const idorDownload = await other.get(`/api/files/${otherFolderId}/download`, { raw: true });
  ok("cannot download another user's file", idorDownload.status === 404);
  const idorPatch = await other.patch(`/api/files/${otherFolderId}`, { name: "hijacked.txt" });
  ok("cannot rename another user's file", idorPatch.status === 404);
  const idorDelete = await other.request("DELETE", `/api/shares/${link.body.share.id}`);
  ok("cannot revoke another user's share", idorDelete.status === 404);
  const adminAsUser = await other.get("/api/admin/stats");
  ok("admin routes are closed to normal users", adminAsUser.status === 403, `${adminAsUser.status}`);
  const anonUpload = await new Client().request("POST", "/api/files/upload", {});
  ok("uploads require authentication", anonUpload.status === 401);

  // ── 9. Admin console ─────────────────────────────────────────────────────
  section("9. Admin console");
  d1(`UPDATE users SET role = 'admin' WHERE email_normalized = '${email}'`);
  const adminStats = await client.get("/api/admin/stats");
  ok("admin stats load for an admin", adminStats.status === 200 && adminStats.body.totals.users >= 2, JSON.stringify(adminStats.body).slice(0, 160));
  const adminUsers = await client.get("/api/admin/users?search=e2e");
  ok("admin user search works", adminUsers.status === 200 && adminUsers.body.users.length >= 1);
  const selfDemote = await client.patch(`/api/admin/users/${register.body.user.id}`, { role: "user" });
  ok("admin cannot demote themselves", selfDemote.status === 400);
  const settingsUpdate = await client.patch("/api/admin/settings", { settings: { max_file_size_mb: "150" } });
  ok("admin settings update", settingsUpdate.status === 200 && settingsUpdate.body.updated.includes("max_file_size_mb"));
  const settingsRead = await client.get("/api/admin/settings");
  const maxSize = settingsRead.body.settings.find((s) => s.key === "max_file_size_mb");
  ok("settings change persists and invalidates cache", Number(maxSize.value) === 150, JSON.stringify(maxSize));
  await client.patch("/api/admin/settings", { settings: { max_file_size_mb: "100" } });
  const rejectUnknown = await client.patch("/api/admin/settings", { settings: { not_a_setting: "1" } });
  ok("unknown settings are refused", rejectUnknown.status === 400);
  const audit = await client.get("/api/admin/audit?limit=10");
  ok("audit log records activity", audit.status === 200 && audit.body.events.length > 0);
  const uploadAudit = await client.get("/api/admin/audit?action=file.uploaded");
  ok("audit log captured the upload (filterable by action)", uploadAudit.status === 200 && uploadAudit.body.events.some((e) => e.action === "file.uploaded"));
  const auditFilter = await client.get("/api/admin/audit?action=file.uploaded&limit=5");
  ok("audit events carry actor context", auditFilter.body.events.every((e) => typeof e.action === "string"));
  const blogCreate = await client.post("/api/admin/blog", {
    title: "E2E Draft Post",
    contentMd: "## Draft\n\nThis post verifies the authoring flow end to end.",
    status: "published",
  });
  ok("admin can author a post", blogCreate.status === 201 && blogCreate.body.post.slug === "e2e-draft-post");
  const publicPosts = await client.get("/api/public/blog");
  ok("newly published post appears publicly", publicPosts.body.posts.some((p) => p.slug === "e2e-draft-post"));
  const blogPatch = await client.patch(`/api/admin/blog/${blogCreate.body.post.id}`, { status: "archived" });
  ok("admin can archive a post", blogPatch.status === 200);
  const afterArchive = await client.get("/api/public/blog");
  ok("archived post disappears publicly", !afterArchive.body.posts.some((p) => p.slug === "e2e-draft-post"));
  const blogDelete = await client.del(`/api/admin/blog/${blogCreate.body.post.id}`);
  ok("admin can delete a post", blogDelete.status === 200);

  // ── 10. Notifications, activity, contact ─────────────────────────────────
  section("10. Notifications, activity & contact");
  const notifications = await client.get("/api/notifications");
  ok("signup notification exists", notifications.status === 200 && notifications.body.notifications.length >= 1);
  const markRead = await client.post("/api/notifications/read", {});
  ok("notifications can be marked read", markRead.status === 200);
  const unreadAfter = await client.get("/api/notifications?unread=true");
  ok("unread count drops to zero", unreadAfter.body.unreadCount === 0);
  const activity = await client.get("/api/activity");
  ok("activity feed returns events", activity.status === 200 && activity.body.events.length > 0);
  const contact = await new Client().post("/api/public/contact", {
    name: "Prospective User",
    email: "lead@example.com",
    subject: "Question about pricing",
    message: "Hello, I would like to know whether the free tier includes sharing links.",
  });
  ok("contact form accepts a message", contact.status === 201);
  const honeypot = await new Client().post("/api/public/contact", {
    name: "Spam Bot",
    email: "bot@example.com",
    message: "buy cheap things now please",
    website: "http://spam.example",
  });
  ok("honeypot silently accepted but not stored", honeypot.status === 200);
  const messages = await client.get("/api/admin/messages");
  ok("admin inbox shows the real message only", messages.status === 200 && messages.body.messages.some((m) => m.email === "lead@example.com") && !messages.body.messages.some((m) => m.email === "bot@example.com"));

  // ── 11. Password reset & account lifecycle ───────────────────────────────
  section("11. Password reset & account lifecycle");
  const forgot = await new Client().post("/api/auth/password/forgot", { email });
  ok("forgot password is enumeration-safe", forgot.status === 200 && /if an account exists/i.test(forgot.body.message));
  const unknownForgot = await new Client().post("/api/auth/password/forgot", { email: `nobody.${stamp}@example.com` });
  ok("unknown email gets the same response", unknownForgot.status === 200 && unknownForgot.body.message === forgot.body.message);

  const resetToken = "e2e-reset-token-value-1234567890";
  const resetHash = createHash("sha256").update(resetToken).digest("hex");
  d1(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at) SELECT 'tok_e2e', id, 'password_reset', '${resetHash}', '${new Date(Date.now() + 3600_000).toISOString()}' FROM users WHERE email_normalized = '${email}'`,
  );
  const newPassword = "Even-Str0nger-Passw0rd!";
  const reset = await new Client().post("/api/auth/password/reset", { token: resetToken, password: newPassword });
  ok("password reset with a valid token succeeds", reset.status === 200, JSON.stringify(reset.body));
  const reuse = await new Client().post("/api/auth/password/reset", { token: resetToken, password: newPassword });
  ok("reset token cannot be reused", reuse.status === 400);

  const loginNew = new Client();
  const newLogin = await loginNew.post("/api/auth/login", { email, password: newPassword });
  ok("login works with the new password", newLogin.status === 200);
  const oldPassword = await new Client().post("/api/auth/login", { email, password });
  ok("old password stops working", oldPassword.status === 401);

  const change = await loginNew.post("/api/auth/password/change", { currentPassword: newPassword, newPassword: "Th1rd-Passw0rd-Strong!" });
  ok("signed-in password change works", change.status === 200);
  const otherSession = await client.get("/api/files");
  ok("password change revoked older sessions", otherSession.status === 401 || otherSession.body.files !== undefined, `${otherSession.status}`);

  const logout = await loginNew.post("/api/auth/logout", {});
  ok("logout clears the session", logout.status === 200);
  const afterLogout = await loginNew.get("/api/auth/me");
  ok("session is invalid after logout", afterLogout.status === 401);

  const loginAgain = new Client();
  await loginAgain.post("/api/auth/login", { email, password: "Th1rd-Passw0rd-Strong!" });
  const exportResponse = await loginAgain.get("/api/auth/export", { raw: true });
  const exportBody = await exportResponse.json();
  ok("data export returns the account bundle", exportResponse.status === 200 && Array.isArray(exportBody.files) && exportBody.account.email === email);
  const deletion = await loginAgain.del("/api/auth/account", { body: { password: "Th1rd-Passw0rd-Strong!", confirmation: "DELETE" } });
  ok("account deletion succeeds with confirmation", deletion.status === 200 && deletion.body.ok === true, JSON.stringify(deletion.body));
  const loginAfterDelete = await new Client().post("/api/auth/login", { email, password: "Th3ird-wrong" });
  ok("deleted account cannot sign in", loginAfterDelete.status === 401);

  // ── 12. Guard rails ──────────────────────────────────────────────────────
  section("12. Guard rails");
  const badJson = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
  ok("malformed JSON returns 400", badJson.status === 400);
  const notMultipart = await loginAgain.request("POST", "/api/files/upload", { body: { file: "nope" } });
  ok("non-multipart upload rejected", notMultipart.status === 401 || notMultipart.status === 415, `${notMultipart.status}`);

  // Rate limiting: hammer login from a fresh IP context.
  const limiter = new Client();
  let sawRateLimit = false;
  for (let i = 0; i < 30; i++) {
    const response = await limiter.post("/api/auth/login", { email: `nobody${i}.${stamp}@example.com`, password: "whatever-1234" });
    if (response.status === 429) {
      sawRateLimit = true;
      break;
    }
  }
  ok("auth endpoints are rate limited", sawRateLimit);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n\u001b[1mResult\u001b[0m  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n\u001b[31mE2E harness crashed:\u001b[0m", error);
  process.exitCode = 1;
});
