"use client";

import dynamic from "next/dynamic";

// Same reason as the workspace: this screen reads localStorage and builds a
// Supabase client, neither of which exists during a server render.
const Screen = dynamic(() => import("../../views/SignInScreen"), {
  ssr: false,
  loading: () => <div className="tln-signin__boot">Loading…</div>,
});

export default function SignInScreenRoute() {
  return <Screen />;
}
