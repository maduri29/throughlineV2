import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
let passed = 0;
function check(name: string, value: boolean) {
  assert.ok(value, name);
  console.log(`PASS ${name}`);
  passed++;
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.TLN_URL ?? "http://localhost:4517"}/stories`);
  await page.locator(".tln-library__welcome").waitFor();
  const trigger = page.getByRole("button", { name: "Quick search", exact: true });
  const dialog = page.getByRole("dialog", { name: "Quick search" });
  const search = dialog.getByRole("combobox");
  await trigger.click();
  await dialog.waitFor();
  check(
    "search opens and focuses its input",
    await search.evaluate((el) => document.activeElement === el),
  );
  check(
    "empty library offers three useful destinations",
    (await page.getByRole("option").count()) === 3,
  );
  await search.press("Tab");
  await page.keyboard.press("Tab");
  check(
    "keyboard focus stays in the modal",
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  );
  await page.keyboard.press("Escape");
  check(
    "Escape closes and restores focus",
    await trigger.evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Control+k");
  await search.fill("boneyard");
  await search.press("Enter");
  await page.waitForURL("**/boneyard");
  check("quick search navigates to Boneyard", new URL(page.url()).pathname === "/boneyard");
  await trigger.click();
  await search.fill("research");
  await search.press("Enter");
  await page.waitForURL("**/research");
  check("quick search navigates to Research", new URL(page.url()).pathname === "/research");
  await trigger.click();
  await search.fill("library");
  await search.press("Enter");
  await page.waitForURL("**/stories");

  const urls: string[] = [];
  for (const title of ["Afterlight", "Zebra Crossing"]) {
    await page.getByRole("button", { name: "New story", exact: true }).click();
    const titleInput = page.getByLabel("New story title");
    await titleInput.pressSequentially("Temporary");
    await titleInput.press("Control+z");
    check(`text undo remains native while naming ${title}`, (await titleInput.inputValue()) === "");
    await titleInput.fill(title);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".tln-workspace").waitFor();
    urls.push(page.url());
    if (title === "Afterlight") await page.getByTitle("All stories", { exact: true }).click();
  }
  await trigger.click();
  await search.fill("afterlight");
  check(
    "search highlights matching titles",
    (await dialog.locator("mark").innerText()) === "Afterlight",
  );
  await search.press("Enter");
  await page.waitForURL(urls[0]!);
  await page.locator(".tln-story-bar__title").filter({ hasText: "Afterlight" }).waitFor();
  check("story switching updates both URL and loaded story", page.url() === urls[0]);
  await page.reload();
  await page.locator(".tln-story-bar__title").filter({ hasText: "Afterlight" }).waitFor();
  check("search-selected story survives refresh", page.url() === urls[0]);
  await page.goBack();
  await page.locator(".tln-story-bar__title").filter({ hasText: "Zebra Crossing" }).waitFor();
  check("Back restores the previous story", page.url() === urls[1]);
  await page.getByTitle("All stories", { exact: true }).click();
  await trigger.click();
  await search.fill("zebra");
  await search.press("Enter");
  await page.waitForURL(urls[1]!);
  check(
    "current story can also be opened from the library",
    await page.locator(".tln-workspace").isVisible(),
  );

  await trigger.click();
  await search.fill("zz-no-such-result");
  check(
    "no matches has a useful recovery action",
    await page.getByRole("button", { name: "Clear search", exact: true }).isVisible(),
  );
  await search.press("ArrowDown");
  await search.press("Enter");
  check("Enter with no matches keeps search open", await dialog.isVisible());
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  check(
    "clearing restores results and input focus",
    (await page.getByRole("option").count()) > 0 &&
      (await search.evaluate((el) => el === document.activeElement)),
  );
  await search.press("ArrowUp");
  check(
    "keyboard navigation wraps to the last result",
    (await page.getByRole("option").last().getAttribute("aria-selected")) === "true",
  );
  await search.press("ArrowDown");
  check(
    "keyboard navigation wraps to the first result",
    (await page.getByRole("option").first().getAttribute("aria-selected")) === "true",
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    check(
      `search fits ${width}px`,
      await dialog.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight &&
          el.scrollWidth <= el.clientWidth
        );
      }),
    );
  }
  await page.setViewportSize({ width: 390, height: 400 });
  check(
    "search fits a reduced viewport with a keyboard",
    await dialog.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  );
  await search.press("ArrowUp");
  check(
    "active results scroll into view",
    await page.getByRole("option", { selected: true }).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const list = el.closest('[role="listbox"]')!.getBoundingClientRect();
      return rect.top >= list.top && rect.bottom <= list.bottom;
    }),
  );
  await page.getByRole("button", { name: "Close quick search" }).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await trigger.click();
  check(
    "dialog inherits the light theme",
    await dialog.evaluate((el) => getComputedStyle(el).colorScheme === "light"),
  );
  await page.mouse.click(2, 2);
  check("backdrop closes search", (await dialog.count()) === 0);

  const sample = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  sample.setDefaultTimeout(15_000);
  sample.on("pageerror", (error) => errors.push(error.message));
  await sample.goto(`${process.env.TLN_URL ?? "http://localhost:4517"}/stories`);
  await sample.getByRole("button", { name: "Open the sample story" }).click();
  await sample.locator(".tln-workspace").waitFor();
  await sample.getByRole("button", { name: "Quick search", exact: true }).click();
  const sampleSearch = sample.getByRole("dialog", { name: "Quick search" }).getByRole("combobox");
  await sampleSearch.fill("scene");
  check(
    "search includes scenes from the current story",
    (await sample.getByRole("dialog", { name: "Quick search" }).getByRole("option").count()) > 0,
  );
  const sceneTitle = await sample
    .getByRole("option")
    .first()
    .locator(".tln-palette__label")
    .innerText();
  await sampleSearch.press("Enter");
  await sample.locator("#tln-inspector-title").waitFor();
  check(
    "choosing a scene selects its inspector",
    (await sample.locator("#tln-inspector-title").inputValue()) === sceneTitle,
  );
  const visibleCard = await sample.locator(".react-flow__node.selectable").evaluateAll((elements) =>
    elements
      .find((el) => {
        const rect = el.getBoundingClientRect();
        return (
          el.querySelector(".tln-card") &&
          rect.left > 10 &&
          rect.top > 200 &&
          rect.right < innerWidth - 370 &&
          rect.bottom < innerHeight - 20
        );
      })
      ?.getAttribute("data-id"),
  );
  assert.ok(visibleCard, "sample has a visible map card");
  const card = sample.locator(`.react-flow__node[data-id="${visibleCard}"]`);
  const cardTitle = await card.locator(".tln-card__title").innerText();
  await card.click();
  check(
    "map clicks still update selection after a search jump",
    (await sample.locator("#tln-inspector-title").inputValue()) === cardTitle,
  );
  await sample.getByRole("button", { name: "Quick search", exact: true }).click();
  await sampleSearch.fill("charters");
  await sampleSearch.press("Tab");
  await sample.keyboard.press("Tab");
  check(
    "Tab in search preserves the selected scene behind it",
    (await sample.locator("#tln-inspector-title").inputValue()) === cardTitle,
  );
  await sample
    .getByRole("dialog", { name: "Quick search" })
    .getByRole("option")
    .filter({ hasText: "Maya" })
    .waitFor();
  check(
    "search also finds character backstory text",
    (await sample.getByRole("dialog", { name: "Quick search" }).getByRole("option").count()) === 1,
  );
  const characterTitle = await sample
    .getByRole("option")
    .locator(".tln-palette__label")
    .innerText();
  await sampleSearch.press("Enter");
  await sample.getByRole("main", { name: "Character dossier" }).waitFor();
  check(
    "choosing a character opens its details",
    (await sample.locator(".character-dossier__header h2").innerText()) === characterTitle,
  );
  const otherCharacter = sample
    .locator(".characters-roster__item")
    .filter({ hasNotText: characterTitle })
    .first();
  await otherCharacter.click();
  check(
    "a search-selected character can switch to another profile",
    (await sample.locator(".character-dossier__header h2").innerText()) !== characterTitle,
  );
  await sample.getByRole("button", { name: "Quick search", exact: true }).click();
  await sampleSearch.fill("charters");
  await sampleSearch.press("Enter");
  await sample.getByRole("main", { name: "Character dossier" }).waitFor();
  check(
    "search can reopen the same character",
    (await sample.locator(".character-dossier__header h2").innerText()) === characterTitle,
  );
  await sample.setViewportSize({ width: 390, height: 844 });
  await sample.getByRole("button", { name: "Quick search", exact: true }).click();
  await sampleSearch.fill(sceneTitle);
  await sampleSearch.press("Enter");
  await sample.locator("#tln-inspector-title").waitFor();
  check(
    "scene search opens details on a phone",
    (await sample.locator("#tln-inspector-title").inputValue()) === sceneTitle,
  );
  check("no browser runtime errors", errors.length === 0);
  console.log(`${passed} search checks passed`);
} finally {
  await browser.close();
}
