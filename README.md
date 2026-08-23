# Throughline

Brainstorm stories, grow them into movies or series, and write scenes as
screenplay — one local-first story graph behind every view.

**Stack:** Next.js 16 (App Router) · React 19 · React Flow 12 · IndexedDB ·
TypeScript 7 strict · Bun for install, tests and the lint/format gates

## Run locally

```bash
bun install
cd app
bun run dev        # http://localhost:4517
```

## Gates

```bash
cd app
bun run check      # fmt + lint + typecheck + tests
bun run build      # next build → app/.next  (route `/` prerenders static)
bun run verify:ui  # 13 headless assertions; dev server must be running
```

The editor is loaded with `ssr: false` (`src/app/ClientApp.tsx`) because it is a
browser application — IndexedDB, CodeMirror and React Flow all need a real DOM.
The route still prerenders as static HTML, so delivery is CDN-only. See ADR-0006.

## Sync (optional, ADR-0005)

The app is local-first and works with no account. Sync adds a server copy so work
survives losing the machine and follows you between devices.

1. Create a project at [supabase.com](https://supabase.com)
2. **SQL Editor** -> paste `supabase/migrations/0001_story_graph.sql` -> **Run**
3. **Settings -> API**: copy the **Project URL** and the **publishable**
   (`sb_publishable_...`) key
4. **Authentication -> URL Configuration**: add the origin you use (e.g.
   `http://localhost:4517`) to **Redirect URLs**, or the sign-in link will 404
5. In the app: **Sign in** in the header → paste the URL and publishable key →
   **Connect**, then enter your email and open the link it sends
6. **Library → Cloud copies**: **Push** sends the open story, **Pull** brings a
   cloud copy back

Connecting a project and signing in are separate screens in that dialog, because
they are separate jobs — the first is one-time technical setup, the second is
routine. Story sync lives in the Library, not in the sign-in flow.

Never put the **secret** (`sb_secret_...`) key in the app or this repo. The
publishable key is safe in the bundle *only* because every table has row level
security scoped to `auth.uid()` — that is what step 2 installs. A table without
RLS is a public API to anyone holding the key. The Connect form refuses an
`sb_secret_` or `service_role` key rather than storing it (`validateConfig`).

Two behaviours to know before relying on this:

- **Push is last-write-wins per project, not collaboration.** It replaces the
  cloud copy of that story outright. Two devices editing the same story at once
  will lose one side's edits.
- **Pull arrives as a new local story**, re-validated through the same importer
  as a backup file. Nothing local is overwritten, so pulling twice gives you two
  copies rather than silently eating your edits.

## Deploy (Vercel)

The app is local-first: all story data lives in your browser's IndexedDB,
so the production build is fully static and serves from Vercel's edge CDN.

1. Import `maduri29/throughlineV2` at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** — see the table below; it decides which config is read
3. Deploy — the matching `vercel.json` supplies the Bun install/build commands

**Current status (2026-08-23):** the Git integration is **not connected** —
pushes to `main` do *not* deploy. Deploys go through the CLI from the repo root:

```bash
bunx vercel login        # once per machine, interactive
cd app && bunx vercel --prod --yes   # Next build; Root Directory must be `app`
```

Production alias: <https://storylane2.vercel.app>. The sections below apply
if/when the Git integration gets connected.

### Root Directory decides which vercel.json applies

**Root Directory must be `app`.** Vercel's Next.js preset expects the project at
the configured root, so the previous two-config arrangement (repo root *or*
`app/`) no longer applies — the repo-root `vercel.json` was removed rather than
left to produce a broken deploy. `app/vercel.json` sets the framework preset and
`bun install`; Vercel supplies the build and output itself.

If Root Directory is still blank from the pre-Next setup, change it in
**Project → Settings → Build and Deployment → Root Directory**, or the build
fails with no `next.config.ts` found.

### Commit author must resolve to a GitHub account

Vercel's Git integration refuses to build a commit whose author email does
not map to a GitHub user, and reports it as *"Fix Git Configuration"*. It
means the **commit**, not your global git config.

```bash
# what Vercel accepts — resolves to a real account
git log -1 --format='%ae'        # e.g. you@example.com  -> github_user: you

# what halts deployment
#                                # e.g. agent@local      -> github_user: null
```

Verify any commit before wondering why it did not deploy:

```bash
gh api repos/maduri29/throughlineV2/commits/<sha> \
  --jq '{email: .commit.author.email, github_user: .author.login}'
```

A `github_user` of `null` is the blocker. Automated/agent sessions committing
here must not override `user.email` with a non-routable address such as
`*@local`, or every push silently stops deploying.
