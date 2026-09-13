/** Option 07 transparent header lockup: shot / reverse shot dialogue frames. */
export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <span className="tln-logo-lockup">
      <svg
        className="tln-logo"
        viewBox="0 0 128 128"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M29 15H12v18m87-18h17v18M12 96v17h17m70 0h17V96"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path d="M23 29h70v29H49L36 71V58H23Z" fill="var(--ink)" />
        <path d="M105 76H49v27h28l13 12v-12h15Z" fill="currentColor" />
        <path d="M46 38h25M34 47h47" stroke="var(--panel)" strokeWidth="3" />
        <path d="M67 85h20M60 94h34" stroke="var(--accent-fg)" strokeWidth="3" />
      </svg>
      <span className="tln-logo-lockup__type">
        <span className="tln-logo-lockup__title">Story Lane</span>
        <span className="tln-logo-lockup__subtitle">Stories made for the screen</span>
      </span>
    </span>
  );
}
