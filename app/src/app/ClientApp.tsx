"use client";

import dynamic from "next/dynamic";

// Loaded with ssr:false on purpose, and this is the crux of the migration.
//
// The editor is a browser application end to end: the store opens IndexedDB on
// boot (ADR-0001), CodeMirror and React Flow measure real DOM, and the sync tier
// reads localStorage. None of that exists during a server render, so prerendering
// the editor would fail the build or -- worse -- ship a server-rendered shell that
// flashes and then throws on hydration.
//
// `ssr: false` is only legal inside a client component, which is why this file
// exists as a thin boundary rather than living in page.tsx.
const App = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => <div className="tln-boot">Loading Throughline…</div>,
});

export default function ClientApp() {
  return <App />;
}
