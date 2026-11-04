# CloudGather — native Android

A standalone **Kotlin + Jetpack Compose / Material 3 Android application**.
There is no WebView, Capacitor, Cordova, browser-rendered app shell, React Native,
or dependency on the Vite build. The existing Cloudflare Worker remains the
shared API, not the Android UI. The older browser client has been preserved to
avoid destroying existing deployments; it is not packaged into this application.

**Delivery status:** native source implementation, not a verified production
release. No APK has been built in the Arena sandbox: Java, the Android SDK and an
emulator are unavailable, and the network allowlist excludes Google's Android
artifact repositories. The supplied GitHub Actions workflow must pass, followed
by device/backend acceptance testing, before this is described as a working,
release-ready Android product. Billing purchases are explicitly not implemented.

## Open and build

1. Open **this `android/` directory** in current Android Studio.
2. Install JDK 17, Android SDK Platform 36 and Build Tools 36.0.0. Accept SDK licences.
3. Sync Gradle, select an API 26+ emulator or an Android 8+ physical phone, and Run.

```sh
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
./gradlew connectedDebugAndroidTest      # requires a running emulator/device
./gradlew bundleRelease                  # unsigned; configure signing for release
```

Outputs, after a successful build:

- `app/build/outputs/apk/debug/app-debug.apk` — installable debug build
- `app/build/outputs/bundle/release/app-release.aab` — unsigned release bundle

The **Native Android** workflow runs JVM tests, lint, builds and emulator smoke
tests, and uploads artifacts. It is included, not executed by this session. No
credentials or signing keys are committed. Use Android Studio's Generate Signed
Bundle / APK flow and keep your upload key outside the repository.

## API and deployment

The default API is `https://cloudgather-api.cyber-e54.workers.dev/api` (taken from
the repository's backend deployment workflow; connectivity was not tested here).
Override it at build time for another HTTPS deployment:

```sh
./gradlew assembleDebug -PCLOUDGATHER_API_URL=https://your-api.example/api
```

Never put provider secrets, personal API keys or server signing secrets in
`BuildConfig`. Android does not require browser CORS permissions.

**Deploy the backend changes before testing native social sign-in and support:**

```sh
# From the repository root, with your existing Cloudflare configuration/secrets
npm ci
npm run cf:typecheck
npm run cf:test
npx wrangler d1 migrations apply cloudgather --remote --config wrangler.production.toml
npx wrangler deploy --config wrangler.production.toml
```

Migration `0004_android_oauth.sql` is additive. Native social sign-in needs it;
email/password authentication still uses the original auth API. Provider OAuth
redirect URIs registered with Google/Dropbox/etc. remain Worker HTTPS callbacks;
**do not register the Android custom scheme as a provider callback**.

## Native feature coverage

| Area | Implemented Android surface |
| --- | --- |
| Access | Sign in/register, TOTP/recovery-code challenge, reset request/confirmation, verification token entry |
| Home | Live dashboard, usage, announcements, unread counts, recent files |
| Files | Folder navigation, paginated list, sort, cross-cloud search, saved searches, starred/recent/trash lists |
| Management | Create folders, rename, description/tags, native move destination picker, copy, trash, restore/purge selection, empty trash |
| Transfers | Android Storage Access Framework upload/save pickers; WorkManager network constraints, foreground notification, progress/cancel; 8 MiB chunked API uploads for known-size files over 8 MiB |
| Sharing integration | Android SEND/SEND_MULTIPLE inbound file upload; system share sheet for newly created public links |
| Previews | Open image/PDF/plain text/audio/video through an installed native viewer using temporary content-URI access, not a WebView |
| Versions | Upload replacement, list versions, restore earlier version |
| Sharing | Email invitations, sent/received lists, received downloads, permission edits/revocation, expiring/password/download-limited public links, visits/revocation |
| Public access | Paste link/token, password unlock, save permitted files; does not bypass disabled downloads |
| Clouds | Capability-driven catalogue; OAuth in system browser; native credential forms, browse/search/folder navigation, sync, disconnect, index/copy imports, copy files to connected-cloud root |
| Account | Profile name/timezone, local system/light/dark theme, data export, deletion request/cancellation, sign out |
| Security | Keystore-encrypted session, password change, email verification, authenticator setup/disable/recovery codes, device/session revocation, unlink identities |
| Notifications | Live list, read/delete/read-all and basic preference editing |
| Billing | Existing subscription, entitlements and invoice summaries, **read-only** |
| Developers | API key creation/one-time reveal/rotation/revocation; webhook create/edit/test/delete, secret reveal on creation, delivery results |
| Support | Enquiries/replies and authenticated native ticket creation without embedding a CAPTCHA |
| Admin | Role-gated metrics, paginated users/edit/reset/revoke/delete, audit, settings, support replies, blog CRUD/duplicate, announcements/broadcast, email flush, maintenance controls |

Errors are surfaced rather than replaced with fabricated data. Server roles,
quotas and capabilities remain authoritative. Changes requiring paid features or
unconfigured integrations can be rejected by the API and display its explanation.

## Security and platform decisions

- Sessions and pending OAuth verifiers use AES-GCM with a non-exportable Android
  Keystore key. Backups and cleartext HTTP are disabled. Keystore invalidation
  requires another sign-in; there is no plaintext fallback.
- Native OAuth uses S256, random client state, a two-minute one-use code and an
  atomic D1 redemption. The custom-scheme return carries **no bearer token**.
  The exchange respects suspended accounts and issues an MFA challenge before
  creating a session when 2FA is enabled.
- Redirects are restricted server-side. The Android HTTP client does not follow
  redirects with bearer credentials. No passwords or tokens are logged.
- File selection uses scoped document grants, not storage-management permissions.
  Work records store account ownership and URIs, not session credentials. Public
  link access paths are encrypted in the vault instead of WorkManager's database.
- Inbound transient shares are staged in private app storage (128 MB per-file
  cap); successful staged uploads are deleted. Old abandoned staging is reclaimed
  on later share imports; sign-out clears staging and preview caches.
- Previews are capped at 50 MB and temporarily grant a selected viewer access to
  that file. Saving a download explicitly creates a user-owned file which remains
  on the device after sign-out. Cancelling a download may leave a partial file;
  remove it or choose the destination again when retrying.
- Upload creation/completion is not automatically retried because the existing
  server API is not idempotent. Re-select a file to retry; inspect the file list
  first if the connection failed during completion. Multipart sessions abandoned
  by process death expire via the backend's existing upload cleanup.
- Android notification permission is optional. In-app transfer status remains
  available when notification permission is declined. Background execution is
  subject to OS/battery restrictions and Android foreground-job quotas.

## Remaining work / release gates

This is not an assertion of complete feature parity or Play Store readiness.
See [the Android audit](../docs/ANDROID-AUDIT.md) for the prioritized checklist.
In particular:

- Run the build/lint/tests and real-device provider/transfer acceptance matrix.
- Implement Google Play Billing (plus server purchase verification and entitlement
  reconciliation) before exposing paid digital-storage upgrades in a Play build.
  No Stripe checkout buttons are embedded or linked from this client.
- Configure verified HTTPS App Links with the **real release certificate** and
  deploy `assetlinks.json`; email/reset/public links currently use explicit token
  entry or paste inside the app rather than verified automatic routing.
- Add FCM/server delivery if push alerts are required. Current notifications are
  fetched in-app; background transfer notifications are local, not FCM.
- Complete advanced parity: avatars, full notification preference defaults,
  provider priority/default/rename, remote cursor paging, all search filters,
  bulk move/unstar, editable public links, API-key scope edits, newsletter admin,
  richer storage charts, and complete marketing/legal content as native content.
- No persistent offline catalogue, file pinning, biometric lock, camera scanning,
  auto camera upload or cross-process multipart resume is claimed.
- Extract the initial English UI strings into localized resources; run TalkBack,
  large-text, RTL, tablet, rotation, dark-mode and low-memory acceptance tests.
