import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { authenticatedFetch } from "../../lib/auth-client";
import SyncSettings from "./SyncSettings";

type Invitations = { code: string | null; used: number; limit: number; remaining: number };

export default function ProfilePage({
  user,
  busy,
  error,
  onSignOut,
  onImport,
}: {
  user: User;
  busy: boolean;
  error: string;
  onSignOut: () => void;
  onImport: () => void;
}) {
  const [profile, setProfile] = useState<{ username?: string }>({});
  const [invitations, setInvitations] = useState<Invitations | null>(null);
  const [loadError, setLoadError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/access")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your profile.");
        const data = await response.json();
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) setLoadError("Could not load your profile. Reload to try again.");
      });
    void authenticatedFetch("/api/auth/invitations")
      .then(async (response) => {
        if (response.status === 403) return;
        if (!response.ok) throw new Error("Could not load invitations.");
        const data = await response.json();
        if (active && data.owner) setInvitations(data);
      })
      .catch(() => {
        if (active) setLoadError("Could not load invitations. Reload to try again.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card" aria-labelledby="profile-heading">
        <nav className="profile-nav" aria-label="Profile navigation">
          <Link href="/stories">← Your stories</Link>
        </nav>
        <span className="auth-eyebrow">STORY LANE · ACCOUNT</span>
        <h1 id="profile-heading">Your profile</h1>
        <p>Your own space for stories, characters and ideas.</p>
        <dl className="profile-details">
          <div>
            <dt>Username</dt>
            <dd>{profile.username ?? "Loading…"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>Private to your account</dd>
          </div>
        </dl>
        {(error || loadError) && (
          <p role="alert" className="auth-error">
            {error || loadError}
          </p>
        )}
        <SyncSettings />
        {invitations && (
          <section className="profile-section" aria-labelledby="invitations-heading">
            <h2 id="invitations-heading">Invite users</h2>
            <p>
              {invitations.used} of {invitations.limit} accounts in use. {invitations.remaining}{" "}
              spaces available.
            </p>
            <p>
              Share this code only with people you want to invite. They choose Create a new account
              on the sign-in screen and enter the code. Each person gets a private workspace.
            </p>
            {invitations.code ? (
              <>
                <label htmlFor="owner-invite-code">Invitation code</label>
                <input
                  id="owner-invite-code"
                  readOnly
                  value={invitations.code}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="tln-btn"
                  disabled={invitations.remaining === 0}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(invitations.code!)
                      .then(() => setCopyStatus("Invitation code copied."))
                      .catch(() => setCopyStatus("Select the invitation code above and copy it."));
                  }}
                >
                  Copy invitation code
                </button>
                {copyStatus && <p role="status">{copyStatus}</p>}
              </>
            ) : (
              <p>Invitations are disabled. Configure an invitation code to allow new users.</p>
            )}
            {invitations.remaining === 0 && (
              <p>All account spaces are filled. New registrations are blocked.</p>
            )}
          </section>
        )}
        <section className="profile-section">
          <h2>Previous local work</h2>
          <p>
            On your own device, copy your previous work into this account if it is empty. The
            original copy is preserved.
          </p>
          <button className="tln-btn" disabled={busy} onClick={onImport}>
            Import previous local work
          </button>
        </section>
        <section className="profile-section">
          <h2>Session</h2>
          <p>Signing out saves your latest edits and closes this workspace in your other tabs.</p>
          <button className="tln-btn" disabled={busy} onClick={onSignOut}>
            {busy ? "Saving…" : "Sign out"}
          </button>
        </section>
      </section>
    </main>
  );
}
