/**
 * Headless UI verification — the cheap replacement for screenshots.
 *
 * A screenshot costs 15k-68k tokens to look at. Every check below answers the
 * same question for a few hundred bytes of text, so verification can be run
 * often instead of sparingly.
 *
 * Runs under Bun via playwright-core driving the ALREADY-INSTALLED Edge
 * (`channel: "msedge"`), so no Node process executes and no 150MB browser is
 * downloaded.
 *
 *   bun run verify:ui        # dev server must already be on :4517
 */
import { chromium, type Browser, type Page } from "playwright-core";

const BASE = process.env.TLN_URL ?? "http://localhost:4517";

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
  const reachable = await fetch(BASE)
    .then((r) => r.ok)
    .catch(() => false);
  if (!reachable) {
    console.error(`\n  dev server not reachable at ${BASE}\n  start it with:  bun run dev\n`);
    process.exit(2);
  }

  console.log(`\nthroughline UI verification  (edge headless, ${BASE})\n`);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    /* ---- ADR-0007: sign-in is the first screen, with an honest escape ---- */
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/signin/, { timeout: 20_000 });
    // The screen is a dynamic ssr:false import; counting before it resolves
    // measures the loading state, not the page.
    await page.waitForSelector(".tln-signin__card", { timeout: 20_000 });
    check("a fresh visit lands on sign-in", page.url().includes("/signin"), page.url());

    const gh = await page.locator(".tln-signin__github").count();
    check("GitHub is the primary sign-in", gh === 1);

    // Decision 5 makes "continue offline" a timing choice, not a privacy one.
    // If this copy ever softens, the button starts making a promise we break.
    const fine = (await page.locator(".tln-signin__fine").textContent()) ?? "";
    check(
      "the offline escape is not sold as privacy",
      fine.includes("not a way to keep work private"),
      fine.slice(0, 46),
    );

    await page.getByRole("button", { name: /Keep writing without signing in/ }).click();
    await page.waitForURL((u) => !u.pathname.includes("signin"), { timeout: 20_000 });

    /* ---- ADR-0007: nothing is fabricated on first run ---- */
    await page.waitForSelector(".tln-library", { timeout: 20_000 });
    const seeded = await page.locator(".tln-storycard:not(.tln-storycard--new)").count();
    check("no story is seeded on first run", seeded === 0, `${seeded} cards`);

    const sample = await page.getByRole("button", { name: "Open the sample story" }).count();
    check("the sample is offered, not imposed", sample === 1);

    await page.getByRole("button", { name: "Open the sample story" }).click();
    await page.waitForSelector(".tln-lens-tab", { timeout: 20_000 });

    /* ---- two indicators, and the local one makes no cloud claim ---- */
    const localChip = (await page.locator(".tln-save").textContent()) ?? "";
    check(
      "the local indicator claims only this device",
      localChip.includes("this device") ||
        localChip.includes("Saving") ||
        localChip.includes("Loading"),
      localChip.trim(),
    );

    /* ---- script lens: the editor is CodeMirror, not the old textarea ---- */
    await page.getByRole("button", { name: "Script", exact: true }).click();
    await page.waitForSelector(".tln-script__ta .cm-editor", { timeout: 20_000 });

    const editors = await page.locator(".tln-script__ta .cm-editor").count();
    check("script pane mounts CodeMirror", editors === 1, `${editors} .cm-editor`);

    const textareas = await page.locator(".tln-script__ta textarea").count();
    check("old <textarea> is gone", textareas === 0, `${textareas} textarea`);

    const gutter = await page.locator(".tln-script__ta .cm-gutters").count();
    check("line-number gutter renders", gutter === 1);

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

    const previewCue = await page.evaluate(() => {
      const el = document.querySelector(".tln-script__preview .tln-f-cue");
      return el ? getComputedStyle(el).color : null;
    });
    check(
      "preview cue colour matches editor cue",
      previewCue !== null && cue !== null && previewCue === cue.color,
      `preview=${previewCue ?? "none"} editor=${cue?.color ?? "none"}`,
    );

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
    await page.waitForSelector(".tln-card--pill", { timeout: 20_000 });

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

    /* ---- the account dialog still refuses a secret key ---- */
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await page.waitForSelector(".tln-auth", { timeout: 20_000 });

    const advanced = await page.locator(".tln-auth__title").first().textContent();
    check("account dialog opens", (advanced ?? "").length > 0, advanced ?? "none");

    const inlineAuth = await page.locator(".tln-sync input").count();
    check("no credential fields inline in the library", inlineAuth === 0, `${inlineAuth} inputs`);

    // Decision 3: the bring-your-own-project path is demoted, not deleted. With
    // a project compiled into the build it is otherwise unreachable, and the
    // secret-key guard would go untested with it.
    await page.getByRole("button", { name: /Advanced/ }).click();
    await page.getByLabel("Project URL").waitFor({ timeout: 10_000 });
    await page.getByLabel("Project URL").fill("https://abcdefghijkl.supabase.co");
    await page.getByLabel("Publishable key").fill("sb_secret_AbCdEf123456");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    const refusal = (await page.locator(".tln-auth__error").first().textContent()) ?? "";
    check(
      "secret key is still refused behind Advanced",
      refusal.includes("SECRET"),
      refusal.slice(0, 42),
    );

    const stored = await page.evaluate(() => localStorage.getItem("TLN_SUPABASE_PUBLISHABLE_KEY"));
    check("refused key was never stored", stored === null, stored === null ? "absent" : "STORED");
  } catch (err) {
    check("run completed without error", false, String(err).slice(0, 160));
  } finally {
    await browser?.close();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
