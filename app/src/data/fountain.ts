// Fountain subset engine (T2 spec: research/fountain-subset.md).
// Pure functions only — parse, render preview HTML, build skeletons, assemble export.
import type { GraphEdge, GraphNode } from "../types";

/* ---------------------------------- slugs --------------------------------- */

/** Synced slug per §4: `{PREFIX} {LOCATION} - {TIME}`; UNTITLED degrades, DAY default. */
export function slugFor(scene: GraphNode, locationTitle: string | null): string {
  const prefix = scene.intExt ?? "INT.";
  const loc = (locationTitle ?? "UNTITLED").toUpperCase();
  const tod = scene.storyTime?.tod;
  return tod ? `${prefix} ${loc} - ${tod.toUpperCase()}` : `${prefix} ${loc}`;
}

export function locationTitleFor(
  sceneId: string,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): string | null {
  for (const e of Object.values(edges)) {
    if (e.type === "takes_place_at" && e.from === sceneId) return nodes[e.to]?.title ?? null;
  }
  return null;
}

/** Fragment body template with bracketed craft hints; slug is NOT included (locked line). */
export function skeletonBody(scene: GraphNode): string {
  const lines: string[] = [];
  if (scene.synopsis) lines.push(scene.synopsis, "");
  lines.push("[ACTION — what happens in this scene?]");
  lines.push("");
  lines.push("CHARACTER");
  lines.push("(optional parenthetical)");
  lines.push("Dialogue goes here…");
  return lines.join("\n");
}

/* ---------------------------------- parser -------------------------------- */

export type ElType =
  | "scene_heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "centered"
  | "lyric"
  | "page_break"
  | "section"
  | "synopsis";

export type El = {
  type: ElType;
  text: string;
  forced?: boolean;
  dual?: boolean;
  notes?: string[];
};

const HEADING_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)(\.|\s)/i;

function extractNotes(text: string): { text: string; notes?: string[] } {
  const notes: string[] = [];
  const clean = text.replace(/\[\[(.+?)\]\]/g, (_, n: string) => {
    notes.push(n.trim());
    return "";
  });
  return notes.length > 0 ? { text: clean.replace(/ {2,}/g, " ").trim(), notes } : { text };
}

function pushEl(els: El[], el: El): void {
  const { text, notes } = extractNotes(el.text);
  els.push(notes ? { ...el, text, notes } : { ...el, text });
}

/**
 * Line-based parser for the T2 subset. Nothing is rejected — unknown lines
 * fall back to Action per the Fountain error-handling rule.
 */
export function parseFountain(src: string): { titlePage: Record<string, string[]>; els: El[] } {
  const srcLines = src.replace(/\r\n?/g, "\n").split("\n");

  // Title page: key: value lines until the first blank; indent = continuation.
  let i = 0;
  const titlePage: Record<string, string[]> = {};
  let lastKey: string | null = null;
  for (; i < srcLines.length; i++) {
    const line = srcLines[i] ?? "";
    if (line.trim() === "") break;
    const m = /^([^a-z][^:]{0,48}):\s*(.*)$/.exec(line);
    if (m && !/^\s/.test(line)) {
      lastKey = m[1].trim();
      titlePage[lastKey] = m[2].trim() ? [m[2].trim()] : [];
    } else if (lastKey && /^\s{3,}|\t/.test(line)) {
      titlePage[lastKey]?.push(line.trim());
    } else {
      break; // not a title page after all
    }
  }
  const hasTitlePage = Object.keys(titlePage).length > 0 && i < srcLines.length;
  if (!hasTitlePage) i = 0;

  const els: El[] = [];
  const at = (k: number): string => srcLines[k] ?? "";
  const blank = (k: number): boolean => at(k).trim() === "";

  let dialogueMode = false; // inside a cue block
  while (i < srcLines.length) {
    const raw = at(i);
    if (raw.trim() === "") {
      dialogueMode = false;
      i++;
      continue;
    }

    // Boneyard — may span blank lines.
    if (raw.startsWith("/*")) {
      const end = srcLines.indexOf("*/", i);
      i = end === -1 ? srcLines.length : end + 1;
      continue;
    }

    // Section / synopsis / page break / lyric / centered.
    if (/^#{1,6}\s*\S/.test(raw)) {
      pushEl(els, { type: "section", text: raw.replace(/^#+\s*/, ""), forced: true });
      i++;
      continue;
    }
    if (/^={3,}$/.test(raw.trim())) {
      pushEl(els, { type: "page_break", text: "", forced: true });
      i++;
      continue;
    }
    if (raw.startsWith("=")) {
      pushEl(els, { type: "synopsis", text: raw.replace(/^=+\s*/, ""), forced: true });
      i++;
      continue;
    }
    if (raw.startsWith("~")) {
      pushEl(els, { type: "lyric", text: raw.slice(1).trim(), forced: true });
      i++;
      continue;
    }
    if (/^>.*<$/.test(raw.trim())) {
      pushEl(els, { type: "centered", text: raw.trim().slice(1, -1).trim(), forced: true });
      i++;
      continue;
    }

    // Forced elements.
    if (/^[.]([A-Za-z0-9])/.test(raw)) {
      pushEl(els, { type: "scene_heading", text: raw.slice(1).trim(), forced: true });
      dialogueMode = false;
      i++;
      continue;
    }
    if (raw.startsWith("!")) {
      const para = collectParagraph(srcLines, i);
      pushEl(els, { type: "action", text: para.replace(/^!\s*/, ""), forced: true });
      dialogueMode = false;
      i = paragraphEnd(srcLines, i);
      continue;
    }
    if (raw.startsWith("@")) {
      pushEl(els, {
        type: "character",
        text: raw
          .slice(1)
          .trim()
          .replace(/\^[\s]*$/, "")
          .trimEnd(),
        forced: true,
      });
      dialogueMode = true;
      i++;
      continue;
    }
    if (raw.startsWith(">") && raw.trim().length > 1) {
      pushEl(els, { type: "transition", text: raw.slice(1).trim(), forced: true });
      dialogueMode = false;
      i++;
      continue;
    }

    // Scene heading: anchored prefix + blank neighbors (§2).
    if (HEADING_RE.test(raw) && (i === 0 || blank(i - 1)) && blank(i + 1)) {
      pushEl(els, { type: "scene_heading", text: raw.trim() });
      dialogueMode = false;
      i++;
      continue;
    }

    // Transition: uppercase …TO: with blank neighbors (§2).
    if (/^[A-Z0-9\s()'!,.-]+TO:\s*$/.test(raw) && blank(i - 1) && blank(i + 1)) {
      pushEl(els, { type: "transition", text: raw.trim(), forced: false });
      dialogueMode = false;
      i++;
      continue;
    }

    // Cue heuristic: all-caps, ≥1 letter, exactly one blank before (doc-start counts),
    // non-blank after. §3 ruling 4. Caret allowed (dual-dialogue marker).
    const prevBlankExactlyOne = i === 0 || (blank(i - 1) && !blank(i - 2));
    const isCue =
      /^[A-Z0-9\s().,'’#\-/&"!?^]+$/.test(raw) &&
      /[A-Z]/.test(raw) &&
      prevBlankExactlyOne &&
      !blank(i + 1);
    if (isCue && !dialogueMode) {
      const dual = /\^\s*$/.test(raw);
      pushEl(els, {
        type: "character",
        text: dual ? raw.replace(/\^[\s]*$/, "").trimEnd() : raw.trim(),
        ...(dual ? { dual: true } : {}),
      });
      dialogueMode = true;
      i++;
      continue;
    }

    // Parenthetical inside an open cue block.
    if (dialogueMode && /^\(.+\)$/.test(raw.trim())) {
      pushEl(els, { type: "parenthetical", text: raw.trim() });
      i++;
      continue;
    }

    // Dialogue continuation of an open cue block.
    if (dialogueMode) {
      pushEl(els, { type: "dialogue", text: collectParagraph(srcLines, i) });
      i = paragraphEnd(srcLines, i);
      continue;
    }

    // Default: Action paragraph (every carriage return intentional).
    pushEl(els, { type: "action", text: collectParagraph(srcLines, i) });
    dialogueMode = false;
    i = paragraphEnd(srcLines, i);
  }

  return { titlePage: hasTitlePage ? titlePage : {}, els };
}

function paragraphEnd(lines: string[], start: number): number {
  let j = start;
  while (j < lines.length && (lines[j] ?? "").trim() !== "") j++;
  return j;
}
function collectParagraph(lines: string[], start: number): string {
  return lines.slice(start, paragraphEnd(lines, start)).join("\n").trim();
}

/* --------------------------- editor classification ------------------------- */
// Powers the live in-editor highlighting in ../editor/FountainEditor. Deliberately
// a separate pass from parseFountain (rather than shared code) because this needs
// a LINE-addressable result for CodeMirror decorations, while parseFountain
// collapses each paragraph into one element -- but every rule below (regexes,
// blank-neighbour conditions, the boneyard "exact `*/` line" quirk, the
// exactly-one-blank-line cue heuristic) is a deliberate mirror of parseFountain's,
// so what a writer sees highlighted while typing never disagrees with what
// renderPreview/assembleExport will actually do with that text. If parseFountain's
// line rules change, update both.

export type LineKind = ElType | "boneyard" | "blank";
export type LineSpan = { from: number; to: number; kind: LineKind };

export function classifySceneLines(text: string): LineSpan[] {
  const lines = text.split("\n");
  const offsets: number[] = [];
  for (let at = 0, k = 0; k < lines.length; k++) {
    offsets.push(at);
    at += (lines[k] ?? "").length + 1;
  }

  const at = (k: number): string => lines[k] ?? "";
  const blank = (k: number): boolean => at(k).trim() === "";
  const span = (i: number, kind: LineKind): LineSpan => {
    const from = offsets[i] ?? text.length;
    return { from, to: from + at(i).length, kind };
  };

  const out: LineSpan[] = [];
  let dialogueMode = false;
  let boneyard = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = at(i);

    // Once inside a boneyard, parseFountain skips straight to its closing line
    // without evaluating anything else about the lines in between -- including
    // blank-line/dialogueMode resets -- so this branch must run before those checks.
    if (boneyard) {
      out.push(span(i, "boneyard"));
      if (raw === "*/") boneyard = false; // parseFountain requires an exact "*/" line
      continue;
    }
    if (raw.trim() === "") {
      dialogueMode = false;
      out.push(span(i, "blank"));
      continue;
    }
    if (raw.startsWith("/*")) {
      out.push(span(i, "boneyard"));
      boneyard = true; // same-line "/* ... */" does not close it -- parseFountain quirk
      continue;
    }

    if (/^#{1,6}\s*\S/.test(raw)) {
      out.push(span(i, "section"));
      continue;
    }
    if (/^={3,}$/.test(raw.trim())) {
      out.push(span(i, "page_break"));
      continue;
    }
    if (raw.startsWith("=")) {
      out.push(span(i, "synopsis"));
      continue;
    }
    if (raw.startsWith("~")) {
      out.push(span(i, "lyric"));
      continue;
    }
    if (/^>.*<$/.test(raw.trim())) {
      out.push(span(i, "centered"));
      continue;
    }
    if (/^[.]([A-Za-z0-9])/.test(raw)) {
      out.push(span(i, "scene_heading"));
      dialogueMode = false;
      continue;
    }
    if (raw.startsWith("!")) {
      out.push(span(i, "action"));
      dialogueMode = false;
      continue;
    }
    if (raw.startsWith("@")) {
      out.push(span(i, "character"));
      dialogueMode = true;
      continue;
    }
    if (raw.startsWith(">") && raw.trim().length > 1) {
      out.push(span(i, "transition"));
      dialogueMode = false;
      continue;
    }
    if (HEADING_RE.test(raw) && (i === 0 || blank(i - 1)) && blank(i + 1)) {
      out.push(span(i, "scene_heading"));
      dialogueMode = false;
      continue;
    }
    if (/^[A-Z0-9\s()'!,.-]+TO:\s*$/.test(raw) && blank(i - 1) && blank(i + 1)) {
      out.push(span(i, "transition"));
      dialogueMode = false;
      continue;
    }

    const prevBlankExactlyOne = i === 0 || (blank(i - 1) && !blank(i - 2));
    const isCue =
      /^[A-Z0-9\s().,'\u2019#\-/&"!?^]+$/.test(raw) &&
      /[A-Z]/.test(raw) &&
      prevBlankExactlyOne &&
      !blank(i + 1);
    if (isCue && !dialogueMode) {
      out.push(span(i, "character"));
      dialogueMode = true;
      continue;
    }

    if (dialogueMode && /^\(.+\)$/.test(raw.trim())) {
      out.push(span(i, "parenthetical"));
      continue;
    }
    if (dialogueMode) {
      out.push(span(i, "dialogue"));
      continue;
    }

    out.push(span(i, "action"));
    dialogueMode = false;
  }

  return out;
}

/** Same non-greedy `[[note]]` pattern as extractNotes, for an inline overlay
 *  decoration -- unlike extractNotes, this does not strip the note out. */
export function findNoteRanges(text: string): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (const m of text.matchAll(/\[\[.+?\]\]/g)) {
    if (m.index === undefined) continue;
    out.push({ from: m.index, to: m.index + m[0].length });
  }
  return out;
}

/* --------------------------------- preview -------------------------------- */

const esc = (s: string): string =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const CLASS: Partial<Record<ElType, string>> = {
  scene_heading: "tln-f-slug",
  action: "tln-f-action",
  character: "tln-f-cue",
  parenthetical: "tln-f-paren",
  dialogue: "tln-f-dlg",
  transition: "tln-f-trans",
  centered: "tln-f-center",
  lyric: "tln-f-lyric",
};

/** Preview HTML per §0 degradation: sections/synopses hidden, boneyard excluded,
 *  dual dialogue stacked with badge, notes as inline chips. */
export function renderPreview(els: El[]): string {
  return els
    .map((el) => {
      const cls = CLASS[el.type];
      if (!cls || el.type === "page_break") {
        return el.type === "page_break" ? `<div class="tln-f-break"></div>` : "";
      }
      const noteChips = (el.notes ?? [])
        .map((n) => `<span class="tln-f-note">[[${esc(n)}]]</span>`)
        .join("");
      const dualBadge =
        el.type === "character" && el.dual ? `<span class="tln-f-dual">dual</span>` : "";
      return `<div class="${cls}${el.forced ? " tln-f-forced" : ""}">${noteChips}${dualBadge}${esc(el.text)}</div>`;
    })
    .join("\n");
}

/* ------------------------------ script order ------------------------------ */

export type SequenceItem = { container: GraphNode | null; scene: GraphNode };

/** Screenplay order (T6): container order arrays are authoritative; parentless
 *  flashbacks auto-insert immediately before their flashback_of target. */
export function scriptSequence(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): SequenceItem[] {
  const flashbackBefore = new Map<string, GraphNode[]>(); // targetSceneId → flashbacks
  const placedIds = new Set<string>();
  for (const e of Object.values(edges)) {
    if (e.type !== "flashback_of") continue;
    const fb = nodes[e.from];
    const targetParent = fb?.parentId ? nodes[fb.parentId] : undefined;
    // Only auto-place flashbacks that don't live in an ordered container already.
    if (fb && targetParent?.type !== "episode") {
      const arr = flashbackBefore.get(e.to) ?? [];
      arr.push(fb);
      flashbackBefore.set(e.to, arr);
    }
  }

  const out: SequenceItem[] = [];
  const containers = (project.order ?? [])
    .map((id) => nodes[id])
    .filter((c): c is GraphNode => Boolean(c) && c.type === "episode");

  const emitContainer = (container: GraphNode | null): void => {
    for (const sid of container?.order ?? []) {
      const sc = nodes[sid];
      if (!sc || sc.type !== "scene") continue;
      for (const fb of flashbackBefore.get(sid) ?? []) {
        if (!placedIds.has(fb.id)) {
          placedIds.add(fb.id);
          out.push({ container, scene: fb });
        }
      }
      placedIds.add(sc.id);
      out.push({ container, scene: sc });
    }
  };

  if (containers.length > 0) {
    for (const c of containers) emitContainer(c);
  } else {
    emitContainer(project); // feature mode: project.order holds scenes directly
  }

  // Any ordered-but-unplaced flashbacks trail their container's tail.
  for (const [target, fbs] of flashbackBefore) {
    void target;
    for (const fb of fbs) {
      if (!placedIds.has(fb.id)) {
        placedIds.add(fb.id);
        out.push({ container: null, scene: fb });
      }
    }
  }
  return out;
}

/* ---------------------------------- export -------------------------------- */

function kebab(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "untitled"
  );
}

function titlePageBlock(project: GraphNode): string {
  const kv: Array<[string, string[]]> = [
    ["Title:", [project.title]],
    ["Credit:", ["Written by"]],
    ["Author:", project.author ? [project.author] : []],
    ["Draft date:", [new Date().toLocaleDateString()]],
    ["Contact:", project.contact ? project.contact.split("\n") : []],
  ];
  return kv
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}\n${v.map((l) => `\t${l}`).join("\n")}`)
    .join("\n");
}

/** Whole-project export: title page + episode sections `# …` + synced-slug scenes. */
export function assembleExport(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): string {
  const parts: string[] = [titlePageBlock(project)];
  let currentContainerId: string | null | undefined;
  for (const item of scriptSequence(project, nodes, edges)) {
    const cid = item.container?.id ?? null;
    if (cid !== currentContainerId) {
      currentContainerId = cid;
      if (item.container && containersAreEpisodes(project, nodes)) {
        parts.push(`# ${item.container.title}`);
      }
    }
    const body = item.scene.fountain?.trim()
      ? item.scene.fountain.trim()
      : skeletonBody(item.scene);
    parts.push(`${slugFor(item.scene, locationTitleFor(item.scene.id, nodes, edges))}\n\n${body}`);
  }
  return `${parts.join("\n\n")}\n`;
}

function containersAreEpisodes(project: GraphNode, nodes: Record<string, GraphNode>): boolean {
  return (project.order ?? []).some((id) => nodes[id]?.type === "episode");
}

export function downloadFountain(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): void {
  const doc = assembleExport(project, nodes, edges);
  const url = URL.createObjectURL(new Blob([doc], { type: "text/fountain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kebab(project.title)}.fountain`;
  a.click();
  URL.revokeObjectURL(url);
}
