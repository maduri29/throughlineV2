import { useRef } from "react";
import { useGraphStore } from "../store";
import { assembleExport, downloadFountain, parseFountain, renderPreview } from "../data/fountain";
import "./script-downloads.css";

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export default function ScriptDownloads() {
  const menu = useRef<HTMLDetailsElement>(null);
  function exportAs(format: "fountain" | "pdf" | "json") {
    window.dispatchEvent(new Event("throughline:flush-script"));
    const state = useGraphStore.getState();
    const project = state.projectId ? state.nodes[state.projectId] : undefined;
    if (!project) return;
    if (menu.current) menu.current.open = false;
    if (format === "json") return state.exportProject();
    if (format === "fountain") return downloadFountain(project, state.nodes, state.edges);
    const popup = window.open("", "_blank");
    if (!popup) {
      window.alert("Allow pop-ups to open the script print preview.");
      return;
    }
    popup.opener = null;
    const parsed = parseFountain(assembleExport(project, state.nodes, state.edges));
    popup.document
      .write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(project.title)}</title><style>
      @page { size: letter; margin: 1in 1in 1in 1.5in; }
      body { font: 12pt/1.2 Courier, "Courier New", monospace; color: #111; max-width: 6in; margin: 40px auto; padding: 24px; }
      .title-page { text-align: center; padding-top: 2in; min-height: 6in; break-after: page; }
      h1 { font: inherit; text-transform: uppercase; }
      .tln-f-action,.tln-f-dlg { white-space: pre-wrap; margin: 12pt 0; }
      .tln-f-slug { margin: 24pt 0 12pt; break-after: avoid; }
      .tln-f-cue { margin: 12pt 0 0 2in; break-after: avoid; }
      .tln-f-paren { margin: 0 1.2in 0 1.6in; break-after: avoid; }
      .tln-f-dlg { margin: 0 1in 12pt 1in; }
      .tln-f-trans { text-align: right; margin: 12pt 0; }
      .tln-f-center { text-align: center; }
      .tln-f-break { break-before: page; }
      .tln-f-note,.tln-f-dual { display: none; }
      .print-help { font: 14px/1.5 system-ui; padding: 16px; background: #eee; }
      @media print { body { margin: 0; padding: 0; max-width: none; } .print-help { display: none; } }
    </style></head><body><p class="print-help">Use your browser’s Print command (Ctrl+P / ⌘P), then choose “Save as PDF”. Turn off browser headers and footers for a clean script.</p><section class="title-page"><h1>${escape(project.title)}</h1>${Object.entries(
      parsed.titlePage,
    )
      .filter(([key]) => key.toLowerCase() !== "title")
      .map(([, lines]) => `<p>${lines.map(escape).join("<br>")}</p>`)
      .join("")}</section><main>${renderPreview(parsed.els)}</main></body></html>`);
    popup.document.close();
    popup.focus();
  }
  return (
    <details
      className="script-downloads"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current) menu.current.open = false;
      }}
    >
      <summary>
        Download <span aria-hidden="true">▾</span>
      </summary>
      <div className="script-downloads__menu">
        <strong>Save your script</strong>
        <button onClick={() => exportAs("fountain")}>
          <b>Fountain (.fountain) · Recommended</b>
          <span>
            Editable screenplay text. Best for continuing to write; import it back in Script view.
          </span>
        </button>
        <button onClick={() => exportAs("pdf")}>
          <b>Print / Save as PDF</b>
          <span>Formatted reading copy for sharing. Opens a print preview in a new tab.</span>
        </button>
        <button onClick={() => exportAs("json")}>
          <b>Story backup (.json)</b>
          <span>
            Restore your story, scenes, characters and connections in Throughline. Attachment files
            are excluded.
          </span>
        </button>
        <small>
          Exports follow your script order. Scenes without script text use their outline template.
        </small>
      </div>
    </details>
  );
}
