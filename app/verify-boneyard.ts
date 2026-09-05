import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const base = process.env.TLN_URL ?? "http://localhost:4519";
let count = 0;
const check = (name: string, ok: boolean) => {
  assert.ok(ok, name);
  count++;
  console.log(`PASS ${name}`);
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/boneyard`);
  await page.getByLabel("New idea", { exact: true }).waitFor();
  await page
    .getByLabel("New idea", { exact: true })
    .fill("A lighthouse remembers\nevery ship it has lost.");
  await page.reload();
  await page.getByLabel("New idea", { exact: true }).waitFor();
  check(
    "capture draft survives reload",
    (await page.getByLabel("New idea", { exact: true }).inputValue()).includes("every ship"),
  );
  await page.getByRole("button", { name: "Keep idea", exact: true }).click();
  await page.locator(".by-card").waitFor();
  check("multiline capture creates one idea", (await page.locator(".by-card").count()) === 1);
  check(
    "saved capture clears composer",
    (await page.getByLabel("New idea", { exact: true }).inputValue()) === "",
  );
  await page.getByLabel("New idea", { exact: true }).fill("A radio that broadcasts tomorrow");
  await page.getByRole("button", { name: "Keep idea", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".by-card").length === 2);
  await page.locator(".by-collections > summary").click();
  await page.getByLabel("New collection name").fill("Coastal mysteries");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.locator(".by-collection-editor").waitFor();
  await page.getByLabel("New collection name").fill("Unreliable memories");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".by-collection-editor").length === 2);
  await page
    .locator(".by-card")
    .filter({ hasText: "A lighthouse remembers" })
    .getByRole("button", { name: "Explore idea" })
    .click();
  await page.getByLabel("Idea body", { exact: true }).waitFor();
  const ideaUrl = page.url();
  await page.getByLabel("Add a thought", { exact: true }).fill("Maybe the keeper cannot swim.");
  await page.getByRole("button", { name: "Add thought", exact: true }).click();
  await page.locator(".by-thought").waitFor();
  check(
    "follow-up is separate from core text",
    !(await page.getByLabel("Idea body", { exact: true }).inputValue()).includes("keeper"),
  );
  await page.getByLabel("Coastal mysteries", { exact: true }).click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".by-detail label")).some(
      (el) => el.textContent?.trim() === "Coastal mysteries" && el.querySelector("input")?.checked,
    ),
  );
  await page.getByLabel("Unreliable memories", { exact: true }).click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".by-detail label")).some(
      (el) =>
        el.textContent?.trim() === "Unreliable memories" && el.querySelector("input")?.checked,
    ),
  );
  await page.getByLabel("Coastal mysteries", { exact: true }).click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".by-detail label")).some(
      (el) => el.textContent?.trim() === "Coastal mysteries" && !el.querySelector("input")?.checked,
    ),
  );
  check(
    "membership removal leaves other collection intact",
    await page.getByLabel("Unreliable memories", { exact: true }).isChecked(),
  );
  await page
    .getByLabel("Connect another idea")
    .selectOption({ label: "A radio that broadcasts tomorrow" });
  await page.getByLabel("Connection reason").fill("Both remember events out of order.");
  await page.getByRole("button", { name: "Connect ideas", exact: true }).click();
  await page
    .getByRole("button", { name: "A radio that broadcasts tomorrow", exact: true })
    .last()
    .waitFor();
  await page.getByRole("button", { name: "Back to ideas", exact: true }).click();
  await page.getByLabel("Search ideas", { exact: true }).fill("cannot swim");
  await page.waitForFunction(() => document.querySelectorAll(".by-card").length === 1);
  check(
    "search finds follow-up content",
    (await page.locator(".by-match").innerText()).includes("keeper"),
  );
  await page.getByLabel("Search ideas", { exact: true }).fill("");
  await page.goto(ideaUrl);
  await page.getByLabel("Idea body", { exact: true }).waitFor();
  check(
    "detail route and thought survive reload",
    (await page.locator(".by-thought").count()) === 1,
  );
  await page
    .getByLabel("Idea body", { exact: true })
    .fill("The lighthouse remembers every ship. The keeper remembers none.");
  await page.getByRole("button", { name: "Save idea", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".by-card__summary")?.textContent?.includes("keeper remembers") ||
      Array.from(document.querySelectorAll(".by-card__summary")).some((el) =>
        el.textContent?.includes("keeper remembers"),
      ),
  );
  await page.locator(".by-revisions > summary").click();
  check(
    "original capture is preserved",
    (await page.locator(".by-revisions").innerText()).includes("every ship it has lost"),
  );
  await page.getByRole("button", { name: "Evolve idea", exact: true }).click();
  await page.getByLabel("Evolution title").fill("The Last Light");
  await page.getByRole("button", { name: "Confirm evolution", exact: true }).click();
  await page.getByRole("button", { name: "Keep exploring", exact: true }).waitFor();
  await page.getByRole("button", { name: "Keep exploring", exact: true }).click();
  check(
    "evolution keeps source idea",
    (await page.getByLabel("Idea body", { exact: true }).count()) === 1,
  );
  await page.getByRole("button", { name: "Open story", exact: true }).click();
  await page.locator(".tln-workspace").waitFor();
  await page.locator(".by-origins > summary").click();
  check(
    "story retains source snapshot and backlink",
    (await page.locator(".by-origins").innerText()).includes("keeper remembers"),
  );
  await page.getByRole("button", { name: "Explore source idea", exact: true }).click();
  await page.getByLabel("Idea body", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Move to trash", exact: true }).click();
  await page.getByRole("button", { name: "Restore to ideas", exact: true }).waitFor();
  await page.getByRole("button", { name: "Restore to ideas", exact: true }).click();
  await page
    .locator(".by-detail")
    .getByRole("button", { name: "Set aside", exact: true })
    .waitFor();
  check("trash is recoverable", (await page.locator(".by-thought").count()) === 1);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up ideas", exact: true }).click();
  const download = await downloadEvent;
  check("Boneyard backup downloads", download.suggestedFilename().startsWith("boneyard-"));
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    check(
      `detail fits ${width}px`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Back to ideas", exact: true }).click();
  await page.getByLabel("New idea", { exact: true }).waitFor({ state: "visible" });
  check("phone feed has capture", await page.getByLabel("New idea", { exact: true }).isVisible());
  const restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const restored = await restoreContext.newPage();
  await restored.goto(`${base}/boneyard`);
  await restored.getByLabel("New idea", { exact: true }).waitFor();
  const backupPath = await download.path();
  assert.ok(backupPath);
  await restored.getByLabel("Import ideas backup").setInputFiles(backupPath);
  await restored.waitForFunction(() => document.querySelectorAll(".by-card").length === 2);
  check(
    "backup restores ideas onto another device",
    (await restored.locator(".by-card").count()) === 2,
  );
  await restored
    .locator(".by-card")
    .filter({ hasText: "keeper remembers" })
    .getByRole("button", { name: "Explore idea", exact: true })
    .click();
  await restored.getByLabel("Idea body", { exact: true }).waitFor();
  check(
    "backup restores thoughts and destination history",
    (await restored.locator(".by-thought").count()) === 1 &&
      (await restored.locator(".by-detail").innerText()).includes("The Last Light"),
  );
  await restored.getByRole("button", { name: "Back to ideas", exact: true }).click();
  await restored.getByLabel("New idea", { exact: true }).waitFor({ state: "visible" });
  await restored.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(window, "__restoreTransactions", {
      configurable: true,
      value: () => {
        IDBDatabase.prototype.transaction = original;
      },
    });
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase["transaction"]>) {
      if (args[1] === "readwrite")
        throw new DOMException("Simulated storage failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await restored.getByLabel("New idea", { exact: true }).fill("Keep this even if the save fails");
  await restored.getByRole("button", { name: "Keep idea", exact: true }).click();
  await restored.getByRole("alert").filter({ hasText: "Simulated storage failure" }).waitFor();
  check(
    "failed persistence preserves capture text",
    (await restored.getByLabel("New idea", { exact: true }).inputValue()) ===
      "Keep this even if the save fails",
  );
  await restored.evaluate(() => {
    const restore = Reflect.get(window, "__restoreTransactions") as () => void;
    restore();
  });
  await restored.getByRole("button", { name: "Keep idea", exact: true }).click();
  await restored.waitForFunction(() => document.querySelectorAll(".by-card").length === 3);
  check("save retry creates exactly one idea", (await restored.locator(".by-card").count()) === 3);
  await restoreContext.close();
  check("no runtime errors", errors.length === 0);
  console.log(`${count} Boneyard workflow checks passed`);
} finally {
  await browser.close();
}
