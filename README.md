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
bun run verify:ui  # 39 headless assertions; dev server must be running
```

The editor is loaded with `ssr: false` (`src/app/ClientApp.tsx`) because it is a
browser application — IndexedDB, CodeMirror and React Flow all need a real DOM.
The route still prerenders as static HTML, so delivery is CDN-only. See ADR-0006.

## Storage

Everything lives in this browser: IndexedDB via a normalized adapter (ADR-0001),
with `navigator.storage.persist()` requested at boot so the browser stops
treating it as evictable.

There is no account, no server and no network dependency of any kind — a
`verify:ui` assertion checks the app makes no third-party requests at all.
**Back up** in a story writes a lossless JSON envelope; **Import backup** reads
one, validating rather than trusting it.

The Supabase sync tier was removed in ADR-0008. Multi-device continuity is the
open problem, not a solved one.

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
