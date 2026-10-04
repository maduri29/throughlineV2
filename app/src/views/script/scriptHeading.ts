import { TODS } from "../../types";
import type { GraphNode, Tod } from "../../types";

export type ParsedSceneHeading = {
  title: string;
  intExt?: "INT." | "EXT." | "EST." | "INT./EXT.";
  tod?: Tod | null;
  location?: string;
};

/**
 * Parses user input from the scene heading editor into structured screenplay properties.
 * Supports standard Fountain prefixes (INT., EXT., EST., INT./EXT., I/E.),
 * time-of-day indicators (- DAY, - NIGHT, etc.), and freeform scene titles.
 */
export function parseSceneHeading(raw: string, currentScene?: GraphNode): ParsedSceneHeading {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { title: currentScene?.title ?? "Untitled Scene" };
  }

  // 1. Standard Fountain heading prefix
  const prefixMatch = /^(I\/E\.?|INT\.?\/EXT\.?|INT\.?|EXT\.?|EST\.?)\s+(.*)$/i.exec(trimmed);
  if (prefixMatch) {
    const rawPrefix = (prefixMatch[1] ?? "INT").toUpperCase().replace(/\.$/, "");
    const intExt: "INT." | "EXT." | "EST." | "INT./EXT." =
      rawPrefix === "EXT"
        ? "EXT."
        : rawPrefix === "EST"
          ? "EST."
          : rawPrefix === "I/E" || rawPrefix.startsWith("INT/EXT") || rawPrefix.startsWith("INT./EXT")
            ? "INT./EXT."
            : "INT.";

    const rest = (prefixMatch[2] ?? "").trim();
    const dashIndex = rest.lastIndexOf(" - ");
    let location = rest;
    let tod: Tod | null = currentScene?.storyTime?.tod ?? null;

    if (dashIndex >= 0) {
      const candidateTod = rest.slice(dashIndex + 3).trim().toUpperCase();
      for (const t of TODS) {
        if (t.toUpperCase() === candidateTod) {
          tod = t;
          location = rest.slice(0, dashIndex).trim();
          break;
        }
      }
    }

    return {
      title: location || currentScene?.title || "Scene",
      intExt,
      tod,
      location,
    };
  }

  // 2. No prefix, but ends with " - [TOD]"
  const dashIndex = trimmed.lastIndexOf(" - ");
  if (dashIndex >= 0) {
    const candidateTod = trimmed.slice(dashIndex + 3).trim().toUpperCase();
    for (const t of TODS) {
      if (t.toUpperCase() === candidateTod) {
        const location = trimmed.slice(0, dashIndex).trim();
        return {
          title: location || trimmed,
          intExt: currentScene?.intExt ?? "INT.",
          tod: t,
          location,
        };
      }
    }
  }

  // 3. Freeform title or location name
  return {
    title: trimmed,
    intExt: currentScene?.intExt,
    tod: currentScene?.storyTime?.tod ?? null,
    location: trimmed,
  };
}

/**
 * Builds the default draft text when entering slug edit mode.
 */
export function getInitialSlugDraft(slug: string, scene?: GraphNode): string {
  if (slug && slug !== "INT. UNTITLED") {
    return slug;
  }
  if (
    scene?.title &&
    !scene.title.toLowerCase().startsWith("new scene") &&
    scene.title.toLowerCase() !== "untitled scene"
  ) {
    const p = scene.intExt ?? "INT.";
    const t = scene.storyTime?.tod;
    return t
      ? `${p} ${scene.title.toUpperCase()} - ${t.toUpperCase()}`
      : `${p} ${scene.title.toUpperCase()}`;
  }
  return "INT. UNTITLED - DAY";
}
