import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Allow verification builds to avoid OneDrive locks in the active dev output.
  distDir: process.env.STORY_LANE_BUILD_DIR ?? ".next",
  serverExternalPackages: ["firebase-admin", "@libsql/client"],
  typescript: {
    // Typecheck is already enforced in the pre-commit/CI gate (`bun run check` / `tsc --noEmit`).
    // Skipping duplicate typechecking here shaves ~150-200ms off every build.
    ignoreBuildErrors: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    optimizePackageImports: [
      "@xyflow/react",
      "@codemirror/view",
      "@codemirror/state",
      "@codemirror/commands",
      "lucide-react",
      "effect",
    ],
  },
  // The route is a static shell (the editor mounts client-side), so the build
  // emits prerendered HTML and Vercel serves it from the CDN -- the same
  // delivery the Bun build had. No `output: "export"`, so server routes stay
  // available if a feature ever genuinely needs one.
};

export default nextConfig;
