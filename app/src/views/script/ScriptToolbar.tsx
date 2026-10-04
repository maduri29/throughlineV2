import { useRef, useState } from "react";
import { Check, Pencil, Upload, X } from "lucide-react";
import ScriptDownloads from "../ScriptDownloads";
import { useGraphStore } from "../../store";
import ScriptTypographyMenu from "./ScriptTypographyMenu";
import type { ScriptTypographyState } from "./scriptTypography";
import type { GraphNode } from "../../types";
import { getInitialSlugDraft, parseSceneHeading } from "./scriptHeading";

type ScriptToolbarProps = {
  slug: string;
  scene?: GraphNode;
  onPatchScene?: (patch: Partial<GraphNode>, locationName?: string) => void;
  typography: ScriptTypographyState;
  onTypographyChange: (next: ScriptTypographyState) => void;
  onInsertCueSnippet?: () => void;
  sceneNumber?: number;
  totalScenes?: number;
  onOpenMobileScenes?: () => void;
};

export default function ScriptToolbar({
  slug,
  scene,
  onPatchScene,
  typography,
  onTypographyChange,
  onInsertCueSnippet,
  sceneNumber,
  totalScenes,
  onOpenMobileScenes,
}: ScriptToolbarProps) {
  const [importNote, setImportNote] = useState<string | null>(null);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isCancelingRef = useRef(false);

  const onImportFile = async (file: File) => {
    const raw = await file.text();
    const n = useGraphStore.getState().importFountain(raw);
    setImportNote(n > 0 ? `Imported ${n} scene${n === 1 ? "" : "s"}` : "No scene headings found");
    setTimeout(() => setImportNote(null), 5000);
  };

  const handleStartEditingSlug = () => {
    if (!scene || !onPatchScene) return;
    isCancelingRef.current = false;
    const initialText = getInitialSlugDraft(slug, scene);
    setSlugDraft(initialText);
    setIsEditingSlug(true);
  };

  const handleCancelSlug = () => {
    isCancelingRef.current = true;
    setIsEditingSlug(false);
  };

  const handleSaveSlug = () => {
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      return;
    }
    setIsEditingSlug(false);
    const trimmed = slugDraft.trim();
    if (!trimmed || !scene) return;

    const parsed = parseSceneHeading(trimmed, scene);
    const patch: Partial<GraphNode> = {
      title: parsed.title,
    };
    if (parsed.intExt) {
      patch.intExt = parsed.intExt;
    }
    if (parsed.tod !== undefined) {
      patch.storyTime = {
        ...(scene.storyTime ?? { storyDay: null, eraLabel: null }),
        storyDay: scene.storyTime?.storyDay ?? null,
        eraLabel: scene.storyTime?.eraLabel ?? null,
        tod: parsed.tod,
      };
    }

    onPatchScene?.(patch, parsed.location);
  };

  const applyPrefix = (prefix: "INT." | "EXT." | "INT./EXT.") => {
    setSlugDraft((prev) => {
      const cleaned = prev.replace(/^(I\/E\.?|INT\.?\/EXT\.?|INT\.?|EXT\.?|EST\.?)\s*/i, "");
      return `${prefix} ${cleaned.trim()}`;
    });
    inputRef.current?.focus();
  };

  const applyTod = (tod: string) => {
    setSlugDraft((prev) => {
      const dash = prev.lastIndexOf(" - ");
      const base = dash >= 0 ? prev.slice(0, dash).trim() : prev.trim();
      return `${base} - ${tod}`;
    });
    inputRef.current?.focus();
  };

  const hasDistinctTitle = Boolean(
    scene?.title &&
      scene.title.toUpperCase() !== slug.toUpperCase() &&
      !scene.title.toLowerCase().startsWith("new scene") &&
      scene.title.toLowerCase() !== "untitled scene",
  );

  return (
    <div className="tln-script__toolbar">
      <div className="tln-script__toolbar-row tln-script__toolbar-row--heading">
        {isEditingSlug ? (
          <form
            className="tln-slug-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveSlug();
            }}
          >
            <div className="tln-slug-edit__input-row">
              <input
                ref={inputRef}
                autoFocus
                aria-label="Scene heading"
                placeholder="e.g. INT. COFFEE SHOP - DAY"
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                onBlur={handleSaveSlug}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancelSlug();
                  }
                }}
              />
              <button
                type="submit"
                className="tln-slug-edit__btn tln-slug-edit__btn--save"
                title="Save heading (Enter)"
                aria-label="Save heading"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSaveSlug}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="tln-slug-edit__btn tln-slug-edit__btn--cancel"
                title="Cancel editing (Escape)"
                aria-label="Cancel editing"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCancelSlug}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="tln-slug-edit__chips" role="group" aria-label="Heading quick presets">
              <span className="tln-slug-edit__chips-label">Presets:</span>
              <button
                type="button"
                className="tln-slug-chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyPrefix("INT.")}
              >
                INT.
              </button>
              <button
                type="button"
                className="tln-slug-chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyPrefix("EXT.")}
              >
                EXT.
              </button>
              <button
                type="button"
                className="tln-slug-chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyPrefix("INT./EXT.")}
              >
                INT./EXT.
              </button>
              <span className="tln-slug-chip__sep" aria-hidden="true">
                ·
              </span>
              {["DAY", "NIGHT", "DAWN", "DUSK"].map((tod) => (
                <button
                  key={tod}
                  type="button"
                  className="tln-slug-chip"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTod(tod)}
                >
                  {tod}
                </button>
              ))}
            </div>
          </form>
        ) : (
          <div className="tln-slug-box">
            <button
              type="button"
              className="tln-slug tln-slug--interactive"
              title={onPatchScene ? "Click to rename scene heading" : "Scene heading"}
              onClick={handleStartEditingSlug}
            >
              <span className="tln-slug__text">{slug || "UNTITLED SCENE"}</span>
              {hasDistinctTitle && (
                <span className="tln-slug__alias" title={`Outline title: ${scene?.title}`}>
                  {scene?.title}
                </span>
              )}
            </button>
            {onPatchScene && (
              <button
                type="button"
                className="tln-slug__pencil-btn"
                title="Edit scene heading"
                aria-label="Edit scene heading"
                onClick={handleStartEditingSlug}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tln-script__toolbar-row tln-script__toolbar-row--actions">
        {sceneNumber !== undefined && totalScenes !== undefined && onOpenMobileScenes && (
          <button
            type="button"
            className="tln-script__scene-indicator"
            onClick={onOpenMobileScenes}
            title="View script order & scenes"
            aria-label={`Scene ${sceneNumber} of ${totalScenes}. Tap to open scenes list`}
          >
            Scene {sceneNumber} / {totalScenes}
          </button>
        )}

        <ScriptTypographyMenu
          typography={typography}
          onChange={onTypographyChange}
          onInsertCueSnippet={onInsertCueSnippet}
        />

        <button
          type="button"
          className="tln-btn tln-btn--import"
          onClick={() => fileInput.current?.click()}
          title="Import screenplay (.fountain or .txt)"
        >
          <Upload size={13} className="tln-btn__icon" aria-hidden="true" />
          <span>Import .fountain</span>
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
    </div>
  );
}
