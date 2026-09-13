import type { ReactNode } from "react";
import ClientApp from "../ClientApp";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientApp />
      {children}
    </>
  );
}
