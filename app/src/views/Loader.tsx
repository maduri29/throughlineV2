// Loading marks: a clapperboard, a countdown leader, and a typewriter slug.
//
// Every wait in the app is a wait to write, so the indicators speak the
// domain instead of spinning a generic wheel: the slate snaps on ordinary
// waits, the leader counts down the rare cold boot, and a slug types itself
// while the editor loads. CSS animations plus two small interval loops, which
// render statically under prefers-reduced-motion and clean up on unmount.
// Animated parts are aria-hidden; the wrapper carries the status role.
import { useEffect, useState } from "react";

export type LoaderKind =
  /** General mark: clapperboard mid-snap. The default. */
  | "clap"
  /** Cold boot only: film-leader countdown. Ceremonial — use sparingly. */
  | "countdown"
  /** Editor waits: a slug typing itself. About writing, not film. */
  | "slug";

/** Live reduced-motion flag; loops render their final state when set. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export default function Loader({
  label = "FADE IN:",
  inline = false,
  kind = "clap",
  line = "INT. KITCHEN - NIGHT",
}: {
  /** Screenplay-flavoured caption; keep it short ("FADE IN:", "Rolling…"). */
  label?: string;
  /** Row variant for status lines (clap only); default is the centred mark. */
  inline?: boolean;
  kind?: LoaderKind;
  /** The line the slug types; keep it slug-short. */
  line?: string;
}) {
  if (kind === "countdown") return <Countdown label={label} />;
  if (kind === "slug") return <Slug line={line} />;
  return (
    <div className={`tln-loader${inline ? " tln-loader--inline" : ""}`} role="status">
      <span className="tln-clap" aria-hidden="true">
        <span className="tln-clap__slate" />
        <span className="tln-clap__body" />
      </span>
      <span className="tln-loader__label">{label}</span>
    </div>
  );
}

function Countdown({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(3);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setN((v) => (v <= 1 ? 3 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [reduced]);
  return (
    <div className="tln-loader" role="status" aria-label={label}>
      <span className="tln-countdown" aria-hidden="true">
        <span className="tln-countdown__hand" />
        <span className="tln-countdown__num">{n}</span>
      </span>
      <span className="tln-loader__label">{label}</span>
    </div>
  );
}

function Slug({ line }: { line: string }) {
  const reduced = useReducedMotion();
  const [ti, setTi] = useState(0);
  useEffect(() => {
    if (reduced) return;
    // Types the line, holds it, then starts over — the prototype's loop.
    const t = setInterval(() => setTi((v) => (v > line.length + 14 ? 0 : v + 1)), 110);
    return () => clearInterval(t);
  }, [line, reduced]);
  const shown = reduced ? line : line.slice(0, Math.min(ti, line.length));
  return (
    <div className="tln-loader" role="status" aria-label="Loading editor">
      <span className="tln-slug" aria-hidden="true">
        {shown}
        <span className="tln-slug__caret" />
      </span>
    </div>
  );
}
