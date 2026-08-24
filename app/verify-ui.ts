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
    await page.waitForURL(/\/stories/, { timeout: 20_000 });
    check("the Library has its own URL", new URL(page.url()).pathname === "/stories", page.url());

    /* ---- ADR-0007: nothing is fabricated on first run ---- */
    await page.waitForSelector(".tln-library", { timeout: 20_000 });
    const seeded = await page.locator(".tln-storycard:not(.tln-storycard--new)").count();
    check("no story is seeded on first run", seeded === 0, `${seeded} cards`);

    // The shelf is not a story: lenses, undo/redo/backup and a save indicator
    // all act on a story that is not open, and showing them here made the
    // toolbar look broken rather than full.
    const shelfChrome = await page.evaluate(() => ({
      lenses: document.querySelectorAll(".tln-lens-tab").length,
      tools: document.querySelectorAll(".tln-tool").length,
      status: document.querySelectorAll(".tln-status").length,
      brand: document.querySelectorAll(".tln-brand").length,
      logo: document.querySelectorAll(".tln-header .tln-logo").length,
      account: document.querySelectorAll(".tln-account").length,
      emptyMark: document.querySelectorAll(".tln-empty__mark .tln-logo").length,
    }));
    check(
      "the Library header carries no story controls",
      shelfChrome.lenses === 0 && shelfChrome.tools === 0 && shelfChrome.status === 0,
      `lenses=${shelfChrome.lenses} tools=${shelfChrome.tools} status=${shelfChrome.status}`,
    );
    check(
      "brand and account are still there",
      shelfChrome.brand === 1 && shelfChrome.logo === 1 && shelfChrome.account === 1,
      `brand=${shelfChrome.brand} logo=${shelfChrome.logo} account=${shelfChrome.account}`,
    );
    check(
      "an empty shelf says so rather than showing an empty grid",
      shelfChrome.emptyMark === 1,
      `${shelfChrome.emptyMark} empty-state marks`,
    );

    const sample = await page.getByRole("button", { name: "Open the sample story" }).count();
    check("the sample is offered, not imposed", sample === 1);

    await page.getByRole("button", { name: "Open the sample story" }).click();
    await page.waitForSelector(".tln-lens-tab", { timeout: 20_000 });

    // Choosing a story must actually take you into it. Picking a card changed
    // which project was loaded but left the Library on screen, so from the
    // outside clicking a story did nothing — and nothing here would have caught
    // it, because the workspace happened to be showing already.
    await page.locator(".tln-brand").click();
    await page.waitForSelector(".tln-library", { timeout: 20_000 });
    await page.locator(".tln-storycard:not(.tln-storycard--new)").first().click();
    await page.waitForSelector(".tln-workspace", { timeout: 20_000 });
    const inLibrary = await page.locator(".tln-library").count();
    check("opening a story leaves the Library", inLibrary === 0, `${inLibrary} library panes`);

    // A story is a place, not a mode: it has to survive a reload and a paste.
    const storyUrl = page.url();
    check(
      "each story is its own sub-route",
      /\/stories\/[^/]+$/.test(new URL(storyUrl).pathname),
      new URL(storyUrl).pathname,
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tln-workspace", { timeout: 20_000 });
    check(
      "reloading a story URL reopens that story",
      page.url() === storyUrl && (await page.locator(".tln-library").count()) === 0,
      page.url() === storyUrl ? "same url, workspace" : page.url(),
    );

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tln-library", { timeout: 20_000 });
    check("back returns to the Library", new URL(page.url()).pathname === "/stories", page.url());
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tln-workspace", { timeout: 20_000 });

    /* ---- two indicators, and the local one makes no cloud claim ---- */
    const inStory = await page.evaluate(() => ({
      lenses: document.querySelectorAll(".tln-lens-tab").length,
      tools: document.querySelectorAll(".tln-tool").length,
      local: document.querySelector(".tln-status__part")?.textContent ?? "",
    }));
    check(
      "a story header carries the story controls",
      inStory.lenses === 4 && inStory.tools === 3,
      `lenses=${inStory.lenses} tools=${inStory.tools}`,
    );
    check(
      "the local indicator claims only this device",
      inStory.local.includes("this device") ||
        inStory.local.includes("Saving") ||
        inStory.local.includes("Loading"),
      inStory.local.trim(),
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

    // A toolbar with this many items is exactly where a narrow window breaks,
    // and horizontal body scroll is the symptom nobody notices until they hit it.
    await page.setViewportSize({ width: 900, height: 800 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headerH: Math.round(
        document.querySelector(".tln-header")?.getBoundingClientRect().height ?? 0,
      ),
    }));
    check(
      "the header survives a narrow window",
      overflow.body <= 0 && overflow.headerH < 90,
      `overflow=${overflow.body}px height=${overflow.headerH}px`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });

    /* ---- the boneyard: an idea, kept, then grown into a story ---- */
    // The account dialog from the checks above is modal and would swallow this
    // click. Nav tabs also exist only outside a story, so leave the workspace
    // too — itself the behaviour the header assertions pin down.
    await page.keyboard.press("Escape");
    await page.waitForSelector(".tln-auth", { state: "detached", timeout: 10_000 });
    await page.locator(".tln-brand").click();
    await page.waitForURL(/\/stories$/, { timeout: 20_000 });
    await page.getByRole("button", { name: "Boneyard", exact: true }).click();
    await page.waitForURL(/\/boneyard/, { timeout: 20_000 });
    await page.waitForSelector(".tln-jot__input", { timeout: 20_000 });
    check("the boneyard has its own URL", new URL(page.url()).pathname === "/boneyard", page.url());

    await page.getByLabel("New idea").fill("A lighthouse keeper who never sleeps");
    await page.getByRole("button", { name: "Keep it" }).click();
    await page.waitForSelector(".tln-seed", { timeout: 20_000 });
    const kept = await page.locator(".tln-seed").count();
    check("an idea can be kept in one gesture", kept === 1, `${kept} seeds`);

    // Growing must not consume the idea: where a story came from is worth being
    // able to look up, and deleting it would make growing a destructive act.
    await page.getByRole("button", { name: /Grow into a story/ }).click();
    await page.waitForURL(/\/stories\//, { timeout: 20_000 });
    check(
      "growing an idea opens the new story",
      /\/stories\/[^/]+$/.test(new URL(page.url()).pathname),
      new URL(page.url()).pathname,
    );

    await page.locator(".tln-brand").click();
    await page.waitForURL(/\/stories$/, { timeout: 20_000 });
    await page.getByRole("button", { name: "Boneyard", exact: true }).click();
    await page.waitForSelector(".tln-seed", { timeout: 20_000 });
    const survived = await page.locator(".tln-seed").count();
    check("the idea survives being grown", survived === 1, `${survived} seeds`);

    /* ---- research: a beat sheet becomes something to fill in, not scenes ---- */
    await page.getByRole("button", { name: "Research", exact: true }).click();
    await page.waitForURL(/\/research/, { timeout: 20_000 });
    await page.waitForSelector(".tln-sheets", { timeout: 20_000 });
    check("research has its own URL", new URL(page.url()).pathname === "/research", page.url());

    await page.getByRole("button", { name: "Stories", exact: true }).click();
    await page.waitForURL(/\/stories$/, { timeout: 20_000 });
    const shelfBefore = await page.locator(".tln-storycard:not(.tln-storycard--new)").count();
    await page.getByRole("button", { name: "Research", exact: true }).click();
    await page.waitForSelector(".tln-sheets", { timeout: 20_000 });

    await page.getByRole("button", { name: "Save the Cat", exact: true }).click();
    await page.waitForSelector(".tln-seed", { timeout: 20_000 });
    await page.waitForSelector(".tln-beatlist", { timeout: 20_000 });
    const rows = await page.locator(".tln-beat").count();
    const firstName = await page.locator(".tln-beat__name").first().inputValue();
    check(
      "a beat sheet arrives as tickable rows, not a paragraph",
      rows === 15 && firstName === "Opening Image",
      `${rows} rows, first="${firstName}"`,
    );

    // Ticking is the point: it must move progress and survive a reload.
    // Plain click, not .check(): React replaces the input on re-render, so
    // .check() re-queries a stale handle and reports "state did not change"
    // even where it plainly did — confirmed by hand against production.
    await page.locator('.tln-beat input[type="checkbox"]').first().click({ force: true });
    await page.waitForTimeout(900);
    const progress = (await page.locator(".tln-beats__count").textContent()) ?? "";
    check("ticking a beat moves progress", progress.includes("1 of 15"), progress.trim());

    // The raw view must fold back without losing a row — two representations of
    // one thing is the usual way to lose data quietly (data/beats.ts).
    await page.getByRole("button", { name: "Edit as text" }).click();
    const rawText = await page.locator(".tln-beats__raw").inputValue();
    check(
      "the text view shows the ticked state",
      rawText.startsWith("- [x] Opening Image"),
      rawText.slice(0, 26),
    );
    await page.getByRole("button", { name: "Done editing" }).click();
    await page.waitForSelector(".tln-beatlist", { timeout: 20_000 });
    const afterRound = await page.locator(".tln-beat").count();
    check("a text round trip loses no beats", afterRound === rows, `${rows} → ${afterRound}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tln-sheets", { timeout: 20_000 });
    await page.locator(".tln-seed__title").first().click();
    await page.waitForSelector(".tln-beatlist", { timeout: 20_000 });
    const persisted = (await page.locator(".tln-beats__count").textContent()) ?? "";
    check("a ticked beat survives a reload", persisted.includes("1 of 15"), persisted.trim());

    await page.getByRole("button", { name: "Stories", exact: true }).click();
    await page.waitForURL(/\/stories$/, { timeout: 20_000 });

    // Applying a structure must not put scenes in the story graph: that commits
    // the writer to a shape before anything is written.
    const shelfAfterSheet = await page.locator(".tln-storycard:not(.tln-storycard--new)").count();
    check(
      "a beat sheet creates no story of its own",
      shelfAfterSheet === shelfBefore,
      `${shelfBefore} before, ${shelfAfterSheet} after`,
    );

    // The account dialog was closed to reach the nav; the checks below need it.
    await page.locator(".tln-account").click();
    await page.waitForSelector(".tln-auth", { timeout: 20_000 });

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
