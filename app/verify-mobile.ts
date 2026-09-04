import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const base = process.env.TLN_URL ?? "http://localhost:4517";
let passed = 0;
function check(name: string, result: boolean) {
  assert.ok(result, name);
  console.log(`PASS ${name}`);
  passed++;
}
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${base}/stories`);
  await page.getByRole("button", { name: "Open the sample story" }).click();
  await page.locator(".tln-workspace").waitFor();
  for (const width of [320, 390, 600]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ["Map", "Timeline", "Characters", "Script"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      if (name === "Script") await page.locator(".cm-editor").waitFor();
      check(
        `${name} fits ${width}px`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      check(
        `${name} keeps usable content height at ${width}px`,
        await page
          .locator(".tln-workspace__lens")
          .evaluate((el) => el.getBoundingClientRect().height >= 250),
      );
      if (name === "Map" || name === "Timeline") {
        check(`details start collapsed in ${name}`, !(await page.locator(".tln-dock").isVisible()));
        await page.getByRole("button", { name: "Scene & connection details" }).click();
        await page.locator(".tln-dock").waitFor({ state: "visible" });
        check(`details open in ${name}`, await page.locator(".tln-dock").isVisible());
        await page.getByRole("button", { name: "Close details" }).click();
        await page.locator(".tln-dock").waitFor({ state: "hidden" });
      }
    }
    check(
      `script editor is full-width at ${width}px`,
      await page
        .locator(".tln-script__edit")
        .evaluate((el) => el.getBoundingClientRect().width >= innerWidth - 24),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".tln-script__item").nth(1).click();
  check(
    "scene strip supports touch selection",
    await page
      .locator(".tln-script__item")
      .nth(1)
      .evaluate((el) => el.classList.contains("tln-script__item--on")),
  );
  await page.getByTitle("All stories", { exact: true }).click();
  for (const name of ["Boneyard", "Research", "Stories"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.locator(".tln-library").waitFor();
    check(
      `${name} fits a phone`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.getByRole("button", { name: "Cloud sync" }).click();
  check(
    "sync dialog fits a phone",
    await page.locator(".tln-dialog").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    }),
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".tln-storycard").first().click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  check("desktop retains visible inspector", await page.locator(".tln-dock").isVisible());
  check(
    "desktop hides mobile details control",
    !(await page.locator(".tln-mobile-details-bar").isVisible()),
  );
  console.log(`${passed} mobile checks passed`);
} finally {
  await browser.close();
}
