// The first screen (ADR-0007 decision 6).
//
// Signed-in is the default state, because the whole point of the account is
// device continuity: work written on a machine you never signed into is work
// stranded there. The escape exists so the app still runs on a plane.
//
// One honesty constraint drives the copy at the bottom. Because signing in
// adopts every local story (decision 5), continuing without signing in is NOT a
// privacy choice — it is "offline for now", and everything written that way
// uploads at the next sign-in. The button says so.
import { useCallback, useEffect, useState } from "react";
import {
  authDiagnostics,
  cloudState,
  explainAuthError,
  onAuthChange,
  readAuthCallbackError,
  redirectOrigin,
  signIn,
  signInWithGitHub,
  type AuthDiagnostics,
} from "../data/cloud";

export const SKIP_KEY = "TLN_SKIP_SIGNIN";

/** Remember the offline choice so the gate does not ask again every load. */
export function chooseOffline(): void {
  try {
    localStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* private mode: the gate simply asks again, which is survivable */
  }
}

export function hasChosenOffline(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [diag, setDiag] = useState<AuthDiagnostics | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await cloudState();
      setDiag(await authDiagnostics());
      // Already signed in — nothing to ask. Go where the work is.
      if (s.kind === "signed-in") location.replace("/stories");
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    const callbackError = readAuthCallbackError();
    // oxlint-disable-next-line react/set-state-in-effect
    if (callbackError) setError(callbackError);
    return onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

  const githubOn = diag?.providers === null ? null : (diag?.providers?.includes("github") ?? null);

  return (
    <div className="tln-signin">
      <div className="tln-signin__card">
        <p className="tln-signin__mark">Throughline</p>

        {sentTo ? (
          <>
            <h1 className="tln-signin__title">Check your inbox</h1>
            <p className="tln-signin__sub">
              A sign-in link is on its way to <strong>{sentTo}</strong>. Open it in this browser —
              it returns to <code>{redirectOrigin()}</code>.
            </p>
            <button className="tln-signin__ghost" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="tln-signin__title">Sign in to write everywhere</h1>
            <p className="tln-signin__sub">
              Your stories follow you between machines. No password to choose, store or lose.
            </p>

            <button
              className="tln-signin__github"
              disabled={busy || githubOn === false}
              onClick={() => {
                setBusy(true);
                void signInWithGitHub().then((err) => {
                  setBusy(false);
                  if (err) setError(err);
                });
              }}
            >
              <svg
                viewBox="0 0 16 16"
                width="18"
                height="18"
                aria-hidden="true"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Continue with GitHub
            </button>

            {githubOn === false && (
              <p className="tln-signin__warn">
                GitHub sign-in is not switched on for this project, so this button cannot work yet.
                Use email below, or enable it under Authentication → Providers.
              </p>
            )}

            <div className="tln-signin__or">
              <span>or</span>
            </div>

            <input
              className="tln-signin__input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="tln-signin__secondary"
              disabled={busy || !email.trim()}
              onClick={() => {
                setBusy(true);
                void signIn(email.trim()).then((err) => {
                  setBusy(false);
                  if (err) setError(err);
                  else setSentTo(email.trim());
                });
              }}
            >
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </>
        )}

        {error && (
          <div className="tln-signin__error">
            <p className="tln-auth__error-what">{error}</p>
            {explainAuthError(error) && (
              <p className="tln-auth__error-fix">{explainAuthError(error)}</p>
            )}
          </div>
        )}

        <div className="tln-signin__escape">
          <button
            className="tln-signin__ghost"
            onClick={() => {
              chooseOffline();
              location.replace("/stories");
            }}
          >
            Keep writing without signing in
          </button>
          {/* Stated plainly because decision 5 makes the alternative a lie. */}
          <p className="tln-signin__fine">
            Your work stays on this device for now. Everything written this way is added to your
            account the next time you sign in — this is not a way to keep work private.
          </p>
        </div>
      </div>
    </div>
  );
}
