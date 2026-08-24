// One story. The id in the path is the project id, so a story can be linked to,
// bookmarked, and reopened in the tab it was left in.
import ClientApp from "../../ClientApp";

// The shell is byte-identical for every id -- the app reads the id from the URL
// in the browser -- so there is nothing for a server to compute per request.
// Without this the segment renders on demand as a function, which would put a
// serverless hop in front of a page the CDN can already serve (ADR-0006).
export const dynamic = "force-static";
export const dynamicParams = true;

export function generateStaticParams(): Array<{ id: string }> {
  // Story ids live in each browser's IndexedDB, so none are known at build time.
  // dynamicParams keeps every other id working; this just seeds the static shell.
  return [{ id: "_" }];
}

export default function Page() {
  return <ClientApp />;
}
