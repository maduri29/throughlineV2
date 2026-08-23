# Throughline

Brainstorm stories, grow them into movies or series, and write scenes as
screenplay — one local-first story graph behind every view.

**Stack:** Bun · React 19 · React Flow 12 · IndexedDB · TypeScript 7 strict

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
bun run build      # static production build → app/dist
```

## Sync (optional, ADR-0005)

The app is local-first and works with no account. Sync adds a server copy so work
survives losing the machine and follows you between devices.

1. Create a project at [supabase.com](https://supabase.com)
2. **SQL Editor** -> paste `supabase/migrations/0001_story_graph.sql` -> **Run**
3. **Settings -> API**: copy the **Project URL** and the **publishable**
   (`sb_publishable_...`) key
4. **Authentication -> URL Configuration**: add the origin you use (e.g.
   `http://localhost:4517`) to **Redirect URLs**, or the sign-in link will 404
5. In the app: **Library -> Cloud sync**, paste the URL and publishable key,
   **Connect**, then sign in with a magic link — there is no password to store
6. **Push** sends the open story; **Pull** brings a cloud copy back

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
bunx vercel --prod --yes # builds via root vercel.json → app/dist
```

Production alias: <https://storylane2.vercel.app>. The sections below apply
if/when the Git integration gets connected.

### Root Directory decides which vercel.json applies

There are two configs, one per layout. They are alternatives, not partners —
pick the row matching the project's **Root Directory** setting.

| Root Directory | Config read | Build | Output |
| --- | --- | --- | --- |
| `app` | `app/vercel.json` | `bun run build` | `dist` |
| repo root (blank) | `vercel.json` | `cd app && bun run build` | `app/dist` |

Mismatching them fails confusingly: with Root Directory `app` but the root
config in force, Vercel looks for `app/app/dist` and reports an empty build.

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
