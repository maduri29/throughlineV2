/** Explicitly requested real Firebase test account. Credentials stay in an ignored file. */
import { chromium } from "playwright-core";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = ".throughline-test-account.json";
const account: { email: string; username: string; password: string; registered?: boolean } =
  existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : {
        email: "throughline.flowtest.20261003@example.com",
        username: "flowtest",
        password: randomBytes(18).toString("base64url") + "Aa9!",
      };
writeFileSync(path, JSON.stringify(account, null, 2));
const invitation = readFileSync(".env.local", "utf8")
  .match(/^THROUGHLINE_INVITE_CODE=(.+)$/m)?.[1]
  ?.trim();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const base = process.env.TLN_URL ?? "http://localhost:4517";
let passed = 0;
function check(name: string, result: boolean) {
  if (!result) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`PASS ${name}`);
}
async function waitForStories() {
  await Promise.race([
    page.getByRole("heading", { name: "Your stories", exact: true }).waitFor({ timeout: 30000 }),
    page
      .locator(".auth-error")
      .waitFor({ timeout: 30000 })
      .then(async () => {
        throw new Error("Login failed: " + (await page.locator(".auth-error").innerText()));
      }),
  ]);
}
try {
  await page.goto(base + "/stories");
  await page.getByLabel("Username or email").waitFor();
  if (!account.registered) {
    // A previous interrupted run may have already completed registration.
    const exists = await context.request.post(base + "/api/auth/login", {
      data: { login: account.username },
    });
    if (exists.ok()) account.registered = true;
  }
  if (!account.registered) {
    await page.getByRole("button", { name: "Create a new account" }).click();
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Invitation code").fill(invitation ?? "");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await waitForStories();
    account.registered = true;
    writeFileSync(path, JSON.stringify(account, null, 2));
    check("real Firebase registration creates and opens a private workspace", true);
  } else {
    await page.getByLabel("Username or email").fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await waitForStories();
    check("real test account signs in by username", true);
  }
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  check(
    "profile uses a dedicated page",
    new URL(page.url()).pathname === "/profile" &&
      (await page.locator("#account-panel").count()) === 0,
  );
  await page.getByText(account.username, { exact: true }).waitFor();
  check(
    "profile displays the real username and email",
    await page.getByText(account.email, { exact: true }).isVisible(),
  );
  check(
    "mobile profile fits the viewport",
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.reload();
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  check("direct profile reload restores the real Firebase session", true);
  check(
    "signed-in test user cannot create accounts or view owner invitation code",
    (await page.getByRole("link", { name: "Create a new account", exact: true }).count()) === 0 &&
      (await page.getByLabel("Invitation code", { exact: true }).count()) === 0,
  );
  await page.goto(base + "/profile/new-account");
  await page.waitForURL("**/profile");
  check(
    "old account creation route redirects to profile",
    new URL(page.url()).pathname === "/profile",
  );
  await page.goto(base + "/stories");
  const title = "Real account flow test story";
  if (!(await page.getByText(title, { exact: true }).count())) {
    await page.getByRole("button", { name: "New story" }).click();
    await page.getByLabel("New story title").fill(title);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.goto(base + "/stories");
  }
  await page.getByText(title, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(title, { exact: true }).waitFor();
  check("story creation persists through a reload in the real account", true);
  await page.goto(base + "/boneyard");
  await page.getByLabel("New idea").waitFor();
  const idea = "Real account flow test idea";
  if (!(await page.getByText(idea, { exact: true }).count())) {
    await page.getByLabel("New idea").fill(idea);
    await page.getByRole("button", { name: "Keep idea", exact: true }).click();
  }
  await page.getByText(idea, { exact: true }).first().waitFor();
  await page.reload();
  await page.getByText(idea, { exact: true }).first().waitFor();
  check("real account Boneyard capture survives reload", true);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username or email").waitFor();
  check(
    "profile sign-out returns to login and hides private work",
    (await page.getByText(title, { exact: true }).count()) === 0,
  );
  await page.getByLabel("Username or email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await waitForStories();
  await page.getByText(title, { exact: true }).waitFor();
  check("real email sign-in restores the account's saved story", true);
  await page.goto(base + "/boneyard");
  await page.getByText("Real account flow test idea", { exact: true }).first().waitFor();
  check("real account Boneyard is restored after signing in again", true);
  console.log(
    `${passed}/${passed} real Firebase flow assertions passed. Test account retained; credentials are in the ignored local file.`,
  );
} finally {
  await context.close();
  await browser.close();
}
