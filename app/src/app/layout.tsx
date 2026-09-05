// Root layout. Global CSS is imported here because Next requires it in a layout
// rather than an arbitrary module.
//
// The <div id="root"> wrapper is deliberate: styles.css sizes `html, body, #root`
// to full height, and that rule predates this migration. Reproducing the element
// the stylesheet already expects keeps the cascade byte-for-byte identical to the
// Bun build, instead of quietly rewriting layout rules during a toolchain change.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";
import "../styles.css";
import "../views/library/library.css";
import "../shell/shell.css";
import "../shell/mobile.css";
import "../views/boneyard/boneyard.css";

export const metadata: Metadata = {
  title: "Throughline",
  description: "Develop a film or series: map, timeline, characters and script in one graph.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
