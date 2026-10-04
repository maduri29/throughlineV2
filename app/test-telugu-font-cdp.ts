import { chromium } from "playwright-core";
import path from "node:path";

const BASE_URL = process.env.TLN_URL ?? "http://localhost:4517";
const ARTIFACTS_DIR =
  "C:\\Users\\madur\\.gemini\\antigravity\\brain\\5527de3c-c911-40b3-b6a2-ee971ccf424d";

function syntheticToken(email: string, uid: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://securetoken.google.com/throughline-3b2dd",
      aud: "throughline-3b2dd",
      auth_time: Math.floor(Date.now() / 1000),
      user_id: uid,
      sub: uid,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email,
      email_verified: true,
      firebase: { identities: { email: [email] }, sign_in_provider: "password" },
    }),
  ).toString("base64url");
  return `${header}.${payload}.synthetic-test-signature`;
}

async function run() {
  console.log(`Starting Telugu Font CDP verification at ${BASE_URL}...`);

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // High-DPI for crisp typography screenshot
  });

  const testEmail = "mukesh.dommati92@outlook.com";
  const testUid = "3MwplyoqDcaIMOx8yRmJ5N7tJKx1";

  await context.route("**/api/auth/login", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { configured: true, registrationEnabled: true, remaining: 4 } });
      return;
    }
    await route.fulfill({ status: 200, json: { email: testEmail } });
  });

  await context.route("**/api/auth/access", async (route) => {
    await route.fulfill({ status: 200, json: { uid: testUid, email: testEmail } });
  });

  await context.route("**/api/sync", (route) => route.fulfill({ json: { configured: false } }));

  await context.route("https://identitytoolkit.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("accounts:signInWithPassword")) {
      await route.fulfill({
        json: {
          localId: testUid,
          email: testEmail,
          idToken: syntheticToken(testEmail, testUid),
          refreshToken: "fixture-refresh",
          expiresIn: "3600",
          registered: true,
        },
      });
      return;
    }
    if (url.includes("accounts:lookup")) {
      await route.fulfill({
        json: {
          users: [
            {
              localId: testUid,
              email: testEmail,
              emailVerified: true,
              providerUserInfo: [{ providerId: "password", email: testEmail }],
              createdAt: String(Date.now()),
              lastLoginAt: String(Date.now()),
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({
      json: { projectId: "throughline-3b2dd", authorizedDomains: ["localhost"] },
    });
  });

  await context.route("https://securetoken.googleapis.com/**", (route) => route.abort());

  const page = await context.newPage();

  // Low-level Chrome DevTools Protocol (CDP) session
  const cdp = await context.newCDPSession(page);
  console.log("Connected to Chrome DevTools Protocol (CDP) session.");

  // Navigate to stories
  await page.goto(`${BASE_URL}/stories`, { waitUntil: "domcontentloaded" });

  // Handle AuthGate login
  await page.waitForSelector("#login-identity", { timeout: 10000 });
  console.log("Entering credentials...");
  await page.locator("#login-identity").fill("mukesh");
  await page.locator('input[type="password"]').fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await page.waitForSelector(".tln-library", { timeout: 15000 });
  console.log("Story library loaded.");

  // Open the sample story or existing story
  const sampleBtn = page.getByRole("button", { name: "Open the sample story" });
  if ((await sampleBtn.count()) > 0) {
    console.log("Opening sample story...");
    await sampleBtn.click();
  } else {
    console.log("Opening first story card...");
    await page.locator(".tln-storycard").first().click();
  }

  await page.waitForSelector(".tln-workspace", { timeout: 20000 });
  console.log("Story workspace opened.");

  // Switch to Script tab
  await page.getByRole("tab", { name: "Script", exact: true }).click();
  await page.waitForSelector(".tln-script__ta .cm-editor", { timeout: 20000 });
  console.log("Switched to Script lens.");

  // Insert rich Telugu screenplay scene into CodeMirror editor
  const teluguScript = [
    ".ఇంటి లోపల - పగలు",
    "",
    "@రాము",
    "(నవ్వుతూ)",
    "కథ ఇప్పుడే మొదలైంది మిత్రమా. మన ప్రయాణం అద్భుతంగా సాగాలి!",
    "",
    "@అర్జున్",
    "నిజమే రాము, ప్రతి సన్నివేశం ప్రేక్షకుడి గుండెను తాకాలి.",
    "",
    "రమేష్ గదిలోకి వేగంగా అడుగుపెడతాడు. చేతిలో ఒక పాత ఉత్తరం ఉంది. గదిలో నిశ్శబ్దం అలుముకుంది.",
    "",
    "@రమేష్",
    "(ఆందోళనతో)",
    "ఈ ఉత్తరంలో ఉన్న నిజం తెలిస్తే అంతా తలకిందులవుతుంది!",
  ].join("\n");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(teluguScript);

  // Wait for Fountain parser and preview to update
  await page.waitForTimeout(1000);

  // Click Typography Menu
  const typoBtn = page.locator(".tln-script-typo__btn");
  await typoBtn.click();
  await page.waitForSelector(".tln-script-typo__popover", { timeout: 5000 });
  console.log("Opened Typography & Telugu Font Menu.");

  // Capture Screenshot 1: Typography Menu Open
  const menuScreenshotPath = path.join(ARTIFACTS_DIR, "telugu-font-menu.png");
  await page.screenshot({ path: menuScreenshotPath, fullPage: false });
  console.log(`Captured Screenshot 1 (Typography Menu): ${menuScreenshotPath}`);

  // Select "Mandali" font
  const mandaliBtn = page.locator(".tln-script-typo__font-item:has-text('Mandali')");
  await mandaliBtn.click();
  console.log("Selected 'Mandali' Telugu font.");

  // Select 16px size
  const size16Btn = page.locator(".tln-script-typo__pill:has-text('16px')");
  await size16Btn.click();
  console.log("Selected '16px' font size.");

  // Select 1.65x line height
  const lhBtn = page.locator(".tln-script-typo__pill:has-text('1.65x')");
  await lhBtn.click();
  console.log("Selected '1.65x' line height.");

  // Close menu by clicking outside
  await page.locator(".tln-script__main").click({ position: { x: 50, y: 50 } });
  await page.waitForTimeout(600);

  // Verify computed typography styles
  const computed = await page.evaluate(() => {
    const root = document.querySelector(".tln-script") as HTMLElement;
    const editor = document.querySelector(".tln-script__ta .cm-scroller") as HTMLElement;
    const preview = document.querySelector(".tln-script__preview") as HTMLElement;
    const cue = document.querySelector(".tln-script__preview .tln-f-cue") as HTMLElement;
    const paren = document.querySelector(".tln-script__preview .tln-f-paren") as HTMLElement;
    const dlg = document.querySelector(".tln-script__preview .tln-f-dlg") as HTMLElement;

    return {
      rootFamily: root?.style.getPropertyValue("--font-script-family"),
      rootSize: root?.style.getPropertyValue("--font-script-size"),
      rootLh: root?.style.getPropertyValue("--font-script-line-height"),
      editorFont: getComputedStyle(editor).fontFamily,
      editorSize: getComputedStyle(editor).fontSize,
      editorLh: getComputedStyle(editor).lineHeight,
      previewFont: getComputedStyle(preview).fontFamily,
      previewSize: getComputedStyle(preview).fontSize,
      cueText: cue?.textContent?.trim(),
      parenText: paren?.textContent?.trim(),
      dlgText: dlg?.textContent?.trim(),
    };
  });

  console.log("\n==========================================");
  console.log("   TELUGU TYPOGRAPHY COMPUTED STYLES");
  console.log("==========================================");
  console.log(`Root CSS Variable (--font-script-family): ${computed.rootFamily}`);
  console.log(`Root CSS Variable (--font-script-size):   ${computed.rootSize}`);
  console.log(`Root CSS Variable (--font-script-line-height): ${computed.rootLh}`);
  console.log(`Editor Computed Font: ${computed.editorFont}`);
  console.log(`Editor Computed Size: ${computed.editorSize}`);
  console.log(`Preview Computed Font: ${computed.previewFont}`);
  console.log(`Parsed Cue: ${computed.cueText}`);
  console.log(`Parsed Paren: ${computed.parenText}`);
  console.log(`Parsed Dialogue: ${computed.dlgText}`);
  console.log("==========================================\n");

  // Capture Screenshot 2 directly via Chrome DevTools Protocol (Page.captureScreenshot)
  const cdpScreenshotResult = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });

  const renderedScreenshotPath = path.join(ARTIFACTS_DIR, "telugu-script-rendered.png");
  const buffer = Buffer.from(cdpScreenshotResult.data, "base64");
  await Bun.write(renderedScreenshotPath, buffer);
  console.log(
    `Captured Screenshot 2 (Rendered Telugu Screenplay via CDP): ${renderedScreenshotPath}`,
  );

  await browser.close();
  console.log("\nAll Telugu font CDP tests completed successfully!");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
