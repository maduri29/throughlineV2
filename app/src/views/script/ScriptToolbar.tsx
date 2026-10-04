import { useRef, useState } from "react";
import ScriptDownloads from "../ScriptDownloads";
import { useGraphStore } from "../../store";
import ScriptTypographyMenu from "./ScriptTypographyMenu";
import type { ScriptTypographyState } from "./scriptTypography";
import type { GraphNode } from "../../types";

type ScriptToolbarProps = {
  slug: string;
  scene?: GraphNode;
  onPatchScene?: (patch: Partial<GraphNode>) => void;
  typography: ScriptTypographyState;
  onTypographyChange: (next: ScriptTypographyState) => void;
  onInsertCueSnippet?: () => void;
};

export default function ScriptToolbar({
  slug,
  scene,
  onPatchScene,
  typography,
  onTypographyChange,
  onInsertCueSnippet,
}: ScriptToolbarProps) {
  const [importNote, setImportNote] = useState<string | null>(null);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const onImportFile = async (file: File) => {
    const raw = await file.text();
    const n = useGraphStore.getState().importFountain(raw);
    setImportNote(n > 0 ? `Imported ${n} scene${n === 1 ? "" : "s"}` : "No scene headings found");
    setTimeout(() => setImportNote(null), 5000);
  };

  const handleStartEditingSlug = () => {
    if (!scene || !onPatchScene) return;
    setSlugDraft(scene.title || "");
    setIsEditingSlug(true);
  };

  const handleSaveSlug = () => {
    setIsEditingSlug(false);
    const trimmed = slugDraft.trim();
    if (trimmed && scene && trimmed !== scene.title) {
      onPatchScene?.({ title: trimmed });
    }
  };

  return (
    <div className="tln-script__toolbar">
      {isEditingSlug ? (
        <form
          className="tln-slug-edit"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveSlug();
          }}
        >
          <input
            autoFocus
            aria-label="Scene title"
            value={slugDraft}
            onChange={(e) => setSlugDraft(e.target.value)}
            onBlur={handleSaveSlug}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsEditingSlug(false);
            }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="tln-slug tln-slug--interactive"
          title={onPatchScene ? "Click to rename scene" : "Scene heading"}
          onClick={handleStartEditingSlug}
        >
          <span>{slug || "UNTITLED SCENE"}</span>
          {onPatchScene && (
            <span className="tln-slug__edit-hint" aria-hidden="true">
              {" "}✎
            </span>
          )}
        </button>
      )}
      <ScriptTypographyMenu
        typography={typography}
        onChange={onTypographyChange}
        onInsertCueSnippet={onInsertCueSnippet}
      />
      <button className="tln-btn" onClick={() => fileInput.current?.click()}>
        Import .fountain
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".fountain,.txt,text/plain"
        hidden
        onChange={() => {
          const f = fileInput.current?.files?.[0];
          fileInput.current!.value = "";
          if (f) void onImportFile(f);
        }}
      />
      {importNote ? <span className="tln-script__note">{importNote}</span> : null}
      <ScriptDownloads typography={typography} />
    </div>
  );
}
