import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import {
  DEFAULT_SCRIPT_TYPOGRAPHY,
  SCRIPT_FONTS,
  getFontOption,
  loadScriptTypography,
  saveScriptTypography,
} from "../src/views/script/scriptTypography";

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
// @ts-expect-error test mock
globalThis.localStorage = mockStorage;
// @ts-expect-error test mock
globalThis.window = globalThis;

describe("scriptTypography", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterAll(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  it("retrieves the default font option when unknown id is passed", () => {
    const fallback = getFontOption("unknown-font-id");
    expect(fallback.id).toBe("noto-sans");

    const mandali = getFontOption("mandali");
    expect(mandali.name).toBe("Mandali");
    expect(mandali.nativeName).toBe("మండలి");
    expect(mandali.cssFamily).toContain("Mandali");
  });

  it("includes all requested premier Telugu fonts in SCRIPT_FONTS catalog", () => {
    const ids = SCRIPT_FONTS.map((f) => f.id);
    expect(ids).toContain("noto-sans");
    expect(ids).toContain("mandali");
    expect(ids).toContain("ramabhadra");
    expect(ids).toContain("noto-serif");
    expect(ids).toContain("suranna");
    expect(ids).toContain("courier");
  });

  it("loads default typography when localStorage is empty or corrupt", () => {
    expect(loadScriptTypography()).toEqual(DEFAULT_SCRIPT_TYPOGRAPHY);

    mockStorage.setItem("throughline.script_font_id", "gibberish");
    mockStorage.setItem("throughline.script_font_size", "not-a-number");
    expect(loadScriptTypography()).toEqual(DEFAULT_SCRIPT_TYPOGRAPHY);
  });

  it("saves and reloads typography preferences accurately", () => {
    saveScriptTypography({
      fontId: "mandali",
      fontSize: 18,
      lineHeight: 1.8,
    });

    const loaded = loadScriptTypography();
    expect(loaded.fontId).toBe("mandali");
    expect(loaded.fontSize).toBe(18);
    expect(loaded.lineHeight).toBe(1.8);
  });
});
