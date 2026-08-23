---
id: T1
title: Prove Bun-native fullstack with React Flow
labels: [wayfinder:task]
status: closed
assignee: agent/bun-proof-runner
blocked-by: []
---

## Question

Can Throughline v1 actually run on a **Pure-Bun, no-Vite, no-Node-runtime** toolchain with
React 19 + `@xyflow/react@12` + zustand/idb-keyval — and what are the exact working configs?

Prove it empirically in a throwaway directory **outside OneDrive** (use `C:\tln-probe`;
never touch the synced workspace):

1. Dev mode: `Bun.serve` with HTML imports serving an SPA whose entry renders a `<ReactFlow>`
   canvas with one custom node type; run under `bun --hot` and confirm HMR actually swaps a
   component edit without restarting.
2. Prod mode: `bun build` the same app and serve the output statically via `Bun.serve`;
   confirm the bundle loads and the canvas renders.
3. Verify renders non-interactively (headless Edge) for both modes.
4. Wire and run the quality gate: `typescript@^7.0.2` → `tsc --noEmit` under strict;
   `oxfmt --check`; `bunx oxlint` with plugins react/unicorn/typescript/oxc.
5. Record every gotcha plus final minimal configs verbatim.

## Resolution

Closed by agent/bun-proof-runner (2026-08-22; second attempt — first runner died before
starting anything). **All five milestones passed, nothing blocked.**

| Capability | Verdict |
|---|---|
| Dev server, no Vite (`Bun.serve` + HTML imports) | PASS — HTTP 200, assets rewritten to `/_bun/client/*` |
| HMR under `bun --hot`, zero restarts | PASS — bundle hash changed with new marker text; identical `/boot` pid before/after |
| Headless render, dev & prod | PASS — custom-node markers + flow chrome present in both |
| Prod build (`bun build … --minify`) | PASS — 144 modules ≈36 ms, CSS merged, static serve 200/404 correct |
| TS7 typecheck / oxfmt / oxlint gates | PASS — exit 0 each; `--deny-warnings` gate verified to bite |

Resolved pins: react 19.2.8 · @xyflow/react 12.11.3 · zustand 5.0.15 · idb-keyval 6.3.0 ·
typescript 7.0.2 · @types/bun 1.4.0 · oxfmt 0.64.0 · oxlint 1.79.0.

Assets: **`research/bun-native-proof.md`** (copy-exact recipe + proofs; original at
`C:\tln-probe\PROOF.md`). Decision recorded as **ADR-0002** with its non-obvious
consequences (`"types":["bun"]` + ambient html module, oxfmt ignorePatterns pre-run,
`--deny-warnings`, cmd-wrapped fresh-profile headless verification).

Unblocks **Scaffold recipe — relocate and stand up**.
