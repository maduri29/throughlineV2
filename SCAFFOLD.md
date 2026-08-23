# SCAFFOLD.md — T7 execution log (2026-08-22)

Executed directly by agent/ox-alpha after two delegated runners died without producing
anything. Everything below ran under Bun only (`bun`, `bunx`, `cmd` driving Edge); Node
was never used as runtime.

**Location note:** built at `C:\dev\throughline`, then relocated same-day to
`C:\Users\madur\work\throughline` at human request (git history intact).

## Relocation (COPY-first, not move)

- Created fresh; copied `IDEAS.md`, `RESEARCH.md`, `CONTEXT.md`,
  `docs/`, `research/`, `prototype/`, `.wayfinder/`; `git init` at root.
- **Deviation from ticket:** COPY instead of MOVE — the interactive session still uses the
  OneDrive path as cwd; moving it out would break the live session. The OneDrive folder is
  a frozen pre-relocation snapshot awaiting deletion.
- From this point on, `.wayfinder/` HERE is the tracker source of truth.

## App package (`app/`) — per research/bun-native-proof.md recipe

```
app/
├── package.json        scripts: dev/build/serve/typecheck/fmt/fmt:check/lint/check(aggregate)
├── tsconfig.json       TS7 strict + noUncheckedIndexedAccess + bundler + types:["bun"]
├── .oxfmtrc.json       ignorePatterns dist/** (set BEFORE first format run)
├── .oxlintrc.json      plugins react/unicorn/typescript/oxc
├── bun-html.d.ts       ambient *.html module (import("bun").HTMLBundle)
├── index.html          entry: ./src/main.tsx via HTML import pipeline
├── server.dev.ts       Bun.serve + routes{"/":index} + development:{hmr:true} :4517 (+ /boot)
├── server.static.ts    static dist server :4518
└── src/
    ├── main.tsx  App.tsx  GraphNode.tsx  store.ts  demo.ts  types.ts  styles.css
```

- Skeleton renders the locked Map direction (Beat-board cards × Storyline bands +
  flashback lane + typed-edge colors) over the seeded HIGH WATER graph; persistence =
  zustand → idb-keyval (normalized ADR-0001 adapter lands during build phase).
- `src/demo.ts` = THROWAWAY SEED (26 nodes / 40 edges across project→3 episodes→15 scenes,
  D1–D12, flashbacks D-9/D-2 via flashback_of, sets_up, parallels, appears_in,
  takes_place_at, embodies, related_to) with a local uuidv7() helper.

## Gate + runtime proof (verbatim)

- `bun install` → 39 packages, 3.37s
- `bunx oxfmt` first pass formatted 15 files; `bun run check`
  (fmt:check + oxlint --deny-warnings + tsc --noEmit) → **exit 0**
- `bun run build` → `Bundled 144 modules in 68ms`; `index-t0hhe37v.js` 0.57 MB;
  merged CSS `index-s307865j.css` 17.32 KB; `index.html` 450 B
- Dev :4517 → HTTP 200; `/boot` → `{"bootMs":1787453866284,"pid":4172}`;
  headless DOM contains: Storm tips · Solo run · scaffold seed · react-flow__edge · D-9 · D-2
- Static :4518 → ROOT 200; asset 200; missing → 404; headless DOM contains
  Storm tips · Solo run · scaffold seed · react-flow__node
- Known cosmetic stderr noise (`NativeCommandError` around bun.exe progress) per proof §8.
- Initial commit `abcacc4` (34 tracked files; LF→CRLF warnings cosmetic — add a
  `.gitattributes` with `* text=auto eol=lf` during build phase if wanted).

## Run it

```powershell
cd C:\Users\madur\work\throughline\app
bun run dev     # http://localhost:4517/
bun run serve   # after bun run build → http://localhost:4518/
```
