export type Lens = "map" | "timeline" | "characters" | "script";

export const LENSES = [
  {
    id: "map" as Lens,
    label: "Map",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="3.5" cy="4" r="1.75" />
        <circle cx="12.5" cy="5" r="1.75" />
        <circle cx="8" cy="12.5" r="1.75" />
        <path d="M5.2 4.2l5.6.7M4.6 5.5l2.4 5.6M11.4 6.5l-2.4 4.6" />
      </svg>
    ),
  },
  {
    id: "timeline" as Lens,
    label: "Timeline",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="12" height="10.5" rx="2" />
        <path d="M5 1.5v3M11 1.5v3M2 7h12M5 10h1.5M9.5 10H11" />
      </svg>
    ),
  },
  {
    id: "characters" as Lens,
    label: "Characters",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="5" r="2.75" />
        <path d="M3 14a5 5 0 0 1 10 0" />
      </svg>
    ),
  },
  {
    id: "script" as Lens,
    label: "Script",
    icon: (
      <svg
        className="tln-lens-tab__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 2.5h6l3.5 3.5v7.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
        <path d="M9.5 2.5v3.5h3.5M5.5 8.5h5M5.5 11h3" />
      </svg>
    ),
  },
];

export const SECTIONS = [
  {
    id: "stories" as const,
    label: "Stories",
    href: "/stories",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M2.5 6.5h11M6 2.5v4M10 2.5v4" />
      </svg>
    ),
  },
  {
    id: "boneyard" as const,
    label: "Boneyard",
    href: "/boneyard",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8.5 1.5L3.5 9h4.5l-1 5.5 6-8h-4.5z" />
      </svg>
    ),
  },
  {
    id: "research" as const,
    label: "Research",
    href: "/research",
    icon: (
      <svg
        className="tln-nav__icon"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3.5 3.5" />
      </svg>
    ),
  },
];
