# AGENTS.md — operational notes for agent sessions

Read this before touching git or deploying. Last verified: 2026-08-23.

## Gates

```bash
cd app
bun run check      # fmt + lint + typecheck + tests — must pass before commit/deploy
```

## Git identity (hard rule)

Commits must be authored by **maduri29 <gadigoppulamaduri29@gmail.com>**
(the GitHub-linked account). Never override `user.name`/`user.email` with an
agent identity (`*@local`) — that silently broke deploy attribution once and
required force-pushed history rewriting to repair. Repo-local config already
pins this identity; leave it alone.

## Deploy (Vercel)

- Project **throughline-v2** deploys via **Vercel CLI only**. Pushing to main
  does **NOT** deploy: the GitHub App integration is not connected (verified
  2026-08-23 — `gh api repos/maduri29/throughlineV2/deployments` returned 0
  despite many pushed commits, and a push-trigger commit produced nothing).
- One-time auth per machine: `bunx vercel login` (interactive browser flow;
  no token exists in `.env.local` — that file only holds a runtime OIDC token).
- Deploy from the **repo root**: `bunx vercel --prod --yes`.
  Root `vercel.json` drives it: `cd app && bun install`, `bun run build`,
  output `app/dist`.
- Production alias: <https://storylane2.vercel.app>
- Expected build warning: `Unknown lockfile version` for `bun.lock` — Vercel's
  build image runs an older Bun than local, so the install proceeds unpinned.
  Harmless today; if reproducible remote installs matter, raise the project's
  Bun runtime version in Vercel settings or downgrade the committed lockfile.
- Do not bother with empty "Trigger deployment" commits while the Git
  integration is off — they do nothing.
- To enable push-to-deploy someday: Vercel dashboard → throughline-v2 →
  Settings → Git → connect `maduri29/throughlineV2` with Root Directory set
  per the table in README.md.
