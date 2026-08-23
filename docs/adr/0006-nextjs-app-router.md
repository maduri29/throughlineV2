# ADR-0006: Next.js App Router replaces the Bun-native toolchain

Status: accepted

Supersedes **ADR-0002 (pure Bun-native toolchain)**. The application is built and served by
Next.js 16 (App Router). The Bun HTML-entrypoint build, `server.dev.ts` and `server.static.ts`
are removed. Bun remains the package manager and the test runner; it is no longer the bundler
or the web server.

## Context

Human decision (2026-08-23). The product owner asked for Next.js integration and, when shown
the trade-off below, chose a full migration of the application rather than a narrower
server-side surface.

The agent's recommendation was **not** to migrate, and that recommendation is recorded here so
a future reader does not mistake this for a technically-forced move:

- Throughline is a browser application. Story data lives in IndexedDB (ADR-0001), the editor
  measures real DOM (CodeMirror, React Flow), and the sync tier reads `localStorage`. There is
  no server-side data to render, so SSR and React Server Components have nothing to act on.
- The previous build already produced a static bundle served from Vercel's CDN. Next does not
  make delivery faster here; the route is prerendered static either way.
- ADR-0002's single-runtime property — no Node, no second bundler — is genuinely lost.

The decision was made with that understood. Next.js is the most widely used React framework,
it is first-party on Vercel where this already deploys, and it buys optionality: file-based
routing, server routes, and a share/publish surface become available without another
migration. Those were judged worth the cost.

## Considered options

- **Keep the Bun-native toolchain** (ADR-0002 unchanged). Recommended by the agent; rejected by
  the product owner.
- **Add a small Next.js server surface alongside the Bun SPA** — share links and secret-key
  work only, editor untouched. Offered as the narrower option; not chosen.
- **Migrate the whole application to the Next.js App Router.** Chosen.

## Consequences

- **The editor loads with `ssr: false`.** `src/app/ClientApp.tsx` is a thin client boundary that
  dynamically imports `App` with server rendering disabled, because `ssr: false` is only legal
  inside a client component. Prerendering the editor would fail on `indexedDB`/`window` at import
  time, or ship a shell that throws on hydration. The route still prerenders as **static** HTML
  (`○ /` in the build output), so CDN delivery is unchanged.
- **A Node runtime is now required** to build and to run the dev server. `bun install`,
  `bun test` and the oxfmt/oxlint pipeline are unaffected; `bun run dev` shells out to `next dev`.
- **The dev port stays 4517.** Not cosmetic: it is registered in the Supabase project's redirect
  allow-list (ADR-0005), and changing it would silently break magic-link sign-in.
- **`<div id="root">` is reproduced in the root layout.** `styles.css` sizes `html, body, #root`
  to full height. Recreating the element the stylesheet already expects keeps the cascade
  identical rather than rewriting layout rules during a toolchain change.
- **Deployment collapses to one supported layout.** Vercel's Next.js preset expects the project
  at the configured Root Directory, so the previous two-config arrangement (repo root *or*
  `app/`) no longer works. **Root Directory must be `app`**, and the repo-root `vercel.json` is
  removed rather than left to produce a broken deploy.
- **ADR-0001, ADR-0003, ADR-0004 and ADR-0005 are unaffected.** Storage, the undo op-log,
  autosave and the sync tier are all client-side and were not touched. The 49 unit tests and the
  13 `verify:ui` assertions pass unchanged, which is the evidence that this was a toolchain
  migration and not a behaviour change.
- **`output: "export"` was deliberately not set.** Static export would most closely mimic the old
  build, but it would foreclose the server routes that are the main reason to be on Next at all.
