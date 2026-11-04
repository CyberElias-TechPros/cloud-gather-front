# Android implementation audit and release plan

## Scope / architecture

The requested delivery is a native Android application, not a web wrapper. A new
independent Gradle project under `android/` uses Kotlin, Compose, Material 3,
activity-scoped session state, lifecycle-aware screen loading, OkHttp and
WorkManager. No website build output or web runtime enters the APK. Browser
consent screens for OAuth and external privacy/terms references are intentional
external activities, not the application UI. The existing website was not removed.

The Worker, D1, R2 and provider adapters remain the source of truth. Native app
features call the existing private API. Native OAuth and signed-in support required
small additive backend changes. No production backend deployment was performed.

## Findings addressed

| Finding | Change |
| --- | --- |
| No Android project | Independent Kotlin/Compose project, SDK 26–36, Gradle wrapper and build workflow |
| Browser session handling is unsuitable for Android | Keystore-backed authenticated encryption; no backups or plaintext fallback |
| Browser OAuth returns a session token in a URL | Native S256/state-bound flow; only short-lived one-use code reaches the custom scheme |
| OAuth return URL accepted arbitrary destinations | Restrict login to configured app origin/exact handoff; provider return allowlist |
| Concurrent authorization exchanges could create duplicate sessions | Atomic `DELETE ... RETURNING`, tested wrong-verifier/non-consumption, expiry, replay and parallel redemption |
| Social login must not bypass native MFA | Native exchange creates an MFA challenge instead of a session for 2FA accounts |
| Signed-in native support cannot render web Turnstile | Authenticated `/api/contact/mine` POST binds sender identity server-side, preserves verified-email policy and per-user throttling; anonymous CAPTCHA unchanged |
| Browser uploads/downloads do not survive activity lifecycle | WorkManager, persisted SAF grants, optional local notifications, cancellation and owner-scoped jobs |
| Large files should not occupy one huge client buffer | Stream small multipart requests; known-size large uploads use bounded API part buffers |
| Transient share grants can disappear | Private staging with file-size limits, successful-transfer deletion and logout cleanup |
| Storage apps must not ask for broad device access | Scoped Android document picker/create-document and narrow FileProvider roots |
| Embedded checkout would obscure a Play release requirement | Purchases disabled, existing entitlements visible; Play Billing explicitly a release gate |
| Destructive actions need intent confirmation | Native confirmation dialogs for trash purge, account/session/key/share/admin deletions |
| Integrations must not fake successful setup | Server catalogue/configuration flags and explicit API errors |

## Validation actually performed in this sandbox

- Worker TypeScript check: **passed**.
- Existing frontend TypeScript check: **passed** (regression check, not a new web app).
- Existing Vitest suite: **69 tests passed**.
- New Worker native-auth test suite: **14 tests passed**.
- All four D1 SQL migrations applied in order to fresh in-memory SQLite: **passed**.
- Kotlin grammar parsing and Android XML well-formedness: **passed**; this is
  syntax checking, **not Kotlin type checking or an Android compilation**.
- Gradle attempt: **blocked**, `JAVA_HOME` unset and no Java executable; no SDK
  or emulator installed. Google's Maven/SDK hosts are outside the sandbox allowlist.
- Android JVM tests, lint, APK/AAB assembly and emulator tests: **not executed**.
  They are supplied in `.github/workflows/android.yml` for a suitable runner.
- Production API connectivity, OAuth providers, storage credentials, mail and
  device transfers: **not tested**. Do not infer that existing production settings
  or any third-party credentials are valid.

The native test sources cover HTTP authentication boundaries, redirect refusal,
API errors/no-content responses, file value normalization, native form validation,
file-row interaction, and Keystore round-trip/ciphertext. They still need execution.

## P0 — before calling the Android app functional

1. Run the new CI workflow and fix any compilation, dependency or lint failures.
2. Apply migration 0004 and deploy the changed Worker in a staging environment.
3. Exercise actual API contracts on an emulator and physical device, especially:
   - register/login, failed login, session expiry and revocation;
   - sign-in MFA and recovery codes; provider browser cancel/error/return;
   - each configured OAuth and credential provider, browsed folder IDs, sync/import/export;
   - empty/unknown-size/large file upload, version replacement and quota rejection;
   - transfer while backgrounded, screen rotation, process termination, no network,
     revoked URI grants, cancellation and sign-out/account switching;
   - share by email, received download, password/public link expiry/download cap;
   - trash and descendant folders, restore, permanent purge and version restoration;
   - security settings, device/session revoke, support CAPTCHA boundary and admin authorization.
4. Audit backend multipart completion/idempotency/quota races and provider behavior
   under failure. Native jobs intentionally do not promise exactly-once completion
   or cross-process resume. Distinguish a lost response from a failed upload.
5. Review existing backend social account-linking/email-verification and browser
   MFA behavior separately. Native exchange protections are not an audit of all
   existing server authentication paths.

## P1 — before distributing through Google Play

- Play Billing or a documented eligible alternative-distribution/payment program;
  verify purchase tokens server-side, handle renewals/refunds/revocations and
  reconcile account entitlements. Do not just restore Stripe web checkout links.
- Permanent application ID review, release version policy, upload-key custody,
  Play App Signing, actual SHA-256 certificate and verified App Links hosting.
- Privacy policy and terms as first-class native-readable content, store listing,
  account-deletion disclosure/URL, Data safety form and permission explanations.
- Dynamic analysis for token/secret leaks, dependency audit, production log review.
- TalkBack labels/traversal, contrast, 200% text, RTL, translation extraction,
  tablet layout, Android 8 through 16, constrained RAM and storage, battery quota.
- External OAuth error/cancel UX and verified email/reset routing into the app.

## P2 — feature parity / product improvements

- Complete the advanced controls listed in `android/README.md`; replace free-text
  enum fields with server-driven native selectors throughout.
- Provider remote cursor paging where adapters actually support continuation.
- Rich invoice details/cancellation management after billing-policy decisions.
- Offline, account-scoped encrypted metadata index with an explicit stale-data
  indicator and opt-in encrypted offline files, not misleading cached successes.
- FCM with backend device-token lifecycle, preference-aware push and deep links.
- Biometric reauthentication for local vault access and sensitive operations.
- Persistent multipart checkpoints plus server-side idempotency before safe retry.
- Upload preflight for available capacity, battery/network policy and progress by
  bytes; user-friendly names for all persisted in-progress jobs.
- Native preview rendering if a bundled viewer is desired; current preview uses
  installed Android viewers with a narrowly scoped URI grant.
- Product telemetry only after consent/privacy design; baseline crash-free sessions,
  time to first file, transfer completion, failed provider refresh and search latency.

## Definition of done

A green build alone is not “everything works.” Release requires successful
end-to-end acceptance on real devices against deployed configuration, all P0/P1
items resolved, signed artifacts, documented support/recovery procedures and no
misleading or fake-success flows. This change is a substantial native starting
implementation with explicit limits, not a certification of production readiness.
