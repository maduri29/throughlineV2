/** Live Firebase + Turso verification in the explicitly created test account. */
import { chromium, type Page } from "playwright-core";
import { readFileSync } from "node:fs";
const account = JSON.parse(readFileSync(".throughline-test-account.json", "utf8")) as {
  email: string;
  password: string;
};
const base = process.env.TLN_URL ?? "http://localhost:4517";
const browser = await chromium.launch({ channel: "msedge", headless: true });
let passed = 0;
function check(name: string, result: boolean) {
  if (!result) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`PASS ${name}`);
}
async function login(page: Page) {
  await page.goto(base + "/stories");
  await page.getByLabel("Username or email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
}
async function sync(page: Page) {
  await page.goto(base + "/profile");
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await page.getByText("In sync with cloud.", { exact: true }).waitFor({ timeout: 30000 });
}
try {
  const first = await browser.newContext();
  const firstPage = await first.newPage();
  await login(firstPage);
  const title = `Live Turso sync check ${Date.now()}`;
  const idea = `${title} idea`;
  await firstPage.getByRole("button", { name: "New story" }).click();
  await firstPage.getByLabel("New story title").fill(title);
  await firstPage.getByRole("button", { name: "Create", exact: true }).click();
  await firstPage.waitForURL(/\/stories\/[^/]+$/);
  await sync(firstPage);
  check("real Firebase test account uploads a story to live Turso", true);
  await firstPage.goto(base + "/boneyard");
  await firstPage.getByLabel("New idea").fill(idea);
  await firstPage.getByRole("button", { name: "Keep idea", exact: true }).click();
  await firstPage.getByText(idea, { exact: true }).first().waitFor();
  await sync(firstPage);
  check("saved Boneyard idea syncs to live Turso", true);
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPage = await second.newPage();
  await login(secondPage);
  await secondPage.getByText(title, { exact: true }).waitFor({ timeout: 30000 });
  check("independent browser downloads the story from live Turso", true);
  await secondPage.goto(base + "/boneyard");
  await secondPage.getByText(idea, { exact: true }).first().waitFor({ timeout: 30000 });
  check("independent browser downloads Boneyard history from live Turso", true);
  await sync(secondPage);
  check("unchanged writing syncs again without a conflict", true);
  check(
    "mobile profile fits the viewport",
    await secondPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  check(
    "test user cannot see the owner's invitation code",
    (await secondPage.getByLabel("Invitation code", { exact: true }).count()) === 0,
  );
  await secondPage.getByRole("button", { name: "Sign out", exact: true }).click();
  await secondPage.getByLabel("Username or email").waitFor();
  await login(secondPage);
  await secondPage.getByText(title, { exact: true }).waitFor();
  check("live account login and writing survive sign-out and sign-in", true);
  await first.close();
  await second.close();
  console.log(
    `${passed}/${passed} live Firebase/Turso browser assertions passed. Test writing retained in the test account; no owner writing was modified.`,
  );
} finally {
  await browser.close();
}
