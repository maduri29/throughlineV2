import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserRound } from "lucide-react";
import Logo from "../views/Logo";
import { SECTIONS } from "./navigation";

interface AppHeaderProps {
  section: "stories" | "boneyard" | "research" | "story";
  theme: "dark" | "light";
  status: string;
  bootError: string | null;
  toggleTheme: () => void;
  onOpenPalette: () => void;
}

export function AppHeader({
  section,
  theme,
  status,
  bootError,
  toggleTheme,
  onOpenPalette,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <>
      <header className="tln-header">
        <button className="tln-brand" onClick={() => router.push("/stories")} title="All stories">
          <Logo />
        </button>

        {section !== "story" && (
          <nav className="tln-nav" aria-label="Sections">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                aria-current={section === sec.id ? "page" : undefined}
                className={`tln-nav__tab${section === sec.id ? " tln-nav__tab--on" : ""}`}
                onClick={() => router.push(sec.href)}
              >
                {sec.icon}
                <span className="tln-nav__label">{sec.label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="tln-header__actions">
          <button
            className="tln-quick-search"
            onClick={onOpenPalette}
            aria-label="Quick search"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+k Meta+k"
            title="Quick search (Ctrl+K / ⌘K)"
          >
            <Search size={16} aria-hidden="true" />
            <span>Quick search</span>
            <kbd>⌘ / Ctrl K</kbd>
          </button>

          <button
            className="tln-tool tln-tool--theme"
            onClick={toggleTheme}
            title={
              theme === "dark"
                ? "Switch to Archival Print (Light)"
                : "Switch to Director's Studio (Dark)"
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg
                className="tln-tool__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
              </svg>
            ) : (
              <svg
                className="tln-tool__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13.5 9.5a5.5 5.5 0 1 1-7-7 4.5 4.5 0 0 0 7 7z" />
              </svg>
            )}
          </button>

          <Link
            href="/profile"
            className="tln-tool tln-tool--account"
            aria-label="Account"
            title="Your profile"
          >
            <UserRound size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {status === "error" && (
        <div className="tln-fault" role="alert">
          <strong>Story Lane could not reach this browser&rsquo;s storage.</strong>{" "}
          {bootError ?? "Unknown error."} Nothing you do will be saved until this clears. If the app
          is open in another tab, close it and reload.
          <button className="tln-btn" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      )}
    </>
  );
}
