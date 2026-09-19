#!/usr/bin/env python3
"""Generates `migrations/0002_seed.sql` — default settings, provider catalogue and
the launch blog posts.

Content lives here rather than in raw SQL so apostrophes and quotes are escaped
mechanically instead of by hand (a single unescaped quote is a syntax error).

    python3 cloudflare/scripts/gen-seed.py
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "migrations" / "0002_seed.sql"


def q(value: str) -> str:
    """SQL string literal with quotes escaped."""
    return "'" + str(value).replace("'", "''") + "'"


SETTINGS = [
    ("app_name", "CloudGather", "Product name shown across the interface"),
    ("app_description", "One home for every cloud drive.", "Short product description used in metadata"),
    ("app_version", "1.0.0", "Released application version"),
    ("maintenance_mode", "false", "When true, only administrators can use the app"),
    ("registration_enabled", "true", "Allow new accounts to be created"),
    ("email_verification_required", "false", "Require e-mail confirmation before uploading"),
    ("max_file_size_mb", "100", "Largest single upload accepted, in megabytes"),
    ("default_quota_gb", "50", "Storage granted to a new account, in gigabytes"),
    ("allowed_file_types", "", "Comma separated list of allowed extensions; empty allows everything"),
    ("support_email", "support@cloudgather.app", "Address shown in help and legal pages"),
    ("trash_retention_days", "30", "Days a deleted item stays recoverable"),
    ("session_ttl_days", "30", "How long a signed-in session stays valid"),
    ("max_sessions_per_user", "10", "Maximum concurrent sessions per account"),
    ("max_api_keys_per_user", "25", "Maximum active developer keys per account"),
    ("max_providers_per_user", "12", "Maximum connected drives per account"),
    ("api_rate_limit_per_minute", "120", "Developer API requests allowed per key per minute"),
    ("auth_rate_limit_per_15min", "30", "Authentication attempts allowed per address"),
    ("upload_rate_limit_per_hour", "300", "Uploads allowed per account per hour"),
    ("share_default_expiry_days", "30", "Default expiry applied to new share links"),
    ("max_share_expiry_days", "365", "Upper bound for share link expiry"),
    ("allow_public_links", "true", "Allow links that anyone with the URL can open"),
    ("provider_sync_enabled", "true", "Allow browsing and importing from connected drives"),
    ("notify_on_share", "true", "E-mail the recipient when a file is shared with them"),
]

# name, display, auth_type, scopes, is_enabled, doc url
PROVIDERS = [
    ("cloudgather", "CloudGather Storage", "managed", "", 1, "https://developers.cloudflare.com/r2/"),
    ("google-drive", "Google Drive", "oauth", "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email", 1, "https://developers.google.com/drive/api/guides/about-sdk"),
    ("dropbox", "Dropbox", "oauth", "files.content.read account_info.read", 1, "https://www.dropbox.com/developers/documentation/http/documentation"),
    ("onedrive", "Microsoft OneDrive", "oauth", "offline_access Files.Read User.Read", 1, "https://learn.microsoft.com/graph/api/resources/onedrive"),
    ("box", "Box", "oauth", "root_readonly", 1, "https://developer.box.com/reference/"),
    ("pcloud", "pCloud", "oauth", "managefiles", 1, "https://docs.pcloud.com/"),
    ("yandex-disk", "Yandex Disk", "oauth", "cloud_api:disk.read", 1, "https://yandex.com/dev/disk-api/doc/en/"),
    ("amazon-s3", "Amazon S3", "credentials", "", 1, "https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html"),
    ("backblaze-b2", "Backblaze B2", "credentials", "", 1, "https://www.backblaze.com/docs/cloud-storage-s3-compatible-api"),
    ("wasabi", "Wasabi", "credentials", "", 1, "https://docs.wasabi.com/docs/s3-api-introduction"),
    ("custom-s3", "Any S3-compatible storage", "credentials", "", 1, "https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html"),
]

OAUTH_ENDPOINTS = {
    "google-drive": (
        "https://accounts.google.com/o/oauth2/v2/auth",
        "https://oauth2.googleapis.com/token",
    ),
    "dropbox": ("https://www.dropbox.com/oauth2/authorize", "https://api.dropboxapi.com/oauth2/token"),
    "onedrive": (
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    ),
    "box": ("https://account.box.com/api/oauth2/authorize", "https://api.box.com/oauth2/token"),
    "pcloud": ("https://my.pcloud.com/oauth2/authorize", "https://api.pcloud.com/oauth2_token"),
    "yandex-disk": ("https://oauth.yandex.com/authorize", "https://oauth.yandex.com/token"),
}

POSTS = [
    {
        "slug": "storage-sprawl-is-a-search-problem",
        "title": "Storage sprawl is really a search problem",
        "excerpt": "Ten years of cloud storage gave most of us five drives, four accounts and no idea where anything is. The fix is not another drive.",
        "tags": ["product", "workflow"],
        "author": "CloudGather Team",
        "read_minutes": 6,
        "published_at": "2026-02-18T09:00:00.000Z",
        "cover_image": "/og/blog-storage-sprawl.png",
        "content_md": """Every freelancer, small studio and operations team we talk to has the same
shape of problem. The files are not lost. They are spread.

A design draft lives in Google Drive because that is what the client uses. The
raw footage lives in Dropbox because that is what the editor pays for. The
invoices live in OneDrive because Microsoft 365 came bundled. The archive lives
in an S3 bucket nobody has opened since the migration. Individually each choice
made sense. Together they produce a daily tax: open four tabs, remember which
client is on which service, download a file to attach a file.

## Why "just move everything" fails

Consolidation projects stall for three predictable reasons:

1. **Cost.** Egress fees punish exactly the move you want to make.
2. **Risk.** Bulk migrations break sharing links that other people still depend on.
3. **Time.** Nobody has a weekend to babysit a transfer of two terabytes.

So the drives stay. The sprawl is not a mistake to be corrected; it is the
reality to be managed.

## What actually helps

The useful question is not "where should this file live" but "where is it, and
can I use it from here".

That reframes the problem into three capabilities:

- **One index.** Names, sizes, locations and owners across every connected drive,
  searchable from a single box.
- **One place to act.** Preview, download, rename, star or share without first
  working out which provider holds the file.
- **One audit trail.** Who shared what, when the link expires, which keys are
  live — so the sprawl does not become a liability during an incident.

CloudGather is built on that premise. Connect the drives you already pay for,
keep them where they are, and work from a single surface. Nothing is duplicated,
nothing is migrated, and the file you need stops being a tab-hunting exercise.

If you want to see it against your own drives, create an account and connect
one — the first connection takes about a minute.
""",
    },
    {
        "slug": "share-links-that-expire",
        "title": "Share links should expire in a week, not in five years",
        "excerpt": "Permanent public URLs are the quiet default of cloud storage. Here is how CloudGather handles expiry, download limits and revocation.",
        "tags": ["security", "sharing"],
        "author": "CloudGather Team",
        "read_minutes": 5,
        "published_at": "2026-03-04T09:00:00.000Z",
        "cover_image": "/og/blog-share-links.png",
        "content_md": """Most file leaks are not dramatic. They happen because a link created for a
single conversation in 2021 still works in 2026.

Default share settings are where this gets decided, so we made the safe option
the fast one.

## What a CloudGather link contains

A share link is an opaque random token — 24 bytes, URL-safe. It does not contain
a filename, a user id or a sequential number, so links cannot be guessed or
enumerated, and the URL itself leaks nothing about your drive.

Behind the token, the link carries real policy:

- **Expiry.** Choose a day, a week, a month or a year. Expired links stop
  resolving immediately — no grace period, no cached copy.
- **Download limits.** Cap how many times a link can be used when you are
  sending a document to a specific person.
- **Password protection.** Optional, hashed with PBKDF2-SHA256 before it is
  stored. A correct password sets a scoped, signed cookie so the browser does
  not resend it on every byte range request.
- **Instant revocation.** Deleting a share invalidates the token on the next
  request, not on the next cache purge.

## Folder links

Sharing a folder shares the tree beneath it without exposing the rest of your
drive. Recipients can browse the folder, preview individual files and download
the whole thing as a streamed ZIP archive.

## Visibility you can act on

Every share appears in the file's share panel with its view count, download
count and last access time. When a link is doing more work than you expected,
you can revoke it in one click — and every revocation is written to your audit
trail with the timestamp and the file it referred to.

Expiry is a small feature. It is also the difference between a link that served
its purpose and a link that outlives your intentions.
""",
    },
    {
        "slug": "api-keys-and-scoped-access",
        "title": "Designing API keys you can revoke at 2am",
        "excerpt": "Scoped keys, hashed storage and instant revocation: how the developer API is built so a leaked key is a contained incident.",
        "tags": ["engineering", "api"],
        "author": "CloudGather Team",
        "read_minutes": 7,
        "published_at": "2026-03-22T09:00:00.000Z",
        "cover_image": "/og/blog-api-keys.png",
        "content_md": """A leaked credential should cost you a revoked key, not a weekend.

That constraint shaped the CloudGather developer API more than any performance
target, and it produced four decisions worth explaining.

## 1. Keys are shown once and stored hashed

When you create a key, the full secret appears in the interface exactly once.
The server stores a SHA-256 hash and a short display prefix — never the secret.
If our database were ever exposed, the values in it cannot be replayed against
the API.

## 2. Scope is explicit per key

Every key carries the smallest set of scopes it needs:

| Scope | Allows |
| --- | --- |
| `read` | List files, read metadata, download |
| `write` | Create folders, upload, rename, move, delete |
| `share` | Create and revoke share links |

A key created for a reporting script gets `read`. When someone swaps it for a
key that can also delete files, that is a deliberate act, not an accident.

## 3. Rate limits are per key

Limits apply to the key, not to your account, so one runaway loop cannot starve
the rest of your integrations. Exceeding the limit returns `429` with a
`retry-after` header and a JSON body that names the limit that was hit.

## 4. Revocation is immediate

Rotating or revoking a key takes effect on the next request. Because the
validation path is a single indexed lookup against the hash, there is no cache
to wait out.

```bash
curl https://api.cloudgather.app/api/v1/files \\
  -H "x-api-key: cg_live_…"
```

Keys also carry an optional expiry date. For CI jobs and temporary integrations
that is the cheapest security control available: the credential retires itself.

Read the full reference in the [developer docs](/developers), or create a key in
[API keys](/settings/api-keys) and try the sandbox request there.
""",
    },
    {
        "slug": "what-belongs-in-the-trash",
        "title": "Deleting is a promise you have to keep",
        "excerpt": "Why trash has a retention window, what permanent delete really does, and how we make sure your bytes are actually gone.",
        "tags": ["product", "privacy"],
        "author": "CloudGather Team",
        "read_minutes": 4,
        "published_at": "2026-04-09T09:00:00.000Z",
        "cover_image": "/og/blog-trash.png",
        "content_md": """Two deletion behaviours live in every storage product, and they mean
different things.

**Trash** is a reversible mistake-correction tool. In CloudGather, deleting an
item stamps it as trashed: it disappears from your file browser, stops being
searchable, and any share link pointing at it stops resolving. The bytes stay in
your storage, so restoring is instant and lossless. Trashed items are retained
for 30 days by default and then removed by the nightly maintenance job.

**Permanent delete** is a promise. It removes the database rows, deletes every
object from storage, tears down the shares that referenced the file and clears
the folder membership of everything inside it. When it returns, the data is
gone.

Folder deletion is recursive on purpose. Deleting a folder with 400 files and
leaving them behind would be a strange kind of lie.

## Where the copies go

Files stored in CloudGather storage live in Cloudflare R2. Permanent deletion
calls the object store directly rather than marking a pointer, so no orphaned
object survives the request. Files that live in a connected drive are never
deleted from that drive by CloudGather — disconnecting removes our index of
them, nothing more. Your data stays yours, in the account you already pay for.

## Recovering a mistake

Restore from the trash view, individually or in bulk. Restoration puts items
back in the folder they came from; if that folder is gone, they return to your
root folder rather than vanishing.
""",
    },
]

sql: list[str] = [
    "-- Generated by cloudflare/scripts/gen-seed.py — do not edit by hand.",
    "-- Seeds default settings, the provider catalogue and the launch articles.",
    "",
    "INSERT INTO system_settings (key, value, description) VALUES",
]
sql.append(",\n".join(f"  ({q(k)}, {q(v)}, {q(d)})" for k, v, d in SETTINGS))
sql.append("ON CONFLICT (key) DO NOTHING;")
sql.append("")

provider_rows = []
for name, display, auth_type, scopes, enabled, doc in PROVIDERS:
    authorize, token = OAUTH_ENDPOINTS.get(name, ("", ""))
    provider_rows.append(
        "  ("
        + ", ".join(
            [
                q(name),
                q(display),
                q(auth_type),
                q(authorize),
                q(token),
                q(scopes),
                str(enabled),
                # Managed storage needs no operator credentials; OAuth providers do
                # until an administrator adds a client id and secret.
                "1" if auth_type in ("managed", "credentials") else "0",
            ]
        )
        + ")"
    )

sql.append(
    "INSERT INTO provider_configs (provider_name, display_name, auth_type, authorize_url, token_url, scopes, is_enabled, is_configured) VALUES"
)
sql.append(",\n".join(provider_rows))
sql.append("ON CONFLICT (provider_name) DO NOTHING;")
sql.append("")

post_rows = []
for post in POSTS:
    tags = "[" + ",".join(f'"{t}"' for t in post["tags"]) + "]"
    post_rows.append(
        "  ("
        + ", ".join(
            [
                q("post_" + post["slug"].replace("-", "_")),
                q(post["slug"]),
                q(post["title"]),
                q(post["excerpt"]),
                q(post["content_md"]),
                q(post["cover_image"]),
                q(tags),
                q("published"),
                q(post["author"]),
                str(post["read_minutes"]),
                q(post["published_at"]),
                q(post["published_at"]),
            ]
        )
        + ")"
    )

sql.append(
    "INSERT INTO blog_posts (id, slug, title, excerpt, content_md, cover_image, tags, status, author, read_minutes, published_at, created_at) VALUES"
)
sql.append(",\n".join(post_rows))
sql.append("ON CONFLICT (slug) DO NOTHING;")
sql.append("")

OUT.write_text("\n".join(sql))
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
