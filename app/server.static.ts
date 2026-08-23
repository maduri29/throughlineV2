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
