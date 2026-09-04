import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Typecheck is already enforced in the pre-commit/CI gate (`bun run check` / `tsc --noEmit`).
    // Skipping duplicate typechecking here shaves ~150-200ms off every build.
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "@xyflow/react",
      "@codemirror/view",
      "@codemirror/state",
      "@codemirror/commands",
    ],
  },
  // The route is a static shell (the editor mounts client-side), so the build
  // emits prerendered HTML and Vercel serves it from the CDN -- the same
  // delivery the Bun build had. No `output: "export"`, so server routes stay
  // available if a feature ever genuinely needs one.
};

export default nextConfig;
