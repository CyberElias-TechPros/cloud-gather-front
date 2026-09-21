# Architecture

CloudGather is a React/Vite SPA deployed to Vercel and a Cloudflare Worker API backed by D1 and private R2 storage.

```text
Browser → Vercel SPA → HTTPS → Cloudflare Worker → D1 / R2
```

## Boundaries

- The browser stores an opaque session token. D1 stores only its SHA-256 hash.
- The Worker is the sole database and object-storage boundary. Every private query is scoped to the authenticated user.
- D1 stores users, sessions, file metadata, provider metadata, shares, API keys, audit events, posts, and settings.
- R2 stores file bytes under user-prefixed keys and has no public bucket URL.
- Passwords use PBKDF2-SHA-256, 210,000 iterations, and random per-user salts.
- Personal API keys support `read`, `write`, and `share` permissions and are stored hashed.

Provider credentials never enter the frontend bundle. OAuth adapters are enabled only after their provider client secrets and callback URLs are configured in the Worker.
