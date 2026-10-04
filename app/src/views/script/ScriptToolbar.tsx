import { useRef, useState } from "react";
import ScriptDownloads from "../ScriptDownloads";
import { useGraphStore } from "../../store";
import ScriptTypographyMenu from "./ScriptTypographyMenu";
import type { ScriptTypographyState } from "./scriptTypography";

type ScriptToolbarProps = {
  slug: string;
  typography: ScriptTypographyState;
  onTypographyChange: (next: ScriptTypographyState) => void;
  onInsertCueSnippet?: () => void;
};

export default function ScriptToolbar({
  slug,
  typography,
  onTypographyChange,
  onInsertCueSnippet,
}: ScriptToolbarProps) {
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const onImportFile = async (file: File) => {
    const raw = await file.text();
    const n = useGraphStore.getState().importFountain(raw);
    setImportNote(n > 0 ? `Imported ${n} scene${n === 1 ? "" : "s"}` : "No scene headings found");
    setTimeout(() => setImportNote(null), 5000);
  };

  return (
    <div className="tln-script__toolbar">
      <div className="tln-slug" title="Graph-owned — edit in Inspector">
        {slug}
      </div>
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
