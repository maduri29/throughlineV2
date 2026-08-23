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
  explainAuthError,
  onAuthChange,
  readAuthCallbackError,
  readConfig,
  redirectOrigin,
  signIn,
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
        ? "connect"
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
            <p className="tln-auth__sub">
              We email you a link — there is no password to choose, store or lose.
            </p>

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
              className="tln-auth__primary"
              disabled={busy || !email.trim()}
              onClick={() => void send(email.trim())}
            >
              {busy ? "Sending…" : "Email me a link"}
            </button>
            <button
              className="tln-auth__ghost"
              onClick={() => {
                clearConfig();
                setUrl("");
                setError(null);
                void refresh();
              }}
            >
              Disconnect this project
            </button>
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
            <button
              className="tln-auth__ghost"
              onClick={() => {
                clearConfig();
                setSentTo(null);
                void refresh();
              }}
            >
              Disconnect this project
            </button>
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
            </dl>
          </details>
        )}
      </div>
    </div>
  );
}
