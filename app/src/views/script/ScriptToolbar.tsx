import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Search, Upload, X } from "lucide-react";
import ScriptDownloads from "../ScriptDownloads";
import { useGraphStore } from "../../store";
import ScriptTypographyMenu from "./ScriptTypographyMenu";
import type { ScriptTypographyState } from "./scriptTypography";
import type { GraphNode } from "../../types";
import {
  applyPrefixToSlug,
  applyTodToSlug,
  getInitialSlugDraft,
  parseSceneHeading,
} from "./scriptHeading";
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
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [slugDraft, setSlugDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const fileInput = useRef<HTMLInputElement | null>(null);
  const editContainerRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Close scene picker on outside click
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

  // Close title/slug edit box on outside click
  useEffect(() => {
    if (!isEditing) return;
    const handleDown = (e: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    };
    window.addEventListener("mousedown", handleDown);
    return () => {
      window.removeEventListener("mousedown", handleDown);
    };
  }, [isEditing]);

  // Scene navigation math
  const currentIndex = sequence.findIndex((item) => item.scene.id === effectiveSceneId);
  const totalScenes = sequence.length;
  const currentItem = currentIndex >= 0 ? sequence[currentIndex] : undefined;
  const currentContainer = currentItem?.container;
  const prevScene = currentIndex > 0 ? sequence[currentIndex - 1]?.scene : undefined;
  const nextScene =
    currentIndex >= 0 && currentIndex < totalScenes - 1 ? sequence[currentIndex + 1]?.scene : undefined;

  const onImportFile = async (file: File) => {
    const raw = await file.text();
    const n = useGraphStore.getState().importFountain(raw);
    setImportNote(n > 0 ? `Imported ${n} scene${n === 1 ? "" : "s"}` : "No scenes found");
    setTimeout(() => setImportNote(null), 4000);
  };

  const handleStartEditing = () => {
    if (!scene || !onPatchScene) return;
    setTitleDraft(scene.title || "");
    const initialSlug = getInitialSlugDraft(slug, scene);
    setSlugDraft(initialSlug);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveEditing = () => {
    setIsEditing(false);
    if (!scene || !onPatchScene) return;

    const trimmedTitle = titleDraft.trim();
    const finalTitle = trimmedTitle || scene.title || "Untitled Scene";
    const parsedSlug = parseSceneHeading(slugDraft, scene);

    const patch: Partial<GraphNode> = {
      title: finalTitle,
    };
    if (parsedSlug.intExt) {
      patch.intExt = parsedSlug.intExt;
    }
    if (parsedSlug.tod !== undefined) {
      patch.storyTime = {
        ...(scene.storyTime ?? { storyDay: null, eraLabel: null }),
        storyDay: scene.storyTime?.storyDay ?? null,
        eraLabel: scene.storyTime?.eraLabel ?? null,
        tod: parsedSlug.tod,
      };
    }

    const locationSync = parsedSlug.location || finalTitle;
    onPatchScene(patch, locationSync);
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
                            <span className="tln-script__picker-name">
                              {it.scene.title || "Untitled"}
                            </span>
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

      {/* 2. Scene Title & Heading Slot */}
      <div className="tln-script__heading-slot" ref={editContainerRef}>
        {isEditing ? (
          <form
            className="tln-slug-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEditing();
            }}
          >
            {/* Top row: Scene Title input & Action buttons */}
            <div className="tln-slug-edit__inputs-grid">
              <div className="tln-slug-edit__field">
                <span className="tln-slug-edit__field-label">Scene Title</span>
                <input
                  autoFocus
                  className="tln-slug-edit__input"
                  aria-label="Scene Title"
                  placeholder="Scene name (e.g. The Coffee Shop)"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelEditing();
                    }
                  }}
                />
              </div>

              <div className="tln-slug-edit__field">
                <span className="tln-slug-edit__field-label">Scene Heading (Slugline)</span>
                <input
                  className="tln-slug-edit__input tln-slug-edit__input--slug"
                  aria-label="Scene Heading"
                  placeholder="e.g. INT. COFFEE SHOP - DAY"
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelEditing();
                    }
                  }}
                />
              </div>

              <div className="tln-slug-edit__actions">
                <button
                  type="submit"
                  className="tln-slug-edit__btn tln-slug-edit__btn--save"
                  title="Save changes (Enter)"
                  aria-label="Save changes"
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  className="tln-slug-edit__btn tln-slug-edit__btn--cancel"
                  title="Cancel editing (Escape)"
                  aria-label="Cancel editing"
                  onClick={handleCancelEditing}
                >
                  <X size={14} aria-hidden="true" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>

            {/* Presets Chips: Prefix & Time of Day */}
            <div className="tln-slug-edit__chips" role="group" aria-label="Heading quick presets">
              <span className="tln-slug-edit__chips-label">Prefix:</span>
              {(["INT.", "EXT.", "INT./EXT."] as const).map((prefix) => (
                <button
                  key={prefix}
                  type="button"
                  className="tln-slug-chip"
                  onClick={() => setSlugDraft((curr) => applyPrefixToSlug(curr, prefix))}
                >
                  {prefix}
                </button>
              ))}

              <span className="tln-slug-chip__sep" aria-hidden="true">
                ·
              </span>

              <span className="tln-slug-edit__chips-label">Time:</span>
              {["DAY", "NIGHT", "DAWN", "DUSK", "CONTINUOUS"].map((tod) => (
                <button
                  key={tod}
                  type="button"
                  className="tln-slug-chip"
                  onClick={() => setSlugDraft((curr) => applyTodToSlug(curr, tod))}
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
              className="tln-slug-btn"
              title={onPatchScene ? "Click to rename scene title and heading" : "Scene heading"}
              onClick={handleStartEditing}
            >
              <span className="tln-slug-btn__title">{scene?.title || "Untitled Scene"}</span>
              <span className="tln-slug-btn__divider" aria-hidden="true">
                ·
              </span>
              <span className="tln-slug-btn__slug">{slug || "INT. UNTITLED - DAY"}</span>
            </button>
            {onPatchScene && (
              <button
                type="button"
                className="tln-slug__pencil-btn"
                title="Edit scene title and heading"
                aria-label="Edit scene title and heading"
                onClick={handleStartEditing}
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
