// The sign-in experience, as a dialog with one job per screen.
//
// The previous version stacked four unrelated jobs in one panel at the bottom of
// the library: pasting a Postgres URL, signing in, pushing and pulling stories,
// and diagnostics. Connecting a project is a one-time technical setup task and
// has no business being labelled "step 1 of signing in" to a screenwriter, so it
// is now its own screen with its own framing, and story sync moved out entirely.
//
// The states below are the ones the flow can actually be in — including the two
// the old panel had no answer for: waiting on an email, and returning from a
// link. A flow that leaves the app and comes back has to narrate itself, or
// every failure looks the same as every other.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  authDiagnostics,
  clearConfig,
  cloudState,
  dashboardProvidersUrl,
  explainAuthError,
  hasBuiltinConfig,
  isUsingBuiltinConfig,
  onAuthChange,
  readAuthCallbackError,
  readConfig,
  redirectOrigin,
  signIn,
  signInWithGitHub,
  signOut,
  writeConfig,
  type AuthDiagnostics,
  type CloudState,
} from "../data/cloud";

/** Supabase's built-in mailer is rate-limited; a cooldown avoids earning a 429. */
const RESEND_SECONDS = 45;

type Screen = "connect" | "signIn" | "inbox" | "account";

export default function AuthDialog({
  open,
  completing,
  onClose,
}: {
  open: boolean;
  completing: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<CloudState | null>(null);
  const [diag, setDiag] = useState<AuthDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [url, setUrl] = useState(() => readConfig()?.url ?? "");
  // Never pre-filled from storage: echoing a stored credential into the DOM puts
  // it in every screenshot and accessibility tree for no gain.
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const dialogRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await cloudState());
      setDiag(await authDiagnostics());
    } catch (err) {
      setState({ kind: "unconfigured" });
      setError(`Could not reach that project — ${String(err)}`);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    const callbackError = readAuthCallbackError();
    if (callbackError) {
      // oxlint-disable-next-line react/set-state-in-effect
      setError(callbackError);
    }
    return onAuthChange(() => {
      void refresh();
    });
  }, [refresh]);

  // Tick the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Escape closes, and focus lands inside so the dialog is usable from the
  // keyboard rather than only with a pointer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    dialogRef.current?.querySelector("input")?.focus();
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const screen: Screen = completing
    ? "signIn"
    : state?.kind === "signed-in"
      ? "account"
      : state?.kind === "unconfigured"
        ? hasBuiltinConfig()
          ? "signIn" // project compiled in; go straight to proving who you are
          : "connect"
        : sentTo
          ? "inbox"
          : "signIn";

  const onConnect = (): void => {
    const problem = writeConfig(url, key);
    if (problem) {
      setError(problem);
      return;
    }
    setKey("");
    setError(null);
    void refresh();
  };

  const send = async (address: string): Promise<void> => {
    setBusy(true);
    const err = await signIn(address);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSentTo(address);
    setCooldown(RESEND_SECONDS);
  };

  return (
    <div
      className="tln-auth__scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tln-auth"
        role="dialog"
        aria-modal="true"
        aria-label="Cloud sync account"
        ref={dialogRef}
      >
        <button className="tln-auth__x" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* ---------------------------------------------------- completing -- */}
        {completing && (
          <div className="tln-auth__body">
            <div className="tln-auth__spinner" aria-hidden="true" />
            <h2 className="tln-auth__title">Signing you in…</h2>
            <p className="tln-auth__sub">Finishing the link you just opened.</p>
          </div>
        )}

        {/* ------------------------------------------------------- connect -- */}
        {!completing && screen === "connect" && (
          <div className="tln-auth__body">
            <h2 className="tln-auth__title">Connect cloud sync</h2>
            <p className="tln-auth__sub">
              One-time setup, and entirely optional — Throughline works fully offline on this
              machine without it. Connecting a Supabase project keeps a copy of your stories off
              this device.
            </p>

            <label className="tln-auth__label" htmlFor="tln-url">
              Project URL
            </label>
            <input
              id="tln-url"
              className="tln-auth__input"
              placeholder="https://your-project.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <label className="tln-auth__label" htmlFor="tln-key">
              Publishable key
            </label>
            <input
              id="tln-key"
              className="tln-auth__input"
              type="password"
              placeholder="sb_publishable_…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConnect();
              }}
            />
            <p className="tln-auth__hint">
              Use the <strong>publishable</strong> key. Never the secret or service_role key — it
              bypasses row-level security and would expose every account.
            </p>

            <button className="tln-auth__primary" onClick={onConnect}>
              Connect
            </button>
          </div>
        )}

        {/* -------------------------------------------------------- signIn -- */}
        {!completing && screen === "signIn" && (
          <div className="tln-auth__body">
            <h2 className="tln-auth__title">Sign in</h2>
            <p className="tln-auth__sub">No password to choose, store or lose.</p>

            {/* Which project this is talking to. Not decoration: a dashboard tab
                open on a different project than the app is configured with looks
                identical from the app, and every setting then lands in the wrong
                place with no symptom except that nothing works. */}
            <p className="tln-auth__project">
              Connected to <code>{readConfig()?.url ?? "—"}</code>
            </p>

            {/* Primary because it depends on nothing this project has to run:
                no mailer, no password. The email path below is the fallback,
                and it is the one that breaks when the mailer is rate-limited.
                Disabled with a reason when the project itself reports the
                provider off — a button that can only produce an error is not
                an affordance, it is a trap. */}
            <button
              className="tln-auth__github"
              disabled={
                busy ||
                (diag?.providers !== null &&
                  diag?.providers !== undefined &&
                  !diag.providers.includes("github"))
              }
              title={
                diag?.providers && !diag.providers.includes("github")
                  ? "GitHub sign-in is switched off on this Supabase project — use email below, or enable the provider."
                  : undefined
              }
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
                width="17"
                height="17"
                aria-hidden="true"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Continue with GitHub
            </button>

            {/* Asked of the project, not assumed. The dashboard has more than one
                page that looks like the place to enable this, so say plainly when
                the provider is off rather than letting the click fail. */}
            {diag?.providers !== null && diag?.providers !== undefined && (
              <p
                className={
                  diag.providers.includes("github") ? "tln-auth__hint" : "tln-auth__provider-off"
                }
              >
                {diag.providers.includes("github") ? (
                  "GitHub is enabled on this project."
                ) : (
                  <>
                    GitHub is NOT enabled on this project
                    {diag.providers.length > 0 ? ` (on: ${diag.providers.join(", ")})` : ""}.{" "}
                    {dashboardProvidersUrl() ? (
                      <>
                        Enable it on{" "}
                        <a href={dashboardProvidersUrl() ?? ""} target="_blank" rel="noreferrer">
                          this project&rsquo;s Providers page
                        </a>
                        {" — "}check the ref in that URL matches the one above.
                      </>
                    ) : (
                      "Enable it under Authentication → Sign In / Providers → GitHub."
                    )}
                  </>
                )}
              </p>
            )}

            <div className="tln-auth__or">
              <span>or use email</span>
            </div>

            <label className="tln-auth__label" htmlFor="tln-email">
              Email
            </label>
            <input
              id="tln-email"
              className="tln-auth__input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) void send(email.trim());
              }}
            />

            <button
              className="tln-auth__secondary"
              disabled={busy || !email.trim()}
              onClick={() => void send(email.trim())}
            >
              {busy ? "Sending…" : "Email me a link"}
            </button>
            {/* Only an action when it would change something: while the app is
                already on the built-in project this button was a no-op that
                looked like a setting. When a self-hoster has overridden the
                project, this is their way back. */}
            {!isUsingBuiltinConfig() && (
              <button
                className="tln-auth__ghost"
                onClick={() => {
                  clearConfig();
                  setUrl("");
                  setError(null);
                  void refresh();
                }}
              >
                {hasBuiltinConfig() ? "Use the built-in project" : "Disconnect this project"}
              </button>
            )}
          </div>
        )}

        {/* --------------------------------------------------------- inbox -- */}
        {!completing && screen === "inbox" && (
          <div className="tln-auth__body">
            <div className="tln-auth__mark" aria-hidden="true">
              ✉
            </div>
            <h2 className="tln-auth__title">Check your inbox</h2>
            <p className="tln-auth__sub">
              A sign-in link is on its way to <strong>{sentTo}</strong>.
            </p>

            {/* Both of these are real failure modes, not filler: a link opened in
                a different browser cannot complete, and an origin missing from
                the allow-list bounces the link somewhere else entirely. */}
            <ul className="tln-auth__checklist">
              <li>Open it in this browser — a link opened elsewhere cannot finish.</li>
              <li>
                It returns to <code>{redirectOrigin()}</code>, which must be listed under
                Authentication → URL Configuration → Redirect URLs.
              </li>
            </ul>

            <button
              className="tln-auth__primary"
              disabled={busy || cooldown > 0}
              onClick={() => void send(sentTo ?? "")}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
            </button>
            <button
              className="tln-auth__ghost"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        )}

        {/* ------------------------------------------------------- account -- */}
        {!completing && screen === "account" && state?.kind === "signed-in" && (
          <div className="tln-auth__body">
            <div className="tln-auth__avatar" aria-hidden="true">
              {(state.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <h2 className="tln-auth__title">Signed in</h2>
            <p className="tln-auth__sub">{state.email ?? "unknown account"}</p>
            <p className="tln-auth__hint">
              Your stories still live on this machine. Push and pull from the Library — sync is
              last-write-wins per story, not collaboration.
            </p>
            <button
              className="tln-auth__primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void signOut().then(() => {
                  setBusy(false);
                  setSentTo(null);
                  void refresh();
                });
              }}
            >
              Sign out
            </button>
            {!isUsingBuiltinConfig() && (
              <button
                className="tln-auth__ghost"
                onClick={() => {
                  clearConfig();
                  setSentTo(null);
                  void refresh();
                }}
              >
                {hasBuiltinConfig() ? "Use the built-in project" : "Disconnect this project"}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="tln-auth__error">
            <p className="tln-auth__error-what">{error}</p>
            {/* The raw message names the symptom; this names the fix. */}
            {explainAuthError(error) && (
              <p className="tln-auth__error-fix">{explainAuthError(error)}</p>
            )}
          </div>
        )}

        {/* This flow leaves the app and comes back, so it cannot be reproduced
            from inside it. Shapes and outcomes only — never token values. */}
        {diag && !completing && screen !== "connect" && (
          <details className="tln-auth__diag">
            <summary>Sign-in diagnostics</summary>
            <dl className="tln-auth__diag-list">
              <dt>Returns to</dt>
              <dd>{diag.origin}</dd>
              <dt>Link landed as</dt>
              <dd>{diag.landing}</dd>
              <dt>Last auth event</dt>
              <dd>{diag.lastEvent ?? "none"}</dd>
              <dt>Session</dt>
              <dd>{diag.session ? "present" : "absent"}</dd>
              <dt>Stored auth entries</dt>
              <dd>{diag.storageKeys === -1 ? "storage blocked" : diag.storageKeys}</dd>
              <dt>Providers enabled</dt>
              <dd>
                {diag.providers === null
                  ? "could not read"
                  : diag.providers.length > 0
                    ? diag.providers.join(", ")
                    : "none"}
              </dd>
            </dl>
          </details>
        )}
      </div>
    </div>
  );
}
