# Throughline storage and Turso connection

Firebase Authentication handles email/password sign-in. Turso stores account membership and writing data once connected. Firebase does not currently store story content.

## Where data lives

| Data | Local copy | Cloud copy after connection |
| --- | --- | --- |
| Stories, scenes, characters, relationships, reference metadata | Account-specific browser IndexedDB | Turso `account_sync_nodes` and `account_sync_edges` |
| Saved Boneyard ideas, collections and immutable revisions | IndexedDB `boneyard` | Turso `account_sync_boneyard` |
| Uploaded PDF/image bytes | IndexedDB `files` | None; attachment names and sizes can sync but bytes remain local |
| Unsubmitted Boneyard drafts | Account-specific browser local storage | None |
| Undo history, local settings and conflict recovery copies | Browser storage | None |
| Login accounts and password authentication | Firebase-managed session persistence | Firebase Authentication, project `throughline-3b2dd` |
| Admitted users, usernames and the five-account cap | Development SQLite registry before connection | Turso `throughline_accounts` after migration |

Browser databases use `throughline.v1.user.<Firebase UID>`. Each browser/site address has its own storage: localhost and a future hosted URL do not share local copies. The old `throughline.v1` database is preserved for explicit import. Writing data is not stored as ordinary files in the repository. Exports download JSON writing backups or screenplay files; the JSON backup does not include attachment bytes.

The original development account registry remains at `app/.throughline-accounts.db`. Server configuration and credentials belong in ignored `app/.env.local`, never client variables or Git. The invitation code is server configuration, not a Firebase password.

## Connect Turso

1. Sign in to the Turso dashboard with the account that should own this database. Create a dedicated Throughline database on the free plan.
2. Copy its `libsql://...` database URL and create a database-scoped read/write access token. Put them in `app/.env.local` as `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Do not share the token in chat or put it in a `NEXT_PUBLIC_` variable.
3. From `app`, run `bun migrate-accounts-to-turso.ts` (or `npx --yes bun migrate-accounts-to-turso.ts` if Bun is not on PATH). This preserves existing registered users and keeps the original development database intact. It does not migrate browser writing; that is uploaded by each user after sign-in.
4. Restart the development server. On a hosted deployment, configure the same server environment variables and deploy again; never use the development SQLite file as a hosted database.
5. Sign in and open Profile → Save and sync. Confirm storage is reachable and sync completes. Use a second independent browser session to confirm that stories and saved Boneyard ideas arrive. Test attachments separately: their bytes intentionally remain local.

## How sync protects writing

The browser stores its last confirmed cloud snapshot and compares it with current writing. Only changed graph records are uploaded. Every change includes the cloud record version it was based on. Turso validates these versions inside a write transaction. A stale edit rolls back the complete graph upload and returns both versions for review, rather than overwriting another device.

Deleted records remain as cloud tombstones, so an older device cannot resurrect them. In Profile → Save and sync, conflicts offer **Download both versions**, **Keep this device’s versions**, and **Use cloud versions**. Resolving a conflict also retains a recovery copy in local browser storage. A subsequent edit from another device can produce another conflict; choosing a version does not bypass version checks.

Boneyard revision history is merged separately using immutable revision IDs. A graph success with a Boneyard failure is reported as partial, not full success. Uploaded attachments are outside both sync protocols.

Automatic sync runs when the workspace opens and every sixty seconds while visible. Profile provides manual sync. Local saving continues offline; cross-device availability requires a reachable server and Turso database. Sync is not simultaneous collaborative editing or a substitute for downloaded backups.

## Verification scope

`verify-account-api.ts` tests private identities, real SQL transactions, stale-write rejection, idempotency, tombstones and atomic rollback with synthetic Firebase identities. `verify-login.ts` tests the real browser storage and UI, independent browser sessions, conflict choices and deletion using simulated Firebase/cloud responses. These checks do not demonstrate a live Turso connection; that requires step 5 above.

## Active local connection — October 3, 2026

The local app is connected to the dedicated `throughline` database in the `maduri29` Turso organization, using the `aws-us-west-2` endpoint on the free plan. Both existing registered accounts were migrated and the original local registry was retained. The owner profile completed an initial sync successfully.

The approved database-scoped read/write token expires January 1, 2027. Renew it before that date, replace `TURSO_AUTH_TOKEN` in ignored `app/.env.local`, and restart the app server. Do not invalidate all database tokens as a routine renewal step. Hosted deployments need their own server environment configuration.

`bun verify-live-cloud.ts` passed eight assertions using actual Firebase Authentication, actual Turso and two independent headless browser contexts. It verified story and saved Boneyard transfer, repeat sync without a conflict, mobile profile layout, owner-only invitation privacy and sign-out/sign-in restoration. Test fixtures remain in the existing test account. This script uses its ignored credential file and is an explicit live test, not an automatic unit test.

The temporary development-only credential setup endpoint and form used for this connection were removed after the token was saved. The local site remains at `http://localhost:4517`; connecting Turso does not publish the application to a public URL.
