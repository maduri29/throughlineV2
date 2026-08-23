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

## Deploy (Vercel)

The app is local-first: all story data lives in your browser's IndexedDB,
so the production build is fully static and serves from Vercel's edge CDN.

1. Import `maduri29/throughlineV2` at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** — see the table below; it decides which config is read
3. Deploy — the matching `vercel.json` supplies the Bun install/build commands

Every push to `main` auto-deploys, provided the commit author is a real
GitHub account (see below).

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
