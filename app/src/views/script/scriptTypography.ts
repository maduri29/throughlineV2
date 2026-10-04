export type ScriptFontId =
  | "noto-sans"
  | "mandali"
  | "ramabhadra"
  | "noto-serif"
  | "suranna"
  | "courier";

export type ScriptFontOption = {
  id: ScriptFontId;
  name: string;
  nativeName: string;
  category: "Sans" | "Serif" | "Monospace" | "Display";
  cssFamily: string;
  description: string;
  sampleText: string;
};

export const SCRIPT_FONTS: ScriptFontOption[] = [
  {
    id: "noto-sans",
    name: "Noto Sans Telugu",
    nativeName: "నోటో సాన్స్ తెలుగు",
    category: "Sans",
    cssFamily: '"Noto Sans Telugu", "Courier Prime", "Courier New", sans-serif',
    description: "Modern, crisp, high-legibility sans-serif with excellent conjunct rendering.",
    sampleText: "రమేష్: కథ ఇప్పుడే మొదలైంది.",
  },
  {
    id: "mandali",
    name: "Mandali",
    nativeName: "మండలి",
    category: "Serif",
    cssFamily: '"Mandali", "Courier Prime", "Courier New", serif',
    description: "Graceful, flowing Telugu font created by Tirumalets Setty for readable prose.",
    sampleText: "రమేష్: కథ ఇప్పుడే మొదలైంది.",
  },
  {
    id: "ramabhadra",
    name: "Ramabhadra",
    nativeName: "రామభద్ర",
    category: "Display",
    cssFamily: '"Ramabhadra", "Courier Prime", "Courier New", sans-serif',
    description: "Bold, confident Telugu display typeface by Purushoth Kumar Guthula.",
    sampleText: "రమేష్: కథ ఇప్పుడే మొదలైంది.",
  },
  {
    id: "noto-serif",
    name: "Noto Serif Telugu",
    nativeName: "నోటో సెరిఫ్ తెలుగు",
    category: "Serif",
    cssFamily: '"Noto Serif Telugu", "Courier Prime", "Courier New", serif',
    description: "Classic literary serif with authentic typographic curves and weight balance.",
    sampleText: "రమేష్: కథ ఇప్పుడే మొదలైంది.",
  },
  {
    id: "suranna",
    name: "Suranna",
    nativeName: "సూరన్న",
    category: "Serif",
    cssFamily: '"Suranna", "Courier Prime", "Courier New", serif',
    description: "Traditional Telugu publication font with clear letterforms.",
    sampleText: "రమేష్: కథ ఇప్పుడే మొదలైంది.",
  },
  {
    id: "courier",
    name: "Courier Prime + Telugu",
    nativeName: "క్లాసిక్ స్క్రిప్ట్",
    category: "Monospace",
    cssFamily: '"Courier Prime", "Courier New", "Noto Sans Telugu", monospace',
    description: "Screenplay-standard typewriter monospace with seamless Telugu fallback.",
    sampleText: "RAMESH / రమేష్: It begins now.",
  },
];

export type ScriptFontSize = 13 | 14 | 15 | 16 | 18;
export type ScriptLineHeight = 1.5 | 1.65 | 1.8;

export const FONT_SIZES: ScriptFontSize[] = [13, 14, 15, 16, 18];
export const LINE_HEIGHTS: { value: ScriptLineHeight; label: string }[] = [
  { value: 1.5, label: "Compact (1.5x)" },
  { value: 1.65, label: "Optimal Telugu (1.65x)" },
  { value: 1.8, label: "Relaxed (1.8x)" },
];

export type ScriptTypographyState = {
  fontId: ScriptFontId;
  fontSize: ScriptFontSize;
  lineHeight: ScriptLineHeight;
};

export const DEFAULT_SCRIPT_TYPOGRAPHY: ScriptTypographyState = {
  fontId: "noto-sans",
  fontSize: 15,
  lineHeight: 1.65,
};

const STORAGE_KEY_FONT = "throughline.script_font_id";
const STORAGE_KEY_SIZE = "throughline.script_font_size";
const STORAGE_KEY_LH = "throughline.script_line_height";

export function getFontOption(id: string): ScriptFontOption {
  return SCRIPT_FONTS.find((f) => f.id === id) ?? SCRIPT_FONTS[0]!;
}

export function loadScriptTypography(): ScriptTypographyState {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_TYPOGRAPHY;
  try {
    const rawFont = localStorage.getItem(STORAGE_KEY_FONT);
    const rawSize = localStorage.getItem(STORAGE_KEY_SIZE);
    const rawLh = localStorage.getItem(STORAGE_KEY_LH);

    const fontId = SCRIPT_FONTS.some((f) => f.id === rawFont)
      ? (rawFont as ScriptFontId)
      : DEFAULT_SCRIPT_TYPOGRAPHY.fontId;

    const parsedSize = rawSize ? Number(rawSize) : NaN;
    const fontSize = FONT_SIZES.includes(parsedSize as ScriptFontSize)
      ? (parsedSize as ScriptFontSize)
      : DEFAULT_SCRIPT_TYPOGRAPHY.fontSize;

    const parsedLh = rawLh ? Number(rawLh) : NaN;
    const lineHeight = LINE_HEIGHTS.some((lh) => Math.abs(lh.value - parsedLh) < 0.01)
      ? (parsedLh as ScriptLineHeight)
      : DEFAULT_SCRIPT_TYPOGRAPHY.lineHeight;

    return { fontId, fontSize, lineHeight };
  } catch {
    return DEFAULT_SCRIPT_TYPOGRAPHY;
  }
}

export function saveScriptTypography(state: ScriptTypographyState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_FONT, state.fontId);
    localStorage.setItem(STORAGE_KEY_SIZE, String(state.fontSize));
    localStorage.setItem(STORAGE_KEY_LH, String(state.lineHeight));
  } catch {
    // Ignore storage quota errors
  }
}
