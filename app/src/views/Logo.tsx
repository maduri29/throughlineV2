/**
 * The mark: one unbroken line rising through three points and back down.
 *
 * It is the product's name drawn literally — a throughline is the single thread
 * running through a story — and it happens to trace a story arc, with the beats
 * sitting on it. Both readings are true at once, which is why this shape rather
 * than a generic glyph.
 *
 * `currentColor` throughout so it inherits whatever it sits on, and no fixed
 * pixel size: the caller sets it.
 */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="tln-logo"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="Throughline"
    >
      <path
        d="M3 19C6 19 7 5 12 5s6 14 9 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="3" cy="19" r="2.3" fill="currentColor" />
      <circle cx="12" cy="5" r="2.3" fill="currentColor" />
      <circle cx="21" cy="19" r="2.3" fill="currentColor" />
    </svg>
  );
}
