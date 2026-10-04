import { useEffect, useRef, useState } from "react";
import {
  FONT_SIZES,
  LINE_HEIGHTS,
  SCRIPT_FONTS,
  getFontOption,
  type ScriptFontId,
  type ScriptFontSize,
  type ScriptLineHeight,
  type ScriptTypographyState,
} from "./scriptTypography";
import "./script-typography.css";

type Props = {
  typography: ScriptTypographyState;
  onChange: (next: ScriptTypographyState) => void;
  onInsertCueSnippet?: () => void;
};

export default function ScriptTypographyMenu({ typography, onChange, onInsertCueSnippet }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentFont = getFontOption(typography.fontId);

  const selectFont = (fontId: ScriptFontId) => {
    onChange({ ...typography, fontId });
  };

  const selectSize = (fontSize: ScriptFontSize) => {
    onChange({ ...typography, fontSize });
  };

  const selectLineHeight = (lineHeight: ScriptLineHeight) => {
    onChange({ ...typography, lineHeight });
  };

  return (
    <div className="tln-script-typo" ref={containerRef}>
      <button
        type="button"
        className="tln-script-typo__btn"
        title="Screenplay Typography & Telugu Font Support"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>Font / అక్షరాలు</span>
        <span className="tln-script-typo__badge">{currentFont.name}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div
            className="tln-script-typo__scrim"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="tln-script-typo__popover" role="dialog" aria-label="Script Typography">
            <div className="tln-script-typo__handle" aria-hidden="true" />
          <div className="tln-script-typo__header">
            <div>
              <div className="tln-script-typo__title">Telugu & Script Typography</div>
              <div className="tln-script-typo__sub">తెలుగు ఫాంట్ & అక్షర అమరికలు</div>
            </div>
            <button
              type="button"
              className="tln-script-typo__close"
              aria-label="Close typography menu"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="tln-script-typo__section">
            <span className="tln-script-typo__label">Screenplay Font (తెలుగు ఫాంట్లు)</span>
            <div className="tln-script-typo__fonts">
              {SCRIPT_FONTS.map((font) => {
                const isActive = font.id === typography.fontId;
                return (
                  <button
                    key={font.id}
                    type="button"
                    className={`tln-script-typo__font-item${
                      isActive ? " tln-script-typo__font-item--active" : ""
                    }`}
                    onClick={() => selectFont(font.id)}
                  >
                    <div className="tln-script-typo__font-name">
                      <span>{font.name}</span>
                      <span className="tln-script-typo__font-native">{font.nativeName}</span>
                    </div>
                    <div
                      className="tln-script-typo__font-sample"
                      style={{ fontFamily: font.cssFamily }}
                    >
                      {font.sampleText}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tln-script-typo__section">
            <span className="tln-script-typo__label">Size (అక్షర పరిమాణం)</span>
            <div className="tln-script-typo__row">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`tln-script-typo__pill${
                    typography.fontSize === size ? " tln-script-typo__pill--active" : ""
                  }`}
                  onClick={() => selectSize(size)}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div className="tln-script-typo__section">
            <span className="tln-script-typo__label">Line Height (వరుసల ఎడం)</span>
            <div className="tln-script-typo__row">
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  className={`tln-script-typo__pill${
                    typography.lineHeight === lh.value ? " tln-script-typo__pill--active" : ""
                  }`}
                  onClick={() => selectLineHeight(lh.value)}
                >
                  {lh.value}x
                </button>
              ))}
            </div>
          </div>

          <div className="tln-script-typo__tip">
            <strong>Telugu Screenplay Tip:</strong> Character names in Telugu Fountain format use{" "}
            <code>@</code> (e.g. <code>@రమేష్</code> or <code>@రమేష్ (నవ్వుతూ)</code>) so they align as
            dialogue cues.
            {onInsertCueSnippet && (
              <button
                type="button"
                className="tln-btn"
                style={{ marginTop: "6px", width: "100%", justifyContent: "center" }}
                onClick={() => {
                  onInsertCueSnippet();
                  setOpen(false);
                }}
              >
                + Insert Telugu Character Cue (@)
              </button>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
