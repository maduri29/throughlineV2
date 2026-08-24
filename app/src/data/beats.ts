// Beat sheets: structured rows, with a text view that must not lose anything.
//
// Two representations of one thing is the classic source of quiet data loss, so
// the rules here are deliberately narrow:
//
//   * the structured Beat[] is the single source of truth;
//   * the text view carries name, done and note — everything a person edits;
//   * a scene link is structural, has no sensible text form, and is carried
//     across a text edit by matching on the beat NAME.
//
// Name matching, not position. Position looks reasonable and is quietly wrong:
// delete the first two rows and the third inherits the first one's scene link,
// attaching a beat to a scene with nothing to do with it. A test caught that.
import type { Beat } from "../types";

export type { Beat };

const LINE = /^\s*-\s*\[( |x|X)\]\s*(.*)$/;

/** `- [x] Name` with any following indented lines as the note. */
export function parseBeats(text: string): Array<Omit<Beat, "id">> {
  const out: Array<Omit<Beat, "id">> = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (m) {
      out.push({ name: (m[2] ?? "").trim(), done: (m[1] ?? " ").toLowerCase() === "x" });
      continue;
    }
    // A non-beat line belongs to the beat above it. Text before any beat is
    // dropped rather than silently becoming a nameless beat.
    const last = out[out.length - 1];
    if (!last) continue;
    const trimmed = raw.trim();
    if (!trimmed && !last.note) continue;
    last.note = last.note === undefined ? trimmed : `${last.note}\n${trimmed}`;
  }
  // Trailing blank lines inside a note are noise from editing, not content.
  for (const b of out) if (b.note !== undefined) b.note = b.note.replace(/\s+$/, "");
  return out;
}

export function serializeBeats(beats: Beat[]): string {
  return beats
    .map((b) => {
      const head = `- [${b.done ? "x" : " "}] ${b.name}`;
      if (!b.note) return head;
      const body = b.note
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      return `${head}\n${body}`;
    })
    .join("\n");
}

/**
 * Fold a text edit back onto the structured rows.
 *
 * Identity travels by NAME, not position. Position matching looks reasonable
 * and is quietly wrong: delete the first two rows and the third inherits the
 * first one's scene link, silently attaching a beat to a scene that has nothing
 * to do with it. A test caught exactly that.
 *
 * Name matching is predictable in both directions — reorder freely and links
 * follow their beat; rename a beat and it loses its link, which is annoying but
 * never incorrect. Duplicate names are claimed in order.
 */
export function mergeBeats(
  existing: Beat[],
  parsed: Array<Omit<Beat, "id">>,
  newId: () => string,
): Beat[] {
  const unclaimed = [...existing];
  const claim = (name: string): Beat | undefined => {
    const i = unclaimed.findIndex((b) => b.name === name);
    return i === -1 ? undefined : unclaimed.splice(i, 1)[0];
  };
  return parsed.map((p) => {
    const prior = claim(p.name);
    return {
      id: prior?.id ?? newId(),
      name: p.name,
      done: p.done,
      ...(p.note ? { note: p.note } : {}),
      ...(prior?.sceneId ? { sceneId: prior.sceneId } : {}),
    };
  });
}

export function beatProgress(beats: Beat[]): { done: number; total: number } {
  return { done: beats.filter((b) => b.done).length, total: beats.length };
}
