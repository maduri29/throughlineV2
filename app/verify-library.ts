import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const base = process.env.TLN_URL ?? "http://localhost:4517";
const browser = await chromium.launch({ channel: "msedge", headless: true });
let passed = 0;
function check(name: string, value: boolean) {
  assert.ok(value, name);
  console.log(`PASS ${name}`);
  passed++;
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/stories`);
  await page.locator(".tln-library__welcome").waitFor();
  check(
    "dark workspace is the default",
    (await page.locator("html").getAttribute("data-theme")) === "dark",
  );
  check(
    "empty state has one clear creation action",
    (await page.getByRole("button", { name: "New story", exact: true }).count()) === 1,
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `empty library fits ${width}px`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.getByRole("button", { name: "New story", exact: true }).click();
  await page.getByLabel("New story title").fill("A working title");
  await page.getByLabel("New story title").press("Escape");
  check(
    "cancel restores keyboard focus",
    await page
      .getByRole("button", { name: "New story", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const title of ["Zebra Crossing", "Afterlight"]) {
    await page.getByRole("button", { name: "New story", exact: true }).click();
    await page.getByLabel("New story title").fill(title);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".tln-workspace").waitFor();
    await page.getByTitle("All stories", { exact: true }).click();
    await page.locator(".tln-library__toolbar").waitFor();
  }
  check(
    "created stories remain in the library",
    (await page.locator(".tln-storycard").count()) === 2,
  );
  await page.getByLabel("Search stories").fill("zebra");
  check("search filters stories", (await page.locator(".tln-storycard").count()) === 1);
  await page.getByLabel("Search stories").fill("no such title");
  await page.getByRole("heading", { name: "No stories found" }).waitFor();
  check(
    "search distinguishes no results from an empty library",
    (await page.locator(".tln-library__welcome").count()) === 0,
  );
  await page.getByRole("button", { name: "Clear search", exact: true }).last().click();
  await page.getByLabel("Sort stories").selectOption("title");
  check(
    "title sort works",
    (await page.locator(".tln-storycard__title").first().innerText()) === "Afterlight",
  );
  await page.getByLabel("Import backup file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("not json"),
  });
  await page.getByRole("alert").filter({ hasText: "Could not import backup" }).waitFor();
  check(
    "invalid import reports an error and preserves stories",
    (await page.locator(".tln-storycard").count()) === 2,
  );
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.reload();
  await page.locator(".tln-library__grid").waitFor();
  check(
    "theme preference survives reload",
    (await page.locator("html").getAttribute("data-theme")) === "light",
  );
  await page.getByRole("button", { name: "Toggle theme" }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      `populated library fits ${width}px`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".tln-storycard").first().click();
  await page.locator(".tln-workspace").waitFor();
  for (const name of ["Timeline", "Characters", "Script", "Map"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    check(
      `${name} navigation works`,
      (await page.getByRole("tab", { name, exact: true }).getAttribute("aria-selected")) === "true",
    );
  }
  check("no browser runtime errors", errors.length === 0);
  console.log(`${passed} library checks passed`);
} finally {
  await browser.close();
}
