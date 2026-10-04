import { getApps, initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getWorkspaceAccount } from "../data/account";

export function firebaseAuth() {
  const app =
    getApps().find((entry) => entry.name === "throughline") ??
    initializeApp(
      {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
      "throughline",
    );
  return getAuth(app);
}

export async function prepareAuth() {
  const auth = firebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  return auth;
}

export async function authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
  const auth = firebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.uid !== getWorkspaceAccount()) throw new Error("Sign in again before syncing.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  if (response.status === 401 || response.status === 403) {
    // Hide private content before returning to login, including other open tabs.
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }
  return response;
}
