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
import "../views/palette.css";
import "../views/boneyard/boneyard.css";
import "../views/research/research.css";

export const metadata: Metadata = {
  title: "Story Lane",
  applicationName: "Story Lane",
  description:
    "A little structure. A world of possibilities. Capture ideas, shape characters, and find your way into a story.",
  icons: {
    icon: { url: "/brand/story-lane-mark.svg?v=07", type: "image/svg+xml" },
    shortcut: "/brand/story-lane-mark.svg?v=07",
  },
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
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Mandali&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Serif+Telugu:wght@400;600;700&family=Ramabhadra&family=Suranna&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
