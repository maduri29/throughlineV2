// CodeMirror 6 extension: live decorations for the Fountain scene-body editor
// (FountainEditor.tsx). Classification comes from data/fountain.ts's
// classifySceneLines / findNoteRanges -- the same line rules parseFountain
// already uses for the preview pane and the .fountain export -- so what a
// writer sees highlighted while typing never disagrees with what
// renderPreview/assembleExport will do with that same text.
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { classifySceneLines, findNoteRanges, type LineKind } from "../data/fountain";

const LINE_CLASS: Partial<Record<LineKind, string>> = {
  scene_heading: "tln-cm-heading",
  character: "tln-cm-cue",
  parenthetical: "tln-cm-paren",
  dialogue: "tln-cm-dlg",
  transition: "tln-cm-trans",
  centered: "tln-cm-center",
  lyric: "tln-cm-lyric",
  section: "tln-cm-section",
  synopsis: "tln-cm-synopsis",
  page_break: "tln-cm-break",
  boneyard: "tln-cm-boneyard",
};

function buildDecorations(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const ranges: Array<{ from: number; to: number; value: Decoration }> = [];

  for (const line of classifySceneLines(text)) {
    const cls = LINE_CLASS[line.kind];
    if (cls)
      ranges.push({ from: line.from, to: line.from, value: Decoration.line({ class: cls }) });
  }
  for (const note of findNoteRanges(text)) {
    if (note.to > note.from) {
      ranges.push({
        from: note.from,
        to: note.to,
        value: Decoration.mark({ class: "tln-cm-note" }),
      });
    }
  }

  // `sort: true` lets CodeMirror order line- and mark-decorations that share a
  // start position correctly, rather than hand-rolling that ordering here.
  return Decoration.set(
    ranges.map((r) => r.value.range(r.from, r.to)),
    true,
  );
}

/** Whole-document reclassification on every change. Scene bodies are one
 *  scene's worth of text, not a whole script, so this stays cheap -- and it
 *  sidesteps viewport-clipping bugs that an incremental/streaming classifier
 *  would risk around the blank-line-neighbour rules (e.g. the cue heuristic
 *  needs to see the line above and below, which a partial re-scan could miss). */
export const fountainSceneHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate): void {
      if (update.docChanged) this.decorations = buildDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
