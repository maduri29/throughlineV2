> Historical record, archived September 4, 2026. Instructions, scope limits, paths, and decisions below are superseded and do not govern the refactor. Links describe the original checkout and may no longer resolve.

# TLN-PROBE — Pure-Bun React Toolchain Proof (Windows 11)

**Goal:** Prove a React app can run on a Pure-Bun toolchain — no Vite, Node never used as runtime — with React 19, @xyflow/react v12, zustand (+idb-keyval), TypeScript 7 strict, oxfmt, oxlint.

**Environment (verified):** Windows 11 (`10.0.26200`), `bun -v` → `1.4.0` at `C:\Users\madur\AppData\Roaming\npm\bun.ps1`, headless Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. All commands below run via `bun`; Node.exe is never invoked.

---

## M1 — Dependencies ✅

```powershell
cd C:\tln-probe
bun init was NOT used; package.json written by hand:
{ "name": "tln-probe", "version": "0.1.0", "private": true, "type": "module" }

bun add react@19 react-dom@19 @xyflow/react zustand idb-keyval
bun add -d typescript@^7.0.2 @types/react @types/react-dom oxfmt oxlint
```

**Exact resolved versions:**

| Package          | Resolved                       |
| ---------------- | ------------------------------ |
| react            | 19.2.8                         |
| react-dom        | 19.2.8                         |
| @xyflow/react    | 12.11.3                        |
| zustand          | 5.0.15                         |
| idb-keyval       | 6.3.0                          |
| typescript       | **7.0.2** (satisfies `^7.0.2`) |
| @types/react     | 19.2.18                        |
| @types/react-dom | 19.2.4                         |
| oxfmt            | 0.64.0                         |
| oxlint           | 1.79.0                         |

Notes:

- `bun add typescript@^7.0.2` resolves cleanly on npm — TS7 (native) is published under the normal `typescript` name and ships a `tsc` binary.
- Bun printed install progress on stderr (PowerShell wraps that as `NativeCommandError` noise when redirecting `2>&1`); installs succeeded. Cosmetic only.

---

## M2 — Dev mode: Bun.serve + HTML imports under `bun --hot` ✅

**Files:** `index.html`, `server.dev.ts`, `src/main.tsx`, `src/App.tsx`, `src/MarkerNode.tsx`, `src/marker.ts`, `src/store.ts`, `src/styles.css` (full contents in M5).

**Server shape (idiomatic Bun 1.4.0):** import the HTML file itself and pass it as a route value; enable dev/HMR via `development: { hmr: true }`:

```ts
import index from "./index.html";
Bun.serve({
  port: 4517,
  routes: { "/", index },
  development: { hmr: true },
});
```

Run: `bun --hot server.dev.ts` (background job pwsh-2).

**Proof 1 — HTTP 200:** `Invoke-WebRequest http://localhost:4517/` →

```
STATUS: 200   CONTENT-TYPE: text/html;charset=utf-8
<link rel="stylesheet" href="/_bun/asset/c73c3070e17319ce.css">
<link rel="stylesheet" href="/_bun/asset/e06b9a0a0b661ae5.css">
<script type="module" crossorigin src="/_bun/client/index-00000000ece088c7.js" data-bun-dev-server-script></script>
```

Both JS-imported stylesheets (`@xyflow/react/dist/style.css` and our `styles.css`) were hoisted into `<link>` tags by the dev pipeline.

**Proof 2 — headless Edge DOM contains marker** (saved to `proof/dom-dev.html`):

```html
<span class="tln-node__marker">⬢ TLN-NODE · A</span>
<span class="tln-node__marker">⬢ TLN-NODE · B</span>
```

plus `react-flow__edge-default … data-id="edge-a-b"`, Background dots pattern, Controls panel — React 19 mounted `<ReactFlow>` with 2 custom nodes, 1 edge, Background/Controls.

**Proof 3 — HMR without server restart:**

1. `/boot` endpoint returns `{ bootMs, pid }` anchored in `globalThis` (survives `--hot` soft reloads).
   Before edit: `{"bootMs":1787451138335,"pid":25300}`
2. Edited `src/marker.ts`: `"TLN-NODE"` → `"TLN-NODE-HMR"` — **server untouched**.
3. Re-fetched `/`: bundle hash changed `index-00000000ece088c7.js` → `index-00000000d915c1a8.js`;
   new bundle contains `TLN-NODE-HMR`: **true**; stale marker still present: **false**.
4. Re-fetched `/boot`: `{"bootMs":1787451138335,"pid":25300}` — **identical ⇒ same OS process, zero restarts**.
5. Reverted marker; fresh headless dump shows `⬢ TLN-NODE · A/B` again, no `-HMR` residue.

Gotchas found in M2:

- **Headless Edge on Windows ignores PowerShell-native stdout redirection** (`msedge.exe --dump-dom > file` yields an empty file because a GUI-subsystem exe doesn't attach to the redirected handle, and an existing Edge instance hijacks the invocation unless isolated). Working recipe:
  `cmd /c ""C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --user-data-dir=<fresh-dir> --virtual-time-budget=8000 --dump-dom http://localhost:4517/"`.
  A _fresh_ `--user-data-dir` per run is mandatory on this machine (21 msedge processes were already running).
- Bun's docs page `runtime/hot` says "to get hot reloading in the browser use Vite" — **stale relative to observed 1.4.0 behavior**: with HTML imports + `development:{hmr:true}`, Bun ships its own HMR client over `/_bun/client/...js` and rebundles on request; `--hot` soft-reloads the server module graph without killing the process. Trust observation.

---

## M3 — Production build: `bun build` + tiny static Bun.serve ✅

```powershell
bun build ./index.html --outdir dist --minify
# Bundled 145 modules in 38ms
#   index-0xz7ax3e.js   0.57 MB    (entry point)
#   index-8r88zqcw.css  16.50 KB   (asset)
#   index.html          457 bytes  (entry point)
```

Observations:

- HTML entrypoint drives the whole build: the `<script type="module" src="./src/main.tsx">` was followed into the TSX graph; **both JS-imported stylesheets were merged into one hashed CSS asset** (`index-8r88zqcw.css`, includes `@xyflow/react/dist/style.css`). CSS through `bun build`: just `import "./x.css"` from TSX — no config.
- Asset URLs rewritten to _relative_ `./index-*.{js,css}` — dist is base-path agnostic.
- Output is genuinely minified (mangled top-level names like `var GO=Object.create`).

**Static server:** `server.static.ts` — ~25-line `Bun.serve` with a `fetch(req)` handler over `Bun.file` (`static:` routes can't express hashed paths dynamically). Run: `bun server.static.ts`.

Proof:

```
ROOT STATUS: 200
JS ASSET: 200 text/javascript;charset=utf-8 len=573735
CSS ASSET: 200 text/css;charset=utf-8 len=16505
MISSING ASSET STATUS: 404
```

Headless Edge against `http://localhost:4518/` (`proof/dom-prod.html`):

```html
<span class="tln-node__marker">⬢ TLN-NODE · A</span>
<span class="tln-node__marker">⬢ TLN-NODE · B</span>
```

---

## M4 — Quality gate: tsc strict (TS7) + oxfmt + oxlint ✅

### Typecheck — `bunx tsc --noEmit` → **exit 0**

- Compiler: `bunx tsc --version` → `Version 7.0.2` (the native/Go TypeScript 7, installed as plain `typescript`).
- tsconfig carries the ticket's requirements plus what TS7/Bun needed:
  `strict`, `noUncheckedIndexedAccess`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`,
  plus `module: esnext`, `verbatimModuleSyntax`, `isolatedModules`, `noEmit`.
- **TS7 gotchas (observed):**
  1. TS7 does NOT auto-load `@types/*` packages — you must set `"types": ["bun"]`. Without it:
     `error TS2868: Cannot find name 'Bun'. Do you need to install type definitions for Bun?`
     (`@types/bun@1.4.0` was added for the two server files.)
  2. No ambient declaration for Bun's HTML imports shipped with `@types/bun@1.4.0`:
     `server.dev.ts(6,19): error TS2307: Cannot find module './index.html' or its corresponding type declarations.`
     Fixed by a 10-line `bun-html.d.ts` declaring `declare module "*.html"` with
     `const html: import("bun").HTMLBundle; export default html;`
- React Flow v12 typing pattern that passes strict: `type MarkerFlowNode = Node<MarkerData, "marker">`, component takes `NodeProps<MarkerFlowNode>`, `nodeTypes = { marker: MarkerNode } satisfies NodeTypes`.

### Format — `bunx oxfmt` / `oxfmt --check` → **exit 0**

- `oxfmt@0.64.0`; `.oxfmtrc.json` created via `bunx oxfmt --init`, then extended:
  `"ignorePatterns": ["dist/**", "docs/**", "proof/**"]`.
- **Gotcha:** with no config, oxfmt formats EVERYTHING it walks — first run reformatted 43 files including `dist/` build artifacts, fetched docs HTML, and this PROOF.md. Always add ignorePatterns before first run.
- Final state: `All matched files use the correct format.` on 15 files.

### Lint — `bunx oxlint --deny-warnings` → **exit 0**

- `oxlint@1.79.0`; `.oxlintrc.json`:

```json
{
  "plugins": ["react", "unicorn", "typescript", "oxc"],
  "ignorePatterns": ["node_modules/**", "dist/**", "docs/**", "proof/**"]
}
```

- **Gotchas (observed):**
  1. Outside a git repo (no `.gitignore`), bare `bunx oxlint` scanned `node_modules` and emitted ~400 warnings from `oxfmt`'s own bundled `jiti-*.js`. Fixed with `.gitignore` + explicit `ignorePatterns`.
  2. On success oxlint prints **nothing** when stdout is piped/non-TTY — exit code is the only signal. Verified the gate works both ways by planting a violation: `const erased = 42 * 0;` → `warning oxc(erasing-op)` printed; warnings alone still exit 0, so use `--deny-warnings` in CI → planted violation exits **1**, clean tree exits **0**.
  3. The four requested plugins load fine; default-enabled rules are conservative (most react-plugin rules need explicit enabling) — zero findings in probe sources even before tuning.

Post-format re-verification (all green): `tsc --noEmit` exit 0 · `oxfmt --check` exit 0 · `oxlint --deny-warnings` exit 0 · dev server returned 200 and hot-reloaded the formatted files without restart.

---

## M5 — Copy-exact recipe

### File tree

```
C:\tln-probe\
├── .gitignore
├── .oxfmtrc.json
├── .oxlintrc.json
├── bun-html.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── server.dev.ts          # M2 dev server (Bun.serve + HTML imports + HMR)
├── server.static.ts       # M3 static server for ./dist
├── src\
│   ├── App.tsx
│   ├── MarkerNode.tsx
│   ├── main.tsx
│   ├── marker.ts          # marker string; edited live for the HMR proof
│   ├── store.ts           # zustand persist -> idb-keyval (IndexedDB)
│   └── styles.css
├── dist\                  # generated by bun build (hashed assets)
└── PROOF.md               # this file
```

### Commands, in order

```powershell
# 0. prereq: bun 1.4.0 already installed (`bun -v`)
mkdir C:\tln-probe ; cd C:\tln-probe

# 1. manifest (write minimal package.json by hand — see below)

# 2. deps
bun add react@19 react-dom@19 @xyflow/react zustand idb-keyval
bun add -d typescript@^7.0.2 @types/react @types/react-dom oxfmt oxlint @types/bun

# 3. write source/config files exactly as listed below

# 4. dev mode (terminal 1)
bun --hot server.dev.ts            # -> http://localhost:4517/

# 5. production build + static serve (terminal 2)
bun run build                      # = bun build ./index.html --outdir dist --minify
bun server.static.ts               # -> http://localhost:4518/

# 6. quality gate
bunx tsc --noEmit
bunx oxfmt
bunx oxfmt --check
bunx oxlint --deny-warnings
```

Every step runs under **Bun only** (`bun`, `bunx`, or plain `cmd` driving Edge). Node.exe is never invoked.

### Full file contents

**package.json**

```json
{
  "name": "tln-probe",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --hot server.dev.ts",
    "build": "bun build ./index.html --outdir dist --minify",
    "serve": "bun server.static.ts",
    "typecheck": "tsc --noEmit",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "@xyflow/react": "^12.11.3",
    "idb-keyval": "^6.3.0",
    "react": "19",
    "react-dom": "19",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@types/bun": "^1.4.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "oxfmt": "^0.64.0",
    "oxlint": "^1.79.0",
    "typescript": "^7.0.2"
  }
}
```

**tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["bun"]
  },
  "include": ["src/**/*.ts?(x)", "*.ts"]
}
```

**.oxfmtrc.json**

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "ignorePatterns": ["dist/**", "docs/**", "proof/**"]
}
```

**.oxlintrc.json**

```json
{
  "plugins": ["react", "unicorn", "typescript", "oxc"],
  "ignorePatterns": ["node_modules/**", "dist/**", "docs/**", "proof/**"]
}
```

**bun-html.d.ts**

```ts
declare module "*.html" {
  const html: import("bun").HTMLBundle;
  export default html;
}
```

**index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TLN Pure-Bun Probe</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- the ONLY entry: Bun's HTML import pipeline bundles this TSX -->
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

**server.dev.ts**

```ts
import index from "./index.html";

declare global {
  var __tlnBootMs: number | undefined;
}

// bun --hot soft-reloads this module on change WITHOUT restarting the
// process; globalThis survives, so this timestamp proves "server never
// restarted" across HMR edits.
globalThis.__tlnBootMs ??= Date.now();

const server = Bun.serve({
  port: 4517,
  routes: {
    "/": index,
    "/boot": () =>
      Response.json({
        bootMs: globalThis.__tlnBootMs,
        pid: process.pid,
      }),
  },
  development: {
    hmr: true,
    console: false,
  },
});

console.log(`[dev] listening on ${server.url}`);
```

**server.static.ts**

```ts
const ROOT = "dist";

const server = Bun.serve({
  port: 4518,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }
    const rel = pathname.replaceAll("\\", "/");
    if (rel.includes("..")) {
      return new Response("forbidden\n", { status: 403 });
    }
    const filePath = `${ROOT}${rel}`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("not found\n", { status: 404 });
    }
    return new Response(file);
  },
});

console.log(`[static] serving ./dist on ${server.url}`);
```

**src/main.tsx**

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "@xyflow/react/dist/style.css";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("missing #root element");
}

createRoot(container).render(<App />);
```

**src/App.tsx**

```tsx
import { Background, Controls, ReactFlow, type Edge, type NodeTypes } from "@xyflow/react";
import MarkerNode, { type MarkerFlowNode } from "./MarkerNode";
import { useProbeStore } from "./store";

const initialNodes: MarkerFlowNode[] = [
  { id: "a", type: "marker", position: { x: -40, y: 40 }, data: { label: "A" } },
  {
    id: "b",
    type: "marker",
    position: { x: 320, y: 180 },
    data: { label: "B" },
  },
];

const initialEdges: Edge[] = [{ id: "edge-a-b", source: "a", target: "b", animated: true }];

const nodeTypes = { marker: MarkerNode } satisfies NodeTypes;

export default function App() {
  const visits = useProbeStore((s) => s.visits);
  const bumpVisits = useProbeStore((s) => s.bumpVisits);

  return (
    <div className="tln-app">
      <header className="tln-header">
        <strong>Pure-Bun probe</strong>
        <button type="button" onClick={bumpVisits}>
          persisted visits: {visits} (click me → IndexedDB)
        </button>
      </header>
      <div className="tln-flow">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
```

**src/MarkerNode.tsx**

```tsx
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { MARKER } from "./marker";

export type MarkerData = { label: string };
export type MarkerFlowNode = Node<MarkerData, "marker">;

export default function MarkerNode({ data }: NodeProps<MarkerFlowNode>) {
  return (
    <div className="tln-node">
      <Handle type="target" position={Position.Left} />
      <span className="tln-node__marker">
        ⬢ {MARKER} · {data.label}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

**src/marker.ts**

```ts
export const MARKER = "TLN-NODE";
```

**src/store.ts**

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { del, get, set } from "idb-keyval";

type ProbeState = {
  visits: number;
  note: string;
  bumpVisits: () => void;
  setNote: (note: string) => void;
};

export const useProbeStore = create<ProbeState>()(
  persist(
    (set) => ({
      visits: 0,
      note: "tln-probe-initial",
      bumpVisits: () => set((state) => ({ visits: state.visits + 1 })),
      setNote: (note) => set({ note }),
    }),
    {
      name: "tln-probe-store",
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => get(name),
        setItem: (name: string, value: string) => set(name, value),
        removeItem: (name: string) => del(name),
      })),
    },
  ),
);
```

**src/styles.css**

```css
html,
body,
#root {
  height: 100%;
  margin: 0;
  font-family: "Segoe UI", system-ui, sans-serif;
}

.tln-app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tln-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-bottom: 1px solid #d0d4dc;
  background: #f6f7fb;
}

.tln-flow {
  flex: 1;
}

.tln-node {
  border: 2px solid #7a3ff2;
  border-radius: 8px;
  padding: 8px 14px;
  background: #ffffff;
  font-size: 13px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 18%);
}
```

### Proof outputs (verbatim highlights)

- Dev: `STATUS: 200` · `<script type="module" crossorigin src="/_bun/client/index-00000000ece088c7.js">`
- Dev DOM: `<span class="tln-node__marker">⬢ TLN-NODE · A</span>` / `<span class="tln-node__marker">⬢ TLN-NODE · B</span>`
- HMR: after editing `src/marker.ts` only — bundle `…ece088c7.js → …d915c1a8.js`, new text present, `/boot` unchanged `{"bootMs":1787451138335,"pid":25300}` before AND after ⇒ zero restarts
- Build: `Bundled 144 modules in 36ms` → `index-jtzf68r1.js 0.57 MB` + `index.html 457 bytes` + `index-8r88zqcw.css 16.50 KB`
- Static: root `200`, JS `200 text/javascript len=573735`, CSS `200 text/css len=16505`, missing `404`
- Prod DOM: same two marker spans + edge/background/controls present
- Gates: `tsc --noEmit` exit 0 (`Version 7.0.2`) · `oxfmt --check`: "All matched files use the correct format." · `oxlint --deny-warnings` exit 0 (planted violation → exit 1 proves the gate bites)

### Gotchas (exact API shapes on Bun 1.4.0 / Windows)

1. **Dev server API**: `import index from "./index.html"` then `routes: { "/", index }`. HMR needs `development: true` or `development: { hmr: true }` (object also takes `console`). `bun --hot` gives the server-side soft reload; both together = full story. Docs page `runtime/hot` ("use Vite for browser HMR") understates what ships in 1.4.0 — observed behavior wins.
2. **TS7 native quirks**: does not auto-include `@types/*` → must declare `"types": ["bun"]`; no ambient `*.html` module → 10-line `bun-html.d.ts` using `import("bun").HTMLBundle`. Otherwise `bunx tsc --noEmit` behaves like classic tsc.
3. **Headless Edge**: PowerShell-native redirection of `msedge.exe --dump-dom` silently produces an empty file; wrap in `cmd /c`, always pass a FRESH `--user-data-dir` (existing Edge instance hijacks otherwise), and give React time with `--virtual-time-budget=8000`.
4. **CSS through bun build**: just `import "./file.css"` from TSX — dev hoists them into `<link>` tags, prod merges ALL CSS (incl. `@xyflow/react/dist/style.css`) into one hashed `.css`; asset URLs come out relative (`./index-*.{js,css}`).
5. **React Flow v12 under bun's bundler**: works unmodified. Import `@xyflow/react/dist/style.css`; strict-safe node typing is `Node<Data, "marker">` + `NodeProps<T>` + `satisfies NodeTypes`.
6. **oxfmt**: config-less it formats EVERYTHING walked (dist artifacts, docs HTML, markdown!). Create `.oxfmtrc.json` with `ignorePatterns` BEFORE first run. Schema key is `ignorePatterns`.
7. **oxlint**: outside a git repo it scans `node_modules` (~400 warnings from oxfmt's own bundles) → keep `.gitignore` + explicit `ignorePatterns`. Piped/non-TTY success output is EMPTY (exit code only); warnings exit 0, so gate with `--deny-warnings`.
8. **PowerShell cosmetics**: `bun add` writes progress to stderr → PS wraps it as `NativeCommandError` noise when you redirect `2>&1`; harmless.
9. Dev-mode client bundles are served from memory under `/_bun/client/index-<hash>.js` and re-hashed per edit; there is no dist in dev mode.

### Verdict table

| Capability | Verdict | Evidence |
|---|---|---|
| Dev server: Bun.serve + HTML imports (no Vite) | ✅ PASS | HTTP 200; HTML rewritten to `/_bun/*` assets |
| HMR without server restart (`bun --hot`) | ✅ PASS | bundle re-hashed w/ new text; `/boot` pid+bootMs identical |
| Headless render (dev) | ✅ PASS | `⬢ TLN-NODE · A/B`, edge-a-b, Background, Controls in DOM |
| Prod build (`bun build` HTML entry) | ✅ PASS | 144 modules, minified JS + merged CSS + 457-byte HTML |
| Static serve of dist (second Bun.serve) | ✅ PASS | 200/200/404 with correct Content-Types |
| Headless render (prod) | ✅ PASS | identical marker spans + flow chrome |
| Typecheck (TypeScript 7.0.2, strict + noUncheckedIndexedAccess + bundler) | ✅ PASS | `bunx tsc --noEmit` exit 0 |
| Format (oxfmt 0.64.0) | ✅ PASS | format + `--check` exit 0 |
| Lint (oxlint 1.79.0, plugins react/unicorn/typescript/oxc) | ✅ PASS | `--deny-warnings` exit 0; planted violation exits 1 |

**Overall verdict: every milestone passed — a React 19 + React Flow v12 app develops, builds, serves, renders, typechecks, formats, and lints on a Pure-Bun toolchain on Windows 11 with Node never used as runtime. No step was blocked.**


```

`edge-a-b` present: True · Background present: True · Controls present: True — production bundle renders identically to dev.
