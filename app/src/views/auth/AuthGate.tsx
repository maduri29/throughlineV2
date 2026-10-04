"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth, prepareAuth } from "../../lib/auth-client";
import { getWorkspaceAccount, setWorkspaceAccount } from "../../data/account";
import "./auth.css";
import { usePathname } from "next/navigation";
import ProfilePage from "./ProfilePage";

async function resolveEmail(login: string): Promise<string> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Unable to sign in.");
  return body.email;
}

function loginError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? error.code : "";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Wait a little before trying again.";
  if (code === "auth/network-request-failed")
    return "Could not connect. Check your internet connection and try again.";
  if (typeof code === "string" && code.startsWith("auth/"))
    if (code === "auth/email-already-in-use")
      return "An account with this email already exists. Sign in instead.";
    else if (code === "auth/weak-password")
      return "Choose a stronger password with at least 8 characters.";
    else return "Check your username or email and password, then try again.";
  return error instanceof Error ? error.message : "Unable to sign in. Please try again.";
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "setup" | "login" | "ready">("checking");
  const [user, setUser] = useState<User | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const registering = useRef(false);

  useEffect(() => {
    let generation = 0;
    const channel =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("throughline.auth");
    if (channel)
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type !== "signout" || !getWorkspaceAccount()) return;
        setPhase("checking");
        void signOut(firebaseAuth()).finally(() => window.location.assign("/stories"));
      };
    let stop: (() => void) | undefined;
    let disposed = false;
    async function start() {
      try {
        const response = await fetch("/api/auth/login", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not check login setup. Reload to try again.");
        const config = await response.json();
        if (disposed) return;
        if (!config.configured) {
          setPhase("setup");
          return;
        }
        setRegistrationEnabled(config.registrationEnabled === true);
        setRemaining(Number(config.remaining ?? 0));
        const auth = await prepareAuth();
        if (disposed) return;
        stop = onIdTokenChanged(auth, async (current) => {
          if (disposed) return;
          if (registering.current) return;
          const sequence = ++generation;
          if (!current) {
            setUser(null);
            setPhase(getWorkspaceAccount() ? "checking" : "login");
            // Dispose the editor store, timers and undo history when any tab signs out.
            if (getWorkspaceAccount()) {
              channel?.postMessage({ type: "signout" });
              window.location.assign("/stories");
            }
            return;
          }
          if (getWorkspaceAccount() && getWorkspaceAccount() !== current.uid) {
            setPhase("checking");
            window.location.reload();
            return;
          }
          try {
            const access = await fetch("/api/auth/access", {
              headers: { Authorization: `Bearer ${await current.getIdToken()}` },
              cache: "no-store",
            });
            if (disposed || sequence !== generation) return;
            if (!access.ok) {
              const body = await access.json();
              setPhase("login");
              setError(body.error ?? "Unable to access your workspace.");
              await signOut(auth);
              return;
            }
            setWorkspaceAccount(current.uid);
            setUser(current);
            setPassword("");
            setPhase("ready");
          } catch {
            if (disposed || sequence !== generation) return;
            setPhase("login");
            setError("Could not verify your account. Check your connection and try again.");
          }
        });
      } catch (failure) {
        if (!disposed) {
          setError(loginError(failure));
          setPhase("login");
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      generation++;
      stop?.();
      channel?.close();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    if (creating) {
      registering.current = true;
      let newUser: User | undefined;
      let registrationRejected = false;
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth(),
          login.trim(),
          password,
        );
        newUser = credential.user;
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await newUser.getIdToken()}`,
          },
          body: JSON.stringify({ username, inviteCode }),
        });
        const result = await response.json();
        registrationRejected = [400, 403, 409].includes(response.status);
        if (!response.ok) throw new Error(result.error ?? "Could not create your workspace.");
        window.location.reload();
      } catch (failure) {
        // Roll back only an account just created by this form, never an existing user.
        if (newUser && registrationRejected) {
          try {
            await deleteUser(newUser);
          } catch {
            await signOut(firebaseAuth());
          }
        } else if (newUser) {
          // A lost response can follow a committed registration. Keep the
          // Firebase identity and check membership before recovering.
          try {
            const access = await fetch("/api/auth/access", {
              headers: { Authorization: `Bearer ${await newUser.getIdToken()}` },
              cache: "no-store",
            });
            if (access.ok) {
              window.location.reload();
              return;
            }
          } catch {
            /* Keep the identity intact if the network is unavailable. */
          }
          await signOut(firebaseAuth());
        }
        registering.current = false;
        setError(loginError(failure));
        setBusy(false);
      }
      return;
    }
    try {
      const email = await resolveEmail(login);
      await signInWithEmailAndPassword(firebaseAuth(), email, password);
      // If already authenticated after a temporary verification failure, reload
      // starts the access check again without mounting stale editor state.
      if (getWorkspaceAccount()) window.location.reload();
    } catch (failure) {
      setError(loginError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const email = await resolveEmail(login);
      await sendPasswordResetEmail(firebaseAuth(), email);
      setNotice("Check your email for a password reset link.");
    } catch (failure) {
      setError(loginError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    setError("");
    try {
      const { useGraphStore } = await import("../../store");
      await useGraphStore.getState().forceSave();
      if (useGraphStore.getState().status === "error")
        throw new Error(
          "Your latest edits could not be saved. Export a backup before signing out.",
        );
      await signOut(firebaseAuth());
    } catch (failure) {
      setError(loginError(failure));
      setBusy(false);
    }
  }

  async function importPrevious() {
    setBusy(true);
    setError("");
    try {
      const { importLegacyWorkspace } = await import("../../data/legacy-workspace");
      await importLegacyWorkspace();
      window.location.assign("/stories");
    } catch (failure) {
      setError(loginError(failure));
      setBusy(false);
    }
  }

  if (phase === "ready" && user) {
    if (pathname.startsWith("/profile"))
      return (
        <ProfilePage
          key={pathname}
          user={user}
          busy={busy}
          error={error}
          onSignOut={() => void leave()}
          onImport={() => void importPrevious()}
        />
      );
    return <div className="auth-workspace">{children}</div>;
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <img className="auth-mark" src="/brand/story-lane-mark.svg" alt="" width="52" height="52" />
        <span className="auth-eyebrow">STORY LANE</span>
        <h1 id="login-heading">
          {phase === "checking"
            ? "Opening your workspace"
            : phase === "setup"
              ? "Your stories deserve a private space"
              : creating
                ? "Make room for your story."
                : "Back to your story."}
        </h1>
        {phase === "checking" ? (
          <p role="status">Checking your saved sign-in…</p>
        ) : phase === "setup" ? (
          <>
            <p>Private login is being set up. Your existing work is safely kept on this device.</p>
            <p className="auth-help">
              The workspace owner needs to connect Firebase and provision your account before you
              can sign in.
            </p>
            <button className="tln-btn" onClick={() => window.location.reload()}>
              Check again
            </button>
          </>
        ) : (
          <>
            <p>
              {creating
                ? "Create your own private workspace. Your stories and ideas stay separate from other users."
                : "Sign in to your private stories, characters and Boneyard."}
            </p>
            <form onSubmit={(event) => void submit(event)}>
              {creating && (
                <>
                  <label htmlFor="register-username">Username</label>
                  <input
                    id="register-username"
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    minLength={2}
                    maxLength={32}
                    pattern="[a-zA-Z0-9_.\-]{2,32}"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={busy}
                  />
                </>
              )}
              <label htmlFor="login-identity">{creating ? "Email" : "Username or email"}</label>
              <input
                id="login-identity"
                type={creating ? "email" : "text"}
                autoComplete={creating ? "email" : "username"}
                aria-label={creating ? "Email" : "Username or email"}
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                disabled={busy}
              />
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete={creating ? "new-password" : "current-password"}
                minLength={creating ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              {creating && (
                <>
                  <label htmlFor="register-invite">Invitation code</label>
                  <input
                    id="register-invite"
                    required
                    autoComplete="off"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    disabled={busy}
                  />
                  <p className="auth-help">
                    Ask the workspace owner for the invitation code. Use a password of at least 8
                    characters.
                  </p>
                </>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button className="tln-btn tln-btn--accent auth-submit" type="submit" disabled={busy}>
                {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
              </button>
              {!creating && (
                <button
                  className="tln-btn tln-btn--quiet"
                  type="button"
                  disabled={busy || !login.trim()}
                  onClick={() => void resetPassword()}
                >
                  Forgot password?
                </button>
              )}
              {registrationEnabled && (
                <button
                  className="tln-btn tln-btn--quiet"
                  type="button"
                  disabled={busy || (!creating && remaining === 0)}
                  onClick={() => {
                    setCreating(!creating);
                    setPassword("");
                    setError("");
                    setNotice("");
                  }}
                >
                  {creating
                    ? "Back to sign in"
                    : remaining === 0
                      ? "All 5 accounts are in use"
                      : "Create a new account"}
                </button>
              )}
            </form>
            <p className="auth-help">
              Access is limited to invited accounts. Contact the workspace owner for your username
              or email.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
