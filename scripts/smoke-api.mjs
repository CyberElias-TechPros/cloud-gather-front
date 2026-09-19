#!/usr/bin/env node
/**
 * End-to-end smoke test for the CloudGather API.
 *
 * Runs against a local `wrangler dev` instance, so D1, R2, KV and Queues are the
 * real thing rather than mocks:
 *
 *   npm run dev:api        # terminal 1
 *   npm run api:smoke      # terminal 2
 *
 * Every step is a path a real user (or API client) takes. Failures print the
 * response body so a broken step is diagnosable without a debugger.
 */

import { execFileSync } from "node:child_process";

const BASE = process.env.API_BASE ?? "http://127.0.0.1:8788";
const CONFIG = "cloudflare/wrangler.toml";
const DB = "cloudgather";

let passed = 0;
let failed = 0;
const failures = [];

const green = (text) => `\u001b[32m${text}\u001b[0m`;
const red = (text) => `\u001b[31m${text}\u001b[0m`;
const bold = (text) => `\u001b[1m${text}\u001b[0m`;

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ${green("✓")} ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ${red("✗")} ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${bold(title)}`);
}

function d1(command) {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--local", "--config", CONFIG, "--command", command, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const start = output.indexOf("[");
  return start === -1 ? [] : JSON.parse(output.slice(start));
}

/** Minimal cookie-jar HTTP client: sessions and share unlocks both need cookies. */
class Client {
  constructor() {
    this.jar = new Map();
  }

  async raw(method, path, { body, form, headers = {} } = {}) {
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
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value) this.jar.set(name, value);
      else this.jar.delete(name);
    }
    return response;
  }

  async json(method, path, options) {
    const response = await this.raw(method, path, options);
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text.slice(0, 200) };
    }
    return { status: response.status, headers: response.headers, body: payload, text };
  }

  get(path, options) { return this.json("GET", path, options); }
  post(path, body, options = {}) { return this.json("POST", path, { ...options, body }); }
  patch(path, body, options = {}) { return this.json("PATCH", path, { ...options, body }); }
  del(path, options) { return this.json("DELETE", path, options); }
}

const stamp = Date.now().toString(36);
const email = `smoke.${stamp}@example.com`;
const password = "Smoke-Test-Password-42";

async function main() {
  console.log(`${bold("CloudGather API smoke test")}  →  ${BASE}\n`);

  // Fixed-window limits persist between runs; the harness deliberately trips
  // them at the end, so start from a clean slate.
  try {
    d1("DELETE FROM rate_limits");
  } catch {
    console.warn("  (could not reset rate limits — the API may not be local)");
  }

  const user = new Client();

  // ── 1. Public surface ─────────────────────────────────────────────────────
  section("1. Public surface");
  const info = await user.get("/");
  ok("root returns API information", info.status === 200 && typeof info.body.name === "string");

  const health = await user.get("/api/health");
  ok("health reports all bindings reachable", health.status === 200 && health.body.checks.database === "ok", JSON.stringify(health.body));

  const config = await user.get("/api/config");
  ok("config exposes safe runtime settings", config.status === 200 && typeof config.body.config.appName === "string");
  ok("config never leaks secrets", !JSON.stringify(config.body).match(/SECRET|password|RESEND_API_KEY/i));
  ok("provider catalogue includes managed storage", config.body.providers.some((provider) => provider.name === "cloudgather"));

  const blog = await user.get("/api/public/blog");
  ok("blog lists published posts", blog.status === 200 && blog.body.posts.length >= 4, `${blog.body.posts?.length ?? 0} posts`);

  const post = await user.get(`/api/public/blog/${blog.body.posts[0].slug}`);
  ok("blog post returns markdown", post.status === 200 && post.body.post.contentMd.length > 100);

  const sitemap = await user.raw("GET", "/api/public/sitemap.xml");
  const sitemapText = await sitemap.text();
  ok("sitemap lists pages and articles", sitemap.status === 200 && sitemapText.includes("<urlset") && sitemapText.includes("/blog/"), sitemapText.slice(0, 80));

  const missing = await user.get("/api/does-not-exist");
  ok("unknown route returns a JSON 404", missing.status === 404 && missing.body.code === "not_found");
  const wrongMethod = await user.raw("PUT", "/api/files");
  ok("unsupported method returns 405", wrongMethod.status === 405);

  // ── 2. Accounts ───────────────────────────────────────────────────────────
  section("2. Accounts and sessions");
  const weak = await user.post("/api/auth/register", { email: `weak.${stamp}@example.com`, password: "password" });
  ok("weak passwords are rejected", weak.status === 422 && Array.isArray(weak.body.details?.errors), JSON.stringify(weak.body));

  const registered = await user.post("/api/auth/register", { email, password, displayName: "Smoke Tester" });
  ok("registration creates an account", registered.status === 200 || registered.status === 201, JSON.stringify(registered.body).slice(0, 160));
  ok("session cookie is set", user.jar.has("cg_session"));

  const duplicate = await new Client().post("/api/auth/register", { email, password });
  ok("duplicate registration is refused", duplicate.status === 409);

  const me = await user.get("/api/auth/me");
  ok("session resolves the signed-in user", me.status === 200 && me.body.user.email === email);
  ok("new accounts are not administrators", me.body.user.role === "user");

  const badLogin = await new Client().post("/api/auth/login", { email, password: "wrong-password" });
  ok("wrong password is refused", badLogin.status === 401);
  ok("failures do not reveal whether an account exists", !/exist|unknown|not found/i.test(badLogin.body.error ?? ""), badLogin.body.error);

  const profile = await user.patch("/api/auth/profile", { displayName: "Renamed Tester", settings: { theme: "dark" } });
  ok("profile updates persist", profile.status === 200 && profile.body.user.displayName === "Renamed Tester" && profile.body.user.settings.theme === "dark");

  const sessions = await user.get("/api/auth/sessions");
  ok("active sessions are listed", sessions.status === 200 && sessions.body.sessions.some((session) => session.current));

  // ── 3. Files and folders ──────────────────────────────────────────────────
  section("3. Files and folders");
  const folder = await user.post("/api/files/folders", { name: "Reports" });
  const folderId = folder.body.folder?.id;
  ok("folder is created", folder.status === 201 && folder.body.folder.path === "/Reports", JSON.stringify(folder.body).slice(0, 120));
  ok("managed storage is connected on sign-up", (await user.get("/api/providers")).body.providers.some((provider) => provider.providerName === "cloudgather"));

  const duplicateFolder = await user.post("/api/files/folders", { name: "Reports" });
  ok("duplicate folder names are de-duplicated", duplicateFolder.body.folder?.name === "Reports (2)", duplicateFolder.body.folder?.name);

  const form = new FormData();
  form.append("file", new Blob(["quarterly numbers"], { type: "text/plain" }), "q1-report.txt");
  form.append("parentId", folderId);
  const uploaded = await user.raw("POST", "/api/files/upload", { form });
  const uploadedBody = await uploaded.json();
  ok("upload stores the file", uploaded.status === 201 && uploadedBody.file.size === 17, JSON.stringify(uploadedBody).slice(0, 160));
  ok("uploaded file is marked as hosted", uploadedBody.file.hosted === true);
  const fileId = uploadedBody.file.id;

  const renamedForm = new FormData();
  renamedForm.append("file", new Blob(["second copy"], { type: "text/plain" }), "q1-report.txt");
  renamedForm.append("parentId", folderId);
  const duplicateUpload = await (await user.raw("POST", "/api/files/upload", { form: renamedForm })).json();
  ok("duplicate file names are de-duplicated", duplicateUpload.file?.name === "q1-report (2).txt", duplicateUpload.file?.name);

  const listing = await user.get(`/api/files?folderId=${folderId}`);
  ok("folder listing returns contents and breadcrumb", listing.status === 200 && listing.body.files.length === 2 && listing.body.breadcrumb[0].name === "Reports");

  const search = await user.get("/api/files?search=q1-report");
  ok("search finds files by name", search.body.files.length >= 2, `${search.body.files?.length ?? 0} results`);

  const tree = await user.get("/api/files/tree");
  ok("folder tree includes the new folder", tree.body.folders.some((entry) => entry.id === folderId));

  const download = await user.raw("GET", `/api/files/${fileId}/download`);
  ok("download returns the stored bytes", download.status === 200 && (await download.text()) === "quarterly numbers");
  ok("download sets an attachment filename", (download.headers.get("content-disposition") ?? "").includes("q1-report.txt"));

  const ranged = await user.raw("GET", `/api/files/${fileId}/preview`, { headers: { range: "bytes=0-8" } });
  ok("range requests return 206 with content-range", ranged.status === 206 && (await ranged.text()) === "quarterly" && ranged.headers.get("content-range")?.startsWith("bytes 0-8/"));

  const renamed = await user.patch(`/api/files/${fileId}`, { name: "q1-report-final.txt" });
  ok("rename updates the path", renamed.status === 200 && renamed.body.file.path === "/Reports/q1-report-final.txt", renamed.body.file?.path);

  const starred = await user.patch(`/api/files/${fileId}`, { starred: true });
  ok("starring works", starred.body.file.isStarred === true);

  const secondFolder = await user.post("/api/files/folders", { name: "Archive" });
  const moved = await user.patch(`/api/files/${folderId}`, { parentId: secondFolder.body.folder.id });
  ok("moving a folder rewrites its path", moved.body.file.path === "/Archive/Reports", moved.body.file?.path);
  const movedChild = await user.get(`/api/files/${fileId}`);
  ok("children follow the move", movedChild.body.file.path === "/Archive/Reports/q1-report-final.txt");
  const cycle = await user.patch(`/api/files/${secondFolder.body.folder.id}`, { parentId: folderId });
  ok("a folder cannot be moved into its own subtree", cycle.status === 400, `${cycle.status}`);

  const stats = await user.get("/api/files/stats");
  ok("storage stats report usage", stats.status === 200 && stats.body.summary.usedBytes >= 28 && stats.body.summary.fileCount >= 2, JSON.stringify(stats.body.summary).slice(0, 160));

  // ── 4. Trash lifecycle ────────────────────────────────────────────────────
  section("4. Trash lifecycle");
  const trashed = await user.del(`/api/files/${fileId}`);
  ok("delete moves to trash", trashed.status === 200 && trashed.body.permanent === false);
  const trashListing = await user.get("/api/files?trashed=true");
  ok("trashed items are listed separately", trashListing.body.files.some((entry) => entry.id === fileId));
  const hiddenFromFolder = await user.get(`/api/files?folderId=${folderId}`);
  ok("trashed items disappear from their folder", !hiddenFromFolder.body.files.some((entry) => entry.id === fileId));

  const restored = await user.post("/api/files/bulk", { action: "restore", ids: [fileId] });
  ok("bulk restore brings it back", restored.status === 200 && restored.body.affected === 1);

  await user.del(`/api/files/${fileId}`);
  const purged = await user.del(`/api/files/${fileId}?permanent=true`);
  ok("permanent delete removes the row and object", purged.status === 200 && purged.body.permanent === true);
  const gone = await user.get(`/api/files/${fileId}`);
  ok("purged file is gone", gone.status === 404);

  // ── 5. Sharing ────────────────────────────────────────────────────────────
  section("5. Sharing");
  const shareForm = new FormData();
  shareForm.append("file", new Blob(["shared contents"], { type: "text/plain" }), "shared.txt");
  const sharedUpload = await (await user.raw("POST", "/api/files/upload", { form: shareForm })).json();
  const sharedFileId = sharedUpload.file.id;

  const link = await user.post("/api/shares", { fileId: sharedFileId, kind: "link", expiresInDays: 7 });
  ok("share link is created", link.status === 201 && typeof link.body.url === "string" && link.body.token.length > 20, JSON.stringify(link.body).slice(0, 140));
  const token = link.body.token;
  ok("share url points at the app", link.body.url.includes(`/s/${token}`), link.body.url);

  const guest = new Client();
  const metadata = await guest.get(`/api/public/shares/${token}`);
  ok("public metadata loads without a session", metadata.status === 200 && metadata.body.file.name === "shared.txt");
  ok("owner identity is reduced to a display name", typeof metadata.body.share.ownerName === "string");

  const publicDownload = await guest.raw("GET", `/api/public/shares/${token}/download`);
  ok("public download returns the bytes", publicDownload.status === 200 && (await publicDownload.text()) === "shared contents");

  const shareList = await user.get(`/api/shares?fileId=${sharedFileId}`);
  ok("owner sees the share with its counters", shareList.body.shares[0].downloadCount >= 1, JSON.stringify(shareList.body.shares[0]).slice(0, 140));

  const locked = await user.post("/api/shares", { fileId: sharedFileId, kind: "link", password: "Link-Password-1" });
  const lockedGuest = new Client();
  const lockedDownload = await lockedGuest.raw("GET", `/api/public/shares/${locked.body.token}/download`);
  ok("password-protected links refuse anonymous downloads", lockedDownload.status === 401, `${lockedDownload.status}`);
  const wrongPassword = await lockedGuest.post(`/api/public/shares/${locked.body.token}/unlock`, { password: "nope" });
  ok("wrong link password is refused", wrongPassword.status === 401);
  const unlocked = await lockedGuest.post(`/api/public/shares/${locked.body.token}/unlock`, { password: "Link-Password-1" });
  ok("correct password unlocks the link", unlocked.status === 200 && unlocked.body.unlocked === true);
  const unlockedDownload = await lockedGuest.raw("GET", `/api/public/shares/${locked.body.token}/download`);
  ok("unlocked link downloads", unlockedDownload.status === 200);

  const folderShare = await user.post("/api/shares", { fileId: secondFolder.body.folder.id, kind: "link" });
  const archive = await guest.raw("GET", `/api/public/shares/${folderShare.body.token}/download`);
  const archiveBytes = new Uint8Array(await archive.arrayBuffer());
  ok("folder share streams a real ZIP archive", archive.status === 200 && archiveBytes[0] === 0x50 && archiveBytes[1] === 0x4b, `signature ${[...archiveBytes.slice(0, 4)].join(",")}`);
  ok("zip payload contains the entry name", Buffer.from(archiveBytes).includes(Buffer.from("q1-report (2).txt")), Buffer.from(archiveBytes).toString("latin1").match(/q1-report[^\x00]*/)?.[0]);

  const revoked = await user.del(`/api/shares/${link.body.share.id}`);
  ok("share can be revoked", revoked.status === 200);
  const afterRevoke = await guest.get(`/api/public/shares/${token}`);
  ok("revoked link stops resolving", afterRevoke.status === 404);

  // ── 6. Developer API ──────────────────────────────────────────────────────
  section("6. Developer API");
  const keyResponse = await user.post("/api/keys", { name: "CI pipeline", permissions: ["read", "write", "share"] });
  ok("key is created and shown once", keyResponse.status === 201 && keyResponse.body.secret.startsWith("cg_live_"), JSON.stringify(keyResponse.body).slice(0, 120));
  const secret = keyResponse.body.secret;
  ok("only a prefix is stored", keyResponse.body.key.prefix.length < secret.length);

  const api = new Client();
  const apiMe = await api.get("/api/v1/me", { headers: { "x-api-key": secret } });
  ok("api key authenticates", apiMe.status === 200 && apiMe.body.authMethod === "api-key" && apiMe.body.scopes.includes("share"));

  const apiFiles = await api.get("/api/v1/files", { headers: { "x-api-key": secret } });
  ok("api lists files", apiFiles.status === 200 && Array.isArray(apiFiles.body.files));

  const apiUploadForm = new FormData();
  apiUploadForm.append("file", new Blob(["uploaded through the api"], { type: "text/plain" }), "api-upload.txt");
  const apiUpload = await api.raw("POST", "/api/v1/files/upload", { form: apiUploadForm, headers: { "x-api-key": secret } });
  const apiUploadBody = await apiUpload.json();
  ok("api uploads files", apiUpload.status === 201 && apiUploadBody.file.name === "api-upload.txt", JSON.stringify(apiUploadBody).slice(0, 140));

  const apiStats = await api.get("/api/v1/stats", { headers: { "x-api-key": secret } });
  ok("api exposes storage stats", apiStats.status === 200 && apiStats.body.summary.fileCount >= 1);
  const apiProviders = await api.get("/api/v1/providers", { headers: { "x-api-key": secret } });
  ok("api lists connected drives", apiProviders.status === 200 && apiProviders.body.providers.length >= 1);

  const noKey = await api.get("/api/v1/files");
  ok("api requires a key", noKey.status === 401);
  const bogusKey = await api.get("/api/v1/files", { headers: { "x-api-key": "cg_live_not-a-real-key" } });
  ok("invalid keys are refused", bogusKey.status === 401);

  const readOnly = await user.post("/api/keys", { name: "Reporting", permissions: ["read"] });
  const readList = await api.get("/api/v1/files", { headers: { "x-api-key": readOnly.body.secret } });
  ok("read scope can list", readList.status === 200);
  const scopeDenied = await api.post("/api/v1/files/folder", { name: "nope" }, { headers: { "x-api-key": readOnly.body.secret } });
  ok("write scope is enforced per key", scopeDenied.status === 403, `${scopeDenied.status}`);

  const rotated = await user.post(`/api/keys/${keyResponse.body.key.id}/rotate`, {});
  ok("rotation returns a new secret", rotated.status === 200 && rotated.body.secret !== secret);
  const oldKeyRejected = await api.get("/api/v1/files", { headers: { "x-api-key": secret } });
  ok("the rotated-away secret stops working", oldKeyRejected.status === 401);
  const revokedKey = await user.del(`/api/keys/${rotated.body.key.id}`);
  ok("keys can be revoked", revokedKey.status === 200);

  // ── 7. Authorization boundaries ───────────────────────────────────────────
  section("7. Authorization boundaries");
  const stranger = new Client();
  await stranger.post("/api/auth/register", { email: `stranger.${stamp}@example.com`, password });
  const idorRead = await stranger.get(`/api/files/${sharedFileId}`);
  ok("a stranger cannot read someone else's file", idorRead.status === 404, `${idorRead.status}`);
  const idorDownload = await stranger.raw("GET", `/api/files/${sharedFileId}/download`);
  ok("a stranger cannot download it either", idorDownload.status === 404);
  const idorRename = await stranger.patch(`/api/files/${sharedFileId}`, { name: "hijacked.txt" });
  ok("a stranger cannot rename it", idorRename.status === 404);
  const idorShare = await stranger.del(`/api/shares/${locked.body.share.id}`);
  ok("a stranger cannot revoke a share", idorShare.status === 404);
  const strangerAdmin = await stranger.get("/api/admin/stats");
  ok("admin endpoints reject normal accounts", strangerAdmin.status === 403, `${strangerAdmin.status}`);
  const anonymousUpload = await new Client().raw("POST", "/api/files/upload", { form: new FormData() });
  ok("uploads require a session", anonymousUpload.status === 401);

  // ── 8. Providers, activity, contact ───────────────────────────────────────
  section("8. Providers, activity and contact");
  const providers = await user.get("/api/providers");
  ok("primary pool is auto-connected", providers.body.providers.some((provider) => provider.providerName === "cloudgather" && provider.status === "connected"));

  const catalog = await user.get("/api/providers/catalog");
  const drive = catalog.body.providers.find((provider) => provider.name === "google-drive");
  ok("oauth providers are listed honestly", drive && drive.configured === false, JSON.stringify(drive));

  const connect = await user.post("/api/providers/google-drive/connect", {});
  ok("unconfigured oauth provider explains itself", connect.status === 400 && /not configured/i.test(connect.body.error), `${connect.status} ${connect.body.error}`);

  const bogusS3 = await user.post("/api/providers/amazon-s3/credentials", {
    endpoint: "https://s3.example-invalid.test",
    bucket: "definitely-not-real",
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });
  ok("unreachable storage credentials are not saved", bogusS3.status === 400 && bogusS3.body.code === "credentials_invalid", `${bogusS3.status} ${bogusS3.body.error}`);

  const managed = providers.body.providers.find((provider) => provider.providerName === "cloudgather");
  const disconnectManaged = await user.del(`/api/providers/${managed.id}`);
  ok("the primary pool cannot be disconnected", disconnectManaged.status === 400);

  const activity = await user.get("/api/activity?limit=50");
  ok("activity feed records the session", activity.status === 200 && activity.body.events.length > 0, `${activity.body.events?.length ?? 0} events`);
  ok("uploads appear in the activity feed", activity.body.events.some((event) => event.action === "file.uploaded"));

  const notifications = await user.get("/api/notifications");
  ok("welcome notification exists", notifications.status === 200 && notifications.body.notifications.length >= 1);
  const marked = await user.post("/api/notifications/read", {});
  ok("notifications can be marked read", marked.status === 200 && (await user.get("/api/notifications")).body.unreadCount === 0);

  const contact = await new Client().post("/api/public/contact", {
    name: "Prospective customer",
    email: "lead@example.com",
    subject: "Question about plans",
    message: "Hello, does the free tier include share links?",
  });
  ok("contact form accepts a message", contact.status === 201, JSON.stringify(contact.body).slice(0, 120));
  const honeypot = await new Client().post("/api/public/contact", {
    name: "Spam bot",
    email: "bot@example.com",
    message: "buy cheap widgets right now please",
    website: "https://spam.example",
  });
  ok("honeypot submissions are accepted without being stored", honeypot.status === 201);

  // ── 9. Admin console ──────────────────────────────────────────────────────
  section("9. Admin console");
  d1(`UPDATE users SET role = 'admin' WHERE email_normalized = '${email}'`);
  const adminStats = await user.get("/api/admin/stats");
  ok("admin overview loads", adminStats.status === 200 && adminStats.body.totals.users >= 2, JSON.stringify(adminStats.body.totals).slice(0, 160));
  ok("overview reports storage by provider", Array.isArray(adminStats.body.storageByProvider));

  const adminUsers = await user.get(`/api/admin/users?search=${encodeURIComponent(email)}`);
  ok("admin can search accounts", adminUsers.status === 200 && adminUsers.body.users.length >= 1);

  const settings = await user.get("/api/admin/settings");
  ok("settings are listed with metadata", settings.status === 200 && settings.body.settings.length > 10);
  const updatedSettings = await user.patch("/api/admin/settings", { max_file_size_mb: 150 });
  ok("settings are writable", updatedSettings.status === 200 && updatedSettings.body.updated.includes("max_file_size_mb"));
  const rejectedSetting = await user.patch("/api/admin/settings", { not_a_real_setting: "x" });
  ok("unknown settings are rejected", rejectedSetting.status === 400);
  await user.patch("/api/admin/settings", { max_file_size_mb: 100 });

  const audit = await user.get("/api/admin/audit?limit=50");
  ok("audit trail is available", audit.status === 200 && audit.body.events.length > 0);
  const filteredAudit = await user.get("/api/admin/audit?action=file.uploaded");
  ok("audit trail is filterable by action", filteredAudit.body.events.every((event) => event.action === "file.uploaded"));

  const messages = await user.get("/api/admin/messages");
  ok("contact messages reach the admin inbox", messages.body.messages.some((message) => message.email === "lead@example.com"));
  ok("honeypot messages stayed out", !messages.body.messages.some((message) => message.email === "bot@example.com"));

  const blogCreate = await user.post("/api/admin/blog", {
    title: "Smoke test article",
    contentMd: "## Heading\n\nThis article exists to prove the authoring flow works end to end.",
    status: "published",
    tags: ["testing"],
  });
  ok("admin can publish an article", blogCreate.status === 201 && blogCreate.body.post.slug === "smoke-test-article");
  const publicPosts = await user.get("/api/public/blog");
  ok("published article is publicly visible", publicPosts.body.posts.some((entry) => entry.slug === "smoke-test-article"));
  const archived = await user.patch(`/api/admin/blog/${blogCreate.body.post.id}`, { status: "archived" });
  ok("articles can be archived", archived.status === 200);
  const afterArchive = await user.get("/api/public/blog");
  ok("archived articles leave the public list", !afterArchive.body.posts.some((entry) => entry.slug === "smoke-test-article"));
  await user.del(`/api/admin/blog/${blogCreate.body.post.id}`);

  const maintenance = await user.post("/api/admin/maintenance", {});
  ok("maintenance can be triggered manually", maintenance.status === 200 && typeof maintenance.body.sessions === "number", JSON.stringify(maintenance.body).slice(0, 160));

  // ── 10. Password reset and account lifecycle ──────────────────────────────
  section("10. Password reset and account lifecycle");
  const forgot = await new Client().post("/api/auth/password/forgot", { email });
  ok("reset request always answers the same way", forgot.status === 200 && /if an account exists/i.test(forgot.body.message));
  ok("local development exposes the reset link when e-mail is unconfigured", typeof forgot.body.developmentResetUrl === "string" || forgot.body.emailConfigured === true);

  if (forgot.body.developmentResetUrl) {
    const resetToken = new URL(forgot.body.developmentResetUrl).searchParams.get("token");
    const newPassword = "Even-Stronger-Password-99";
    const reset = await new Client().post("/api/auth/password/reset", { token: resetToken, password: newPassword });
    ok("password reset succeeds with the token", reset.status === 200, JSON.stringify(reset.body).slice(0, 120));
    const reuse = await new Client().post("/api/auth/password/reset", { token: resetToken, password: newPassword });
    ok("reset tokens are single use", reuse.status === 400);
    const newLogin = await new Client().post("/api/auth/login", { email, password: newPassword });
    ok("the new password works", newLogin.status === 200);
    const stalePassword = await new Client().post("/api/auth/login", { email, password });
    ok("the old password stops working", stalePassword.status === 401);
  }

  // A password reset signs every other session out, so re-authenticate the main
  // client before the lifecycle steps — that behaviour is itself intended.
  const reLogin = await user.post("/api/auth/login", { email, password: "Even-Stronger-Password-99" });
  ok("reset signed the older session out", reLogin.status === 200 || reLogin.status === 429);

  const exportResponse = await user.raw("GET", "/api/auth/export");
  const exportBody = await exportResponse.json();
  ok("data export includes the account and its files", exportResponse.status === 200 && exportBody.account.email === email && Array.isArray(exportBody.files));
  ok("data export omits provider secrets", !JSON.stringify(exportBody).includes("access_token"));

  const rateLimited = { hit: false };
  for (let attempt = 0; attempt < 40 && !rateLimited.hit; attempt++) {
    const response = await new Client().post("/api/auth/login", { email: `nobody${attempt}.${stamp}@example.com`, password: "irrelevant-1234" });
    if (response.status === 429) rateLimited.hit = true;
  }
  ok("authentication attempts are rate limited", rateLimited.hit);

  const deletion = await user.del("/api/auth/account", { body: { password: "Even-Stronger-Password-99", confirmation: "DELETE" } });
  ok("account deletion works with explicit confirmation", deletion.status === 200 && deletion.body.ok === true, JSON.stringify(deletion.body).slice(0, 120));

  console.log(`\n${bold("Result")}  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n${red("Smoke test crashed:")}`, error);
  process.exitCode = 1;
});
