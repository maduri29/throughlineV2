import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The route is a static shell (the editor mounts client-side), so the build
  // emits prerendered HTML and Vercel serves it from the CDN -- the same
  // delivery the Bun build had. No `output: "export"`, so server routes stay
  // available if a feature ever genuinely needs one.
};

export default nextConfig;
