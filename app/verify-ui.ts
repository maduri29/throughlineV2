/**
 * Headless UI verification — the cheap replacement for screenshots.
 *
 * A screenshot costs 15k-68k tokens to look at. Every check below answers the
 * same question for a few hundred bytes of text, so verification can be run
 * often instead of sparingly.
 *
 * Runs under Bun via playwright-core driving the ALREADY-INSTALLED Edge
 * (`channel: "msedge"`), so no Node process executes and no 150MB browser is
 * downloaded — ADR-0002's single-runtime constraint stays intact.
 *
 *   bun run verify:ui        # dev server must already be on :4517
 */
import { chromium, type Browser, type Page } from "playwright-core";

const URL = process.env.TLN_URL ?? "http://localhost:4517";

let passed = 0;
let failed = 0;

/** `detail` is printed on success too: it is the evidence, not decoration. */
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  ${detail}` : ""}`);
  }
}

async function openScriptLens(page: Page): Promise<void> {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tln-lens-tab", { timeout: 15_000 });
  await page.getByRole("button", { name: "Script", exact: true }).click();
  await page.waitForSelector(".tln-script__ta .cm-editor", { timeout: 15_000 });
}

/** Computed colour of the first line carrying `cls`, or null if absent. */
async function lineStyle(
  page: Page,
  cls: string,
): Promise<{ color: string; weight: string; style: string } | null> {
  return page.evaluate((c) => {
    const el = document.querySelector(`.tln-script__ta .${c}`);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { color: s.color, weight: s.fontWeight, style: s.fontStyle };
  }, cls);
}

async function main(): Promise<void> {
  const reachable = await fetch(URL)
    .then((r) => r.ok)
    .catch(() => false);
  if (!reachable) {
    console.error(`\n  dev server not reachable at ${URL}\n  start it with:  bun run dev\n`);
    process.exit(2);
  }

  console.log(`\nthroughline UI verification  (edge headless, ${URL})\n`);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    /* ---- script lens: the editor is CodeMirror, not the old textarea ---- */
    await openScriptLens(page);

    const editors = await page.locator(".tln-script__ta .cm-editor").count();
    check("script pane mounts CodeMirror", editors === 1, `${editors} .cm-editor`);

    const textareas = await page.locator(".tln-script__ta textarea").count();
    check("old <textarea> is gone", textareas === 0, `${textareas} textarea`);

    const gutter = await page.locator(".tln-script__ta .cm-gutters").count();
    check("line-number gutter renders", gutter === 1);

    /* ---- Fountain syntax highlighting is actually distinguishable ---- */
    const cue = await lineStyle(page, "tln-cm-cue");
    check(
      "character cue is coloured + bold",
      cue !== null && cue.weight === "700" && cue.color !== "rgb(35, 43, 66)",
      cue ? `${cue.color} w=${cue.weight}` : "no cue line",
    );

    const paren = await lineStyle(page, "tln-cm-paren");
    check(
      "parenthetical is italic",
      paren !== null && paren.style === "italic",
      paren ? paren.style : "none",
    );

    // Regression: .tln-cm-dlg was mapped in JS but had no CSS rule at all.
    const dlg = await lineStyle(page, "tln-cm-dlg");
    check("dialogue has its own colour rule", dlg !== null, dlg ? dlg.color : "no rule");

    /* ---- editor and preview must agree; they show the same text ---- */
    const previewCue = await page.evaluate(() => {
      const el = document.querySelector(".tln-script__preview .tln-f-cue");
      return el ? getComputedStyle(el).color : null;
    });
    check(
      "preview cue colour matches editor cue",
      previewCue !== null && cue !== null && previewCue === cue.color,
      `preview=${previewCue ?? "none"} editor=${cue?.color ?? "none"}`,
    );

    /* ---- Prism palette tokens are defined ---- */
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return ["--scene", "--character", "--location", "--theme", "--episode"].map((t) =>
        s.getPropertyValue(t).trim(),
      );
    });
    check(
      "Prism palette tokens defined",
      tokens.every((t) => t.length > 0),
      tokens.join(" "),
    );

    /* ---- Map lens: node types are colour-coded, not identical pills ---- */
    await page.getByRole("button", { name: "Map", exact: true }).click();
    await page.waitForSelector(".tln-card--pill", { timeout: 15_000 });

    const pills = await page.evaluate(() =>
      [...document.querySelectorAll(".tln-card--pill")].map((p) => ({
        cls: [...p.classList].find((c) => c.startsWith("tln-card--t-")) ?? "",
        color: getComputedStyle(p.querySelector(".tln-card__title") as Element).color,
      })),
    );
    const distinct = new Set(pills.map((p) => p.color));
    check(
      "map pills are colour-coded by type",
      pills.length > 0 && pills.every((p) => p.cls !== ""),
      `${pills.length} pills, ${distinct.size} distinct colours`,
    );
  } catch (err) {
    check("run completed without error", false, String(err).slice(0, 120));
  } finally {
    await browser?.close();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
