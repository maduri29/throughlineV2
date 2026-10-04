# Private Story Lane accounts

Throughline uses Firebase email/password authentication in the separate project `throughline-3b2dd`. The login screen supports username or email and password, password recovery, and **Create a new account**. The group is limited to five private workspaces.

## First account and invitations

The existing Firebase account `mukesh.dommati92@outlook.com` is connected with username `mukesh`. Use the password set directly in Firebase; it has not been changed by this implementation.

Open the login screen and choose **Create a new account** for additional users. Enter a unique username, email, a password of at least eight characters, and the invitation code. The owner can find the code in the ignored local file `app/.throughline-invite.txt`. The invitation code prevents strangers from occupying the remaining spaces. Usernames use 2–32 letters, numbers, dots, underscores or hyphens.

The server registers the verified Firebase UID in a durable account registry. A SQL write transaction checks username/email uniqueness and the five-account limit. Authentication alone is insufficient: every private API request also checks that Firebase UID and email against the registry. A manually created Firebase user must be seeded through `THROUGHLINE_ACCOUNTS`; creating users through the app registers them automatically. Failed app registration rolls back only the Firebase user just created by that form.

## Local development and hosting

Local Firebase client settings, the seeded owner account and the invitation code are already in ignored `app/.env.local`. In development, if Turso is unavailable, the account registry uses an ignored local SQLite file `app/.throughline-accounts.db`. This makes account creation persist across local server restarts.

Production deliberately requires a durable Turso database. Set these environment variables on the hosting project before rebuilding/deploying:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `THROUGHLINE_ACCOUNTS`: initial owner account with username, email and Firebase UID; no password.
- `THROUGHLINE_INVITE_CODE`: invitation secret with at least twelve characters.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: durable account registry and private cloud sync.

See [app/env.example](../app/env.example) for the format. `NEXT_PUBLIC_*` values are compiled into the client, so changes require a rebuild. Firebase client configuration is public; no Firebase service-account private key is required for ID-token verification. Add your deployed domain in Firebase Authentication's authorized domains when publishing.

No production deployment is part of this change. A local account registry is not copied automatically to production; the owner seed is created there from environment configuration, and other local accounts must be migrated or provisioned into the production registry before they can access it.

To revoke application access, remove the account's row from `throughline_accounts` and remove it from the seed configuration if present, as well as disabling the Firebase user. Merely removing a seed does not delete an account already registered. The implementation verifies Firebase token signatures, issuer, audience and expiration. It does not query Firebase revocation status on every request; registry membership is checked every time.

## Private data and sync

Each account opens `throughline.v1.user.<uid>` in IndexedDB. Boneyard drafts and sync timestamps also use that user's namespace. Signing out saves graph edits, hides the editor and reloads to dispose of the store, timers and undo history. Other tabs receive an explicit sign-out notification as well as Firebase session changes.

The server derives `user:<uid>` from the verified Firebase token and ignores client-supplied sync keys. Account graph tables and Boneyard tables use `(sync_key, id)` primary keys, preventing users importing the same document from overwriting each other's records. Old cloud sync-key tables remain intact.

With Turso configured, cloud sync runs when an account opens and every sixty seconds while the app is visible, and is also available manually. Without Turso, stories continue to save locally under the user's account. Attachments remain local under the existing sync design. This change does not add simultaneous collaborative editing. Browser storage is account-scoped, but is not encrypted against someone who can inspect the operating-system/browser profile.

## Previous local work

The old `throughline.v1` database is preserved and never automatically assigned to the first person who signs in.

On the original device, sign in to the account that owns the previous work, open **Account** to go to your profile, and choose **Import previous local work**. The destination must have no stories, Boneyard revisions or attachments. All old stores, including attachments and history, are copied in one transaction; the original database remains intact. Existing accounts with work should use the normal export/import workflows.

## Verification

- `bun test` runs unit regressions including account policy and immutable storage namespace selection.
- `bun run verify:accounts` tests private route isolation, registration, invitation checks and the five-account limit with synthetic identities and real in-memory SQL. Firebase verification is mocked only in that standalone test process.
- `bun run verify:login` drives headless Edge with synthetic Firebase responses. Browser storage, account switching, explicit legacy import, session restoration, password recovery and registration rollback are real browser operations; no real user credentials or emails are used.
- The owner's chosen password remains private and untested. `bun verify-live-login.ts` creates or reuses the explicitly requested `flowtest` account and verifies real Firebase registration/sign-in, `/profile`, the retired account-creation route redirect, owner-only invitation visibility, story and Boneyard persistence, and sign-out. Credentials are stored only in the ignored `.throughline-test-account.json`. This script changes Firebase state and is not included in automatic verification scripts.

## Profile page

**Account** opens `/profile`, with username, email, workspace privacy, save and sync, local-work import and sign-out. Signed-in users cannot create another account from the profile. The old `/profile/new-account` URL redirects to `/profile`.

Only the owner (the first account in `THROUGHLINE_ACCOUNTS`) sees **Invite users**, with the invitation code, occupied accounts and remaining spaces. The owner-only API verifies Firebase identity and registry membership and sends `Cache-Control: no-store`. Share the code privately with intended users. New users choose **Create a new account** on the signed-out sign-in screen and must enter that code. The code is reusable, and the server blocks registration once five accounts exist, including the owner. To invalidate a shared code, change `THROUGHLINE_INVITE_CODE` and restart/redeploy; existing accounts keep working. Removing that variable disables registrations.

See [cloud-storage.md](cloud-storage.md) for Turso connection, existing-account migration, storage locations, version conflicts and attachment limitations.
