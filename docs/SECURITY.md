# Security

- No production secrets are committed or exposed to Vite.
- Passwords use PBKDF2-SHA-256 with 210,000 iterations and random salts.
- Session tokens, reset tokens, and personal API keys are stored only as hashes.
- Reset tokens are single-use and expire after one hour.
- User ownership is enforced in every private Worker query; admin endpoints verify the server-side role.
- API keys enforce read/write/share permissions.
- R2 is private; downloads pass through an authenticated endpoint.
- CORS uses an exact origin allowlist and responses include request IDs and `nosniff`.
- Uploads are capped at 100 MB and D1 constraints enforce relationship and naming integrity.
- Account deletion removes R2 objects before cascading D1 records.

Operational controls still required at deployment: Cloudflare WAF/rate-limit rules, log drains/alerts, D1 backups, R2 lifecycle policy, provider-secret rotation, and email-domain verification.
