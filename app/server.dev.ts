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
