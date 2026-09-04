# Throughline

A story-development app for collecting ideas, organizing scenes and characters,
and writing Fountain screenplays.

## Refactor direction

The project is open to a full refactor. The current architecture, dependencies,
data model, terminology, navigation, and visual design are starting points that
can change as the product improves. Earlier scope limits and locked design
choices are historical context, not requirements for new work.

## Current implementation

The app uses Next.js App Router, React, React Flow, Zustand, IndexedDB,
CodeMirror, and TypeScript. Bun runs the package scripts and tests.
See `app/package.json` for dependency versions and available commands.

Story data is stored locally in IndexedDB. Backup and import use JSON envelopes.
Optional cloud sync uses the Next.js `/api/sync` endpoint and Turso, configured
with server environment variables and a Sync Key in the app. This repository
therefore includes server functionality as well as the browser editor.

## Run locally

Install the application dependencies, then start the development server:

```bash
cd app
bun install
bun run dev
```

Open http://localhost:4517. For optional Turso sync, copy `app/env.example` to
`app/.env.local` and supply your database URL and authentication token.

## Validation

Run from the repository root or inside `app/` after installing dependencies:

```bash
bun run check          # format, lint, typecheck, and unit tests
bun run build          # Next.js production build
bun run verify:ui      # headless UI assertions; requires the dev server
```

Other test, coverage, and profiling commands are listed in `package.json`.
The existing checks describe current behavior and can evolve with the refactor.

## Deployment

The current Vercel configuration is `app/vercel.json`; use `app` as the project
Root Directory for this layout. Configure the Turso environment variables on the
server if enabling sync. Deployment settings can change with the architecture.
Live deployment and Git integration status have not been checked in this cleanup.

## Documentation

- [Current terminology](CONTEXT.md): a descriptive glossary, open to revision.
- [Product ideas](IDEAS.md): background and possibilities for future work.
- [Research](RESEARCH.md): earlier research, with claims to reverify when relevant.
- [Fountain notes](research/fountain-subset.md): format and interoperability details.
- [Archive](docs/archive/README.md): superseded planning and design guidance.
