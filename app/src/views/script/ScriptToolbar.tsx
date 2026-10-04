import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Search, Upload, X } from "lucide-react";
import ScriptDownloads from "../ScriptDownloads";
import { useGraphStore } from "../../store";
import ScriptTypographyMenu from "./ScriptTypographyMenu";
import type { ScriptTypographyState } from "./scriptTypography";
import type { GraphNode } from "../../types";
import { getInitialSlugDraft, parseSceneHeading } from "./scriptHeading";
import { slugFor } from "../../data/fountain";

type SequenceItem = {
  container: GraphNode | null;
  scene: GraphNode;
};

type ScriptToolbarProps = {
  slug: string;
  scene?: GraphNode;
  onPatchScene?: (patch: Partial<GraphNode>, locationName?: string) => void;
  typography: ScriptTypographyState;
  onTypographyChange: (next: ScriptTypographyState) => void;
  onInsertCueSnippet?: () => void;
  sequence: SequenceItem[];
  effectiveSceneId: string | null;
  onSelectScene: (id: string) => void;
  locationBySceneId: Map<string, string>;
};

export default function ScriptToolbar({
  slug,
  scene,
  onPatchScene,
  typography,
  onTypographyChange,
  onInsertCueSnippet,
  sequence,
  effectiveSceneId,
  onSelectScene,
  locationBySceneId,
}: ScriptToolbarProps) {
  const [importNote, setImportNote] = useState<string | null>(null);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const fileInput = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const isCancelingRef = useRef(false);

  // Close scene picker popover on click outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [pickerOpen]);

  // Scene navigation math
  const currentIndex = sequence.findIndex((item) => item.scene.id === effectiveSceneId);
  const totalScenes = sequence.length;
  const currentItem = currentIndex >= 0 ? sequence[currentIndex] : undefined;
  const currentContainer = currentItem?.container;
  const prevScene = currentIndex > 0 ? sequence[currentIndex - 1]?.scene : undefined;
  const nextScene = currentIndex >= 0 && currentIndex < totalScenes - 1 ? sequence[currentIndex + 1]?.scene : undefined;

  const onImportFile = async (file: File) => {
    const raw = await file.text();
    const n = useGraphStore.getState().importFountain(raw);
    setImportNote(n > 0 ? `Imported ${n} scene${n === 1 ? "" : "s"}` : "No scenes found");
    setTimeout(() => setImportNote(null), 4000);
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

  // Grouped scenes for jump popover
  const groupedPickerList = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const map = new Map<
      string,
      { title: string; items: Array<{ scene: GraphNode; index: number; slugText: string }> }
    >();

    sequence.forEach((item, index) => {
      const cId = item.container?.id ?? "standalone";
      const cTitle = item.container?.title ?? "Ungrouped";
      const locTitle =
        locationBySceneId.get(item.scene.id) ??
        (item.scene.title && !item.scene.title.toLowerCase().startsWith("new scene")
          ? item.scene.title
          : null);
      const itemSlug = slugFor(item.scene, locTitle);

      if (q) {
        const matchTitle = item.scene.title.toLowerCase().includes(q);
        const matchEp = cTitle.toLowerCase().includes(q);
        const matchSlug = itemSlug.toLowerCase().includes(q);
        if (!matchTitle && !matchEp && !matchSlug) return;
      }

      let grp = map.get(cId);
      if (!grp) {
        grp = { title: cTitle, items: [] };
        map.set(cId, grp);
      }
      grp.items.push({ scene: item.scene, index, slugText: itemSlug });
    });

    return Array.from(map.entries()).map(([id, data]) => ({
      id,
      title: data.title,
      items: data.items,
    }));
  }, [sequence, pickerQuery, locationBySceneId]);

  const hasDistinctTitle = Boolean(
    scene?.title &&
      scene.title.toUpperCase() !== slug.toUpperCase() &&
      !scene.title.toLowerCase().startsWith("new scene") &&
      scene.title.toLowerCase() !== "untitled scene",
  );

  return (
    <div className="tln-script__toolbar">
      {/* 1. Scene Navigation & Picker */}
      <div className="tln-script__scene-nav">
        <button
          type="button"
          className="tln-icon-btn"
          disabled={!prevScene}
          onClick={() => prevScene && onSelectScene(prevScene.id)}
          title={prevScene ? `Previous: #${currentIndex} ${prevScene.title}` : "First scene"}
          aria-label="Previous scene"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>

        <div className="tln-script__scene-picker-wrap" ref={pickerRef}>
          <button
            type="button"
            className="tln-script__scene-picker-btn"
            onClick={() => setPickerOpen((p) => !p)}
            aria-expanded={pickerOpen}
            title="Jump to scene or episode"
            aria-label={`Current scene: ${currentIndex >= 0 ? currentIndex + 1 : 1} of ${totalScenes}. Click to jump`}
          >
            <span className="tln-script__scene-picker-num">
              {currentIndex >= 0 ? `#${currentIndex + 1}/${totalScenes}` : "Scene"}
            </span>
            {currentContainer && (
              <span className="tln-script__scene-picker-ep">{currentContainer.title}</span>
            )}
            <ChevronDown size={12} className="tln-script__scene-picker-caret" aria-hidden="true" />
          </button>

          {pickerOpen && (
            <div className="tln-script__scene-picker-popover" role="dialog" aria-label="Jump to scene">
              <div className="tln-script__picker-search">
                <Search size={13} aria-hidden="true" />
                <input
                  autoFocus
                  placeholder="Jump to scene or episode..."
                  aria-label="Search scene to jump to"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
              </div>

              <div className="tln-script__picker-scroll">
                {groupedPickerList.length === 0 ? (
                  <div className="tln-script__picker-empty">No matching scenes</div>
                ) : (
                  groupedPickerList.map((grp) => (
                    <div key={grp.id} className="tln-script__picker-group">
                      <div className="tln-script__picker-group-title">{grp.title}</div>
                      {grp.items.map((it) => {
                        const isActive = it.scene.id === scene?.id;
                        return (
                          <button
                            key={it.scene.id}
                            type="button"
                            className={`tln-script__picker-row${isActive ? " tln-script__picker-row--active" : ""}`}
                            onClick={() => {
                              onSelectScene(it.scene.id);
                              setPickerOpen(false);
                            }}
                          >
                            <span className="tln-script__picker-num">#{it.index + 1}</span>
                            <span className="tln-script__picker-name">{it.scene.title || "Untitled"}</span>
                            <span className="tln-script__picker-slug">{it.slugText}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="tln-icon-btn"
          disabled={!nextScene}
          onClick={() => nextScene && onSelectScene(nextScene.id)}
          title={nextScene ? `Next: #${currentIndex + 2} ${nextScene.title}` : "Last scene"}
          aria-label="Next scene"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      {/* 2. Scene Heading & Pencil Editor */}
      <div className="tln-script__heading-slot">
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

      {/* 3. Minimal Icon Tool Actions (Right side) */}
      <div className="tln-script__tool-actions">
        {/* Typography in compact mode */}
        <ScriptTypographyMenu
          typography={typography}
          onChange={onTypographyChange}
          onInsertCueSnippet={onInsertCueSnippet}
          compact
        />

        {/* Import as icon button */}
        <button
          type="button"
          className="tln-icon-btn"
          onClick={() => fileInput.current?.click()}
          title="Import screenplay (.fountain, .txt)"
          aria-label="Import screenplay"
        >
          <Upload size={15} aria-hidden="true" />
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

        {/* Download as icon button */}
        <ScriptDownloads typography={typography} iconOnly />

        {importNote && <span className="tln-script__note">{importNote}</span>}
      </div>
    </div>
  );
}
