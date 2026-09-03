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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
