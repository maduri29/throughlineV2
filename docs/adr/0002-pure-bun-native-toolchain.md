# ADR-0002: Pure-Bun native toolchain — no Vite, no Node runtime

Status: accepted

Throughline's app runs entirely on Bun 1.4.0's native stack: dev serving via `Bun.serve`
with HTML imports and `development:{hmr:true}` under `bun --hot`, production via
`bun build ./index.html --outdir dist --minify` served statically by a second `Bun.serve`.
Vite is not used and Node never executes anything. The product owner mandated the
single-runtime stack; it was then proven empirically end-to-end (React 19 +
@xyflow/react 12.11 + zustand, TypeScript 7.0.2 strict typecheck, oxfmt/oxlint gates all
green) — copy-exact recipe in `research/bun-native-proof.md`.

## Considered options

- **Vite under Bun runtime** (`bun --bun vite`): recommended hybrid at decision time;
  rejected by product owner. Vite targets Node APIs and Bun's own bundler/HMR proved
  sufficient, so the extra moving part buys nothing here.
- **Node-runtime scripts**: rejected — violates the single-runtime constraint.

## Consequences

- tsconfig must set `"types": ["bun"]`; an ambient `*.html` module declaration
  (`bun-html.d.ts`) is required — neither ships automatically.
- `.oxfmtrc.json` `ignorePatterns` must exist before the first format run (config-less
  oxfmt formats everything including `dist/` and markdown).
- Lint gates use `oxlint --deny-warnings` (warnings alone exit 0).
- Non-interactive render checks need Edge headless wrapped in `cmd /c` with a fresh
  `--user-data-dir` and `--virtual-time-budget`.
