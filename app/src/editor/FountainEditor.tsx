// Robust drop-in replacement for ScriptView's plain <textarea>: a CodeMirror 6
// view with live Fountain-aware highlighting (fountainHighlight.ts, driven by
// the same line rules parseFountain/renderPreview already use).
//
// Deliberately carries NO history/undo extension. Ctrl+Z / Ctrl+Shift+Z are
// owned exclusively by the graph's own persisted op-log (ADR-0003, wired as a
// global window keydown listener in App.tsx) -- adding CodeMirror's own
// history() here would register its own Mod-z/Mod-y bindings and fight that
// listener for the same shortcut, splitting one coalesced graph-level undo
// entry into an invisible character-level CM stack underneath it.
import { defaultKeymap } from "@codemirror/commands";
import { EditorState, StateEffect } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type ViewUpdate,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { fountainSceneHighlighting } from "./fountainHighlight";

/** Tags a dispatch as "external sync" so the update listener can skip
 *  re-scheduling a write-back of text that just came from outside. */
const externalSync = StateEffect.define<boolean>();

type Props = {
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  className?: string;
};

export default function FountainEditor({ value, onChange, onBlur, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Refs so the mount effect below can stay dependency-free: it should run
  // exactly once (recreating the view on every keystroke would drop focus,
  // scroll position and selection every time `value` changes).
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: "false" }),
          // These three are purely visual (gutter + current-line tint) and
          // register no keybindings, so they cannot collide with the
          // no-history choice above -- they just make it read as an editor.
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          fountainSceneHighlighting,
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (!update.docChanged) return;
            const isSync = update.transactions.some((tr) =>
              tr.effects.some((e) => e.is(externalSync)),
            );
            if (isSync) return;
            onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            blur: () => {
              onBlurRef.current();
              return false;
            },
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; see comment above
  }, []);

  // Adopt text that changed for reasons other than typing here: switching to a
  // different scene, or a graph-level undo/redo reverting this scene's fountain.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      effects: externalSync.of(true),
    });
  }, [value]);

  return <div ref={hostRef} className={className} />;
}
