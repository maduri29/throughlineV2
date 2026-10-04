import { chromium } from "playwright-core";

const base = process.env.TLN_URL ?? "http://localhost:4517";
const browser = await chromium.launch({ channel: "msedge", headless: true });
let passed = 0;
function check(name: string, ok: boolean) {
  if (!ok) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`PASS ${name}`);
}
const people: Record<string, { uid: string; username: string }> = {
  "alice@example.com": { uid: "fixture-alice", username: "writer-a" },
  "bob@example.com": { uid: "fixture-bob", username: "writer-b" },
};
function token(email: string, uid: string) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    sub: uid,
    user_id: uid,
    email,
    email_verified: true,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    aud: "throughline-3b2dd",
    iss: "https://securetoken.google.com/throughline-3b2dd",
    firebase: { identities: { email: [email] }, sign_in_provider: "password" },
  })}.synthetic-test-signature`;
}
try {
  const plain = await browser.newContext();
  const setup = await plain.newPage();
  await setup.goto(base + "/stories");
  await setup.getByLabel("Username or email").waitFor();
  check(
    "real server shows login instead of private content",
    await setup.getByRole("button", { name: "Sign in", exact: true }).isVisible(),
  );
  check(
    "anonymous graph API fails closed",
    (await plain.request.post(base + "/api/sync", { data: { syncKey: "old-key" } })).status() ===
      401,
  );
  check(
    "anonymous Boneyard API fails closed",
    (
      await plain.request.post(base + "/api/boneyard-sync", {
        data: { syncKey: "old-key", revisions: [] },
      })
    ).status() === 401,
  );
  check(
    "real server rejects a forged Firebase token",
    (
      await plain.request.get(base + "/api/auth/access", {
        headers: { Authorization: "Bearer forged-token" },
      })
    ).status() === 401,
  );
  await plain.close();

  const context = await browser.newContext();
  let resetEmails = 0;
  let deletedNewUsers = 0;
  let loseRegistrationResponse = false;
  await context.route("**/api/auth/register", async (route) => {
    const body = route.request().postDataJSON();
    if (loseRegistrationResponse && body.inviteCode === "fixture-invite-code") {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: body.inviteCode === "fixture-invite-code" ? 201 : 403,
      json:
        body.inviteCode === "fixture-invite-code"
          ? { username: body.username }
          : { error: "The invitation code is incorrect." },
    });
  });
  await context.route("**/api/auth/login", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { configured: true, registrationEnabled: true, remaining: 4 } });
      return;
    }
    const login = String(route.request().postDataJSON().login).trim().toLowerCase();
    const email = Object.entries(people).find(
      ([email, person]) => email === login || person.username === login,
    )?.[0];
    await route.fulfill({
      status: email ? 200 : 403,
      json: email
        ? { email }
        : { error: "Check your sign-in details or contact the workspace owner." },
    });
  });
  await context.route("**/api/auth/invitations", async (route) => {
    const encoded = (route.request().headers().authorization ?? "").split(".")[1];
    const identity = encoded ? JSON.parse(Buffer.from(encoded, "base64url").toString()) : null;
    const owner = identity?.email === "alice@example.com";
    await route.fulfill({
      status: 200,
      json: owner
        ? { owner: true, code: "fixture-invite-code", used: 2, limit: 5, remaining: 3 }
        : { owner: false },
    });
  });
  await context.route("**/api/auth/access", async (route) => {
    const authorization = route.request().headers().authorization ?? "";
    const encoded = authorization.split(".")[1];
    const identity = encoded ? JSON.parse(Buffer.from(encoded, "base64url").toString()) : null;
    await route.fulfill({
      status: identity ? 200 : 401,
      json: identity ? { uid: identity.sub, email: identity.email } : { error: "Sign in again." },
    });
  });
  await context.route("**/api/sync", (route) => route.fulfill({ json: { configured: false } }));
  await context.route("https://identitytoolkit.googleapis.com/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postData() ? route.request().postDataJSON() : {};
    if (url.includes("accounts:delete")) {
      deletedNewUsers++;
      await route.fulfill({ json: {} });
      return;
    }
    if (url.includes("accounts:signUp")) {
      people[body.email] = { uid: "fixture-newwriter", username: "new-writer" };
      await route.fulfill({
        json: {
          localId: "fixture-newwriter",
          email: body.email,
          idToken: token(body.email, "fixture-newwriter"),
          refreshToken: "fixture-refresh",
          expiresIn: "3600",
        },
      });
      return;
    }
    if (url.includes("accounts:signInWithPassword")) {
      const person = people[body.email as keyof typeof people];
      if (!person || body.password !== "fixture-password") {
        await route.fulfill({
          status: 400,
          json: { error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" } },
        });
        return;
      }
      await route.fulfill({
        json: {
          localId: person.uid,
          email: body.email,
          idToken: token(body.email, person.uid),
          refreshToken: "fixture-refresh",
          expiresIn: "3600",
          registered: true,
        },
      });
      return;
    }
    if (url.includes("accounts:lookup")) {
      const identity = JSON.parse(
        Buffer.from(String(body.idToken).split(".")[1]!, "base64url").toString(),
      );
      await route.fulfill({
        json: {
          users: [
            {
              localId: identity.sub,
              email: identity.email,
              emailVerified: true,
              providerUserInfo: [{ providerId: "password", email: identity.email }],
              createdAt: String(Date.now()),
              lastLoginAt: String(Date.now()),
            },
          ],
        },
      });
      return;
    }
    if (url.includes("accounts:sendOobCode")) {
      resetEmails++;
      await route.fulfill({ json: { email: body.email } });
      return;
    }
    await route.fulfill({
      json: { projectId: "throughline-3b2dd", authorizedDomains: ["localhost"] },
    });
  });
  // Never send synthetic credentials or tokens to a real Firebase endpoint.
  await context.route("https://securetoken.googleapis.com/**", (route) => route.abort());
  const page = await context.newPage();
  await page.goto(base + "/stories");
  await page.getByLabel("Username or email").waitFor();
  check(
    "signed-out users cannot see story library",
    (await page.getByRole("heading", { name: "Your stories", exact: true }).count()) === 0,
  );
  check(
    "password input is masked",
    (await page.getByLabel("Password", { exact: true }).getAttribute("type")) === "password",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    "mobile login has no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await page.getByLabel("Username or email").fill("writer-a");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByRole("status").filter({ hasText: "password reset link" }).waitFor();
  check("password recovery uses provisioned email", resetEmails === 1);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator(".auth-error").waitFor();
  check(
    "wrong password displays accessible error",
    (await page.locator(".auth-error").innerText()).includes("Check your username"),
  );

  // Seed a legacy database in this disposable browser context only.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("throughline.v1", 3);
      request.onupgradeneeded = () => {
        for (const name of ["nodes", "edges", "files", "boneyard"])
          request.result.createObjectStore(name, { keyPath: "id" });
        request.result.createObjectStore("meta", { keyPath: "key" });
        request.result.createObjectStore("history", { keyPath: "projectId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("nodes", "readwrite");
      transaction.objectStore("nodes").put({
        id: "legacy-story",
        type: "project",
        title: "Alice private legacy story",
        order: [],
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  async function signIn(login: string) {
    await page.getByLabel("Username or email").fill(login);
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
  }
  async function signOut() {
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Username or email").waitFor();
  }
  await signIn("writer-a");
  check(
    "username sign-in opens private workspace",
    await page.getByRole("link", { name: "Account", exact: true }).isVisible(),
  );
  check(
    "Account sits beside theme in header",
    (await page.locator(".tln-tool--theme + .tln-tool--account").count()) === 1,
  );
  check(
    "floating account and redundant cloud button removed",
    (await page.locator(".auth-account").count()) === 0 &&
      (await page.getByRole("button", { name: "Cloud sync", exact: true }).count()) === 0,
  );
  check(
    "legacy work is never automatically assigned",
    (await page.getByText("Alice private legacy story", { exact: true }).count()) === 0,
  );
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  check(
    "Account opens a profile route instead of a modal",
    new URL(page.url()).pathname === "/profile" &&
      (await page.locator("#account-panel").count()) === 0,
  );
  await page.getByRole("button", { name: "Import previous local work" }).click();
  await page.getByText("Alice private legacy story", { exact: true }).waitFor();
  check(
    "explicit legacy import restores original stories",
    await page.getByText("Alice private legacy story", { exact: true }).isVisible(),
  );
  await page.reload();
  await page.getByText("Alice private legacy story", { exact: true }).waitFor();
  check("saved sign-in and private stories survive reload", true);
  await page.getByText("Alice private legacy story", { exact: true }).click();
  const downloads = page.locator(".tln-story-bar .script-downloads");
  await downloads.locator("summary").click();
  const fountainDownload = page.waitForEvent("download");
  await downloads.getByRole("button", { name: /Fountain/ }).click();
  check(
    "story toolbar downloads Fountain",
    (await fountainDownload).suggestedFilename().endsWith(".fountain"),
  );
  await downloads.locator("summary").click();
  const backupDownload = page.waitForEvent("download");
  await downloads.getByRole("button", { name: /Story backup/ }).click();
  check(
    "story toolbar downloads backup",
    (await backupDownload).suggestedFilename().endsWith(".json"),
  );
  await downloads.locator("summary").click();
  const printPage = page.waitForEvent("popup");
  await downloads.getByRole("button", { name: /Print/ }).click();
  const preview = await printPage;
  await preview.waitForLoadState();
  check(
    "PDF preview has title and save instructions",
    (await preview.locator("h1").textContent()) === "Alice private legacy story" &&
      (await preview.locator(".print-help").innerText()).includes("Save as PDF"),
  );
  await preview.close();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const board = page.getByRole("region", { name: "Sequence board", exact: true });
  await board.getByRole("button", { name: "+ New sequence", exact: true }).click();
  await board.getByLabel("New sequence name").fill("Opening");
  await board.getByRole("button", { name: "Add sequence", exact: true }).click();
  const opening = board.getByRole("region", { name: "Opening", exact: true });
  await opening.getByRole("button", { name: "+ Add scene", exact: true }).click();
  await page.locator("#tln-inspector-title").fill("First scene");
  await page.locator("#tln-inspector-title").press("Tab");
  await opening.getByRole("button", { name: "+ Add scene", exact: true }).click();
  await page.locator("#tln-inspector-title").fill("Second scene");
  await page.locator("#tln-inspector-title").press("Tab");
  await board.getByLabel("Outline for Second scene").fill("A discovery changes the plan.");
  await board.getByLabel("Turning point for Second scene").fill("The team must leave tonight.");
  await board.getByRole("button", { name: "Save scene", exact: true }).click();
  check(
    "scene editor saves outline and turning-point edits",
    (await board.locator(".sequence-board__synopsis").allTextContents()).includes(
      "A discovery changes the plan.",
    ) && (await board.locator(".sequence-board__turn").innerText()).includes("leave tonight"),
  );
  await opening.getByRole("button", { name: "Second scene", exact: true }).click();
  await board.getByRole("button", { name: "Move Second scene earlier", exact: true }).click();
  check(
    "sequence board reorders scenes without a node canvas",
    (await opening.locator(".sequence-board__title").allTextContents()).join(",") ===
      "Second scene,First scene" && (await board.locator(".react-flow").count()) === 0,
  );
  await board.getByRole("button", { name: "+ New sequence", exact: true }).click();
  await board.getByLabel("New sequence name").fill("Ending");
  await board.getByRole("button", { name: "Add sequence", exact: true }).click();
  await opening.getByRole("button", { name: "First scene", exact: true }).click();
  await board.getByLabel("Sequence for First scene").selectOption({ label: "Ending" });
  check(
    "scene moves between sequences",
    await board
      .getByRole("region", { name: "Ending", exact: true })
      .getByRole("button", { name: "First scene", exact: true })
      .isVisible(),
  );
  await downloads.locator("summary").click();
  const orderedBackup = page.waitForEvent("download");
  await downloads.getByRole("button", { name: /Story backup/ }).click();
  const backupPath = await (await orderedBackup).path();
  const exported = JSON.parse(await Bun.file(backupPath!).text());
  const first = exported.nodes.find((n: { title: string }) => n.title === "First scene");
  const ending = exported.nodes.find((n: { title: string }) => n.title === "Ending");
  check(
    "backup preserves moved scene membership and order",
    first.parentId === ending.id && ending.order.includes(first.id),
  );
  const firstCard = board
    .locator(".sequence-board__card")
    .filter({ has: page.getByRole("button", { name: "First scene", exact: true }) });
  const secondCard = board
    .locator(".sequence-board__card")
    .filter({ has: page.getByRole("button", { name: "Second scene", exact: true }) });
  await firstCard
    .locator(".sequence-board__number")
    .dragTo(secondCard.locator(".sequence-board__number"), { timeout: 10000 });
  check(
    "dragging places scene before its target",
    (await opening.locator(".sequence-board__title").allTextContents()).join(",") ===
      "First scene,Second scene",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  check(
    "undo restores scene to its previous sequence",
    await board
      .getByRole("region", { name: "Ending", exact: true })
      .getByRole("button", { name: "First scene", exact: true })
      .isVisible(),
  );
  await board.getByRole("button", { name: "Open script ↗", exact: true }).click();
  check("board opens selected scene in Script", await page.locator(".tln-script").isVisible());
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.keyboard.press("Control+s");
  await page.getByRole("button", { name: /^Saved on this device,/ }).waitFor();
  await page.reload();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page
    .getByRole("region", { name: "Ending", exact: true })
    .getByRole("button", { name: "First scene", exact: true })
    .waitFor();
  check(
    "sequence arrangement survives reload",
    await page
      .getByRole("region", { name: "Ending", exact: true })
      .getByRole("button", { name: "First scene", exact: true })
      .isVisible(),
  );

  await board.getByLabel("Find a scene").fill("discovery");
  check(
    "scene search finds outline text",
    (await board.locator(".sequence-board__card").count()) === 1 &&
      (await board.getByRole("button", { name: "Second scene", exact: true }).isVisible()),
  );
  await board.getByRole("button", { name: "Clear scene search" }).click();
  await board
    .getByRole("navigation", { name: "Filter sequences" })
    .getByRole("button", { name: /Ending/ })
    .click();
  check(
    "sequence filter narrows the scene list",
    (await board.locator(".sequence-board__card").count()) === 1 &&
      (await board.getByRole("button", { name: "First scene", exact: true }).isVisible()),
  );
  await board
    .getByRole("navigation", { name: "Filter sequences" })
    .getByRole("button", { name: /All scenes/ })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    "mobile sequence board has no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await board.getByRole("button", { name: "First scene", exact: true }).click();
  check(
    "mobile scene editor has a reachable save action",
    (await board.getByRole("button", { name: "Save scene", exact: true }).isVisible()) &&
      (await page.evaluate(() => {
        const footer = document.querySelector(".sb-editor footer")!.getBoundingClientRect();
        return (
          footer.bottom <= innerHeight &&
          footer.width > 250 &&
          document.querySelector(".sb-editor-body")!.scrollWidth <=
            document.querySelector(".sb-editor-body")!.clientWidth
        );
      })),
  );
  await board.getByRole("button", { name: "Save scene", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  const roster = page.getByRole("complementary", { name: "Character roster" });
  const dossier = page.getByRole("main", { name: "Character dossier" });
  await roster.getByRole("button", { name: "+ Add", exact: true }).click();
  await dossier.getByLabel("Name", { exact: true }).fill("Dr Ada");
  await dossier.getByLabel("Age", { exact: true }).fill("late 30s");
  await dossier.getByLabel("Story role", { exact: true }).fill("Protagonist");
  await dossier
    .getByLabel("Short summary", { exact: true })
    .fill("An investigator returning home.");
  await dossier
    .locator(".character-dossier__fold")
    .filter({ hasText: "Personality & motives" })
    .locator("summary")
    .click();
  await dossier.getByLabel("Traits & voice", { exact: true }).fill("radiant skeptic with dry wit");
  await dossier.getByLabel("Motivation", { exact: true }).fill("Protect the village");
  await dossier.getByLabel("Inner conflict or flaw", { exact: true }).fill("Cannot ask for help");
  await dossier
    .locator(".character-dossier__fold")
    .filter({ hasText: "Appearance & style" })
    .locator("summary")
    .click();
  await dossier
    .getByLabel("Appearance & style", { exact: true })
    .fill("Worn linen jacket and precise gestures");
  await dossier
    .locator(".character-dossier__fold")
    .filter({ hasText: "Backstory" })
    .locator("summary")
    .click();
  await dossier.getByLabel("Backstory", { exact: true }).fill("Left home after a failed rescue");
  await dossier
    .locator(".character-dossier__fold")
    .filter({ hasText: "Relationship notes" })
    .locator("summary")
    .click();
  await dossier
    .getByLabel("Relationship notes", { exact: true })
    .fill("Trusts Ben but keeps a secret");
  await downloads.locator("summary").click();
  const unsavedBackup = page.waitForEvent("download");
  await downloads.getByRole("button", { name: /Story backup/ }).click();
  const unsavedPath = await (await unsavedBackup).path();
  const unsavedJson = JSON.parse(await Bun.file(unsavedPath!).text());
  check(
    "unsaved character edits stay out of backup",
    !unsavedJson.nodes.some((node: { title: string }) => node.title === "Dr Ada"),
  );
  await dossier.getByRole("button", { name: "Save changes" }).click();
  check(
    "saved character opens as a readable profile",
    (await dossier.getByText("An investigator returning home.").isVisible()) &&
      (await dossier.getByRole("button", { name: "Edit profile" }).isVisible()),
  );
  await dossier.getByRole("button", { name: "Edit profile" }).click();
  check(
    "every cast card has a poster",
    (await page.locator(".characters-roster__item .character-poster").count()) ===
      (await page.locator(".characters-roster__item").count()),
  );
  await page.getByLabel("Find a character", { exact: true }).fill("radiant skeptic");
  check(
    "cast search finds a character by trait",
    (await page.locator(".characters-roster__item").count()) === 1,
  );
  await page.getByLabel("Find a character", { exact: true }).fill("no-character-matches-this");
  check(
    "cast search explains empty results",
    await page.getByRole("status").filter({ hasText: "No characters match" }).isVisible(),
  );
  await page.getByRole("button", { name: "Clear character search" }).click();
  const posterFixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#735b8b";
    ctx.fillRect(0, 0, 24, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await dossier.getByLabel("Upload character poster").setInputFiles({
    name: "poster.png",
    mimeType: "image/png",
    buffer: Buffer.from(posterFixture!, "base64"),
  });
  await page.waitForFunction(() => !!document.querySelector(".character-identity img"));
  await dossier.getByRole("button", { name: "Save changes" }).click();
  check(
    "uploaded character poster appears in cast card",
    await page.locator(".characters-roster__item.is-selected img").isVisible(),
  );
  await dossier.getByRole("button", { name: "Edit profile" }).click();
  await dossier.getByLabel("Age", { exact: true }).fill("99");
  await dossier.getByRole("button", { name: "Cancel" }).click();
  check("cancel discards staged character edits", await dossier.getByText("late 30s").isVisible());
  await downloads.locator("summary").click();
  const characterBackup = page.waitForEvent("download");
  await downloads.getByRole("button", { name: /Story backup/ }).click();
  const characterPath = await (await characterBackup).path();
  const characterJson = JSON.parse(await Bun.file(characterPath!).text());
  check(
    "backup includes the saved character poster",
    characterJson.nodes.some(
      (node: { title: string; posterImage?: string }) =>
        node.title === "Dr Ada" && node.posterImage?.startsWith("data:image/webp"),
    ),
  );
  const savedCharacter = characterJson.nodes.find(
    (node: { title: string }) => node.title === "Dr Ada",
  );
  check(
    "character backup includes dossier notes",
    savedCharacter.age === "late 30s" &&
      savedCharacter.relationships === "Trusts Ben but keeps a secret" &&
      savedCharacter.appearance.includes("linen"),
  );
  await roster.getByRole("button", { name: "+ Add", exact: true }).click();
  await dossier.getByLabel("Name", { exact: true }).fill("Ben");
  await dossier.getByLabel("Age", { exact: true }).fill("42");
  await dossier.getByRole("button", { name: "Save changes" }).click();
  await roster.getByRole("button", { name: /Dr Ada/ }).click();
  check(
    "switching characters keeps their own details",
    (await dossier.getByText("late 30s").isVisible()) &&
      (await dossier.getByText("Left home after a failed rescue").isVisible()),
  );
  await page.keyboard.press("Control+s");
  await page.getByRole("button", { name: /^Saved on this device,/ }).waitFor();
  await page.reload();
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  await roster.getByRole("button", { name: /Dr Ada/ }).click();
  check(
    "character dossier survives reload",
    (await dossier.getByText("radiant skeptic with dry wit").isVisible()) &&
      (await dossier.getByText("late 30s").isVisible()),
  );
  await page.keyboard.press("Control+k");
  const characterSearch = page.getByRole("dialog");
  await characterSearch.getByRole("combobox").fill("radiant skeptic");
  await characterSearch.getByRole("option").filter({ hasText: "Dr Ada" }).click();
  check(
    "global search finds new character traits and opens the dossier",
    await dossier.getByRole("heading", { name: "Dr Ada", exact: true }).isVisible(),
  );
  await page.setViewportSize({ width: 417, height: 604 });
  check(
    "character dossier fits the narrow writing viewport",
    await page.evaluate(() => {
      const workspace = document.querySelector(".characters-workspace")!;
      return (
        document.documentElement.scrollWidth <= innerWidth &&
        workspace.getBoundingClientRect().width > 300
      );
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/stories");

  await signOut();
  check(
    "sign-out hides private content",
    (await page.getByText("Alice private legacy story", { exact: true }).count()) === 0,
  );
  await signIn("bob@example.com");
  check(
    "second user cannot see first user's stories",
    (await page.getByText("Alice private legacy story", { exact: true }).count()) === 0,
  );
  check(
    "browser databases are separate and legacy database preserved",
    await page.evaluate(async () => {
      const names = (await indexedDB.databases()).map((database) => database.name);
      return [
        "throughline.v1",
        "throughline.v1.user.fixture-alice",
        "throughline.v1.user.fixture-bob",
      ].every((name) => names.includes(name));
    }),
  );
  const otherTab = await context.newPage();
  await otherTab.goto(base + "/stories");
  await otherTab.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
  await signOut();
  check("primary tab signed out with another tab open", true);
  await otherTab.bringToFront();
  await otherTab.getByLabel("Username or email").waitFor();
  check(
    "sign-out in another tab closes private workspace",
    (await otherTab.getByRole("heading", { name: "Your stories", exact: true }).count()) === 0,
  );
  await otherTab.close();
  await signIn("alice@example.com");
  await page.getByText("Alice private legacy story", { exact: true }).waitFor();
  check("returning account retains its own saved stories", true);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  check(
    "owner profile shows invitation code and remaining seats",
    (await page.getByLabel("Invitation code", { exact: true }).inputValue()) ===
      "fixture-invite-code" &&
      (await page.getByText("2 of 5 accounts in use. 3 spaces available.").isVisible()),
  );
  check(
    "signed-in profile has no account creation form",
    (await page.getByRole("link", { name: "Create a new account", exact: true }).count()) === 0 &&
      (await page.getByLabel("Password", { exact: true }).count()) === 0,
  );
  await page.goto(base + "/profile/new-account");
  await page.waitForURL("**/profile");
  check(
    "old account creation route redirects to profile",
    new URL(page.url()).pathname === "/profile",
  );
  await signOut();
  await page.getByRole("button", { name: "Create a new account" }).click();
  await page.getByLabel("Username", { exact: true }).fill("new-writer");
  await page.getByLabel("Email", { exact: true }).fill("newwriter@example.com");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByLabel("Invitation code").fill("wrong");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.locator(".auth-error").waitFor();
  check(
    "wrong invitation code displays registration error",
    (await page.locator(".auth-error").innerText()).includes("invitation code"),
  );
  check(
    "failed registration removes only the just-created Firebase account",
    deletedNewUsers === 1,
  );
  loseRegistrationResponse = true;
  await page.getByLabel("Invitation code").fill("fixture-invite-code");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
  check(
    "login screen can create and open a new private account",
    await page.getByRole("link", { name: "Account", exact: true }).isVisible(),
  );
  check(
    "lost registration response does not delete the new Firebase identity",
    deletedNewUsers === 1,
  );
  check(
    "new account cannot see existing account stories",
    (await page.getByText("Alice private legacy story", { exact: true }).count()) === 0,
  );
  const cloudRecords = new Map<
    string,
    { kind: "nodes" | "edges"; id: string; data: any; version: number }
  >();
  cloudRecords.set("nodes:cloud-story", {
    kind: "nodes",
    id: "cloud-story",
    data: { id: "cloud-story", type: "project", title: "Cloud imported story" },
    version: 1,
  });
  await context.unroute("**/api/sync");
  await context.route("**/api/sync", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { configured: true } });
      return;
    }
    const body = route.request().postDataJSON();
    const conflicts = body.changes
      .filter((r: any) => (cloudRecords.get(`${r.kind}:${r.id}`)?.version ?? 0) !== r.baseVersion)
      .map((r: any) => ({ ...cloudRecords.get(`${r.kind}:${r.id}`), local: r.data }));
    if (conflicts.length) {
      await route.fulfill({
        status: 409,
        json: { ok: false, protocol: 2, error: "Resolve differences in your profile.", conflicts },
      });
      return;
    }
    for (const r of body.changes)
      cloudRecords.set(`${r.kind}:${r.id}`, {
        kind: r.kind,
        id: r.id,
        data: r.data,
        version: r.baseVersion + 1,
      });
    await route.fulfill({
      json: { ok: true, protocol: 2, records: [...cloudRecords.values()], syncedAt: Date.now() },
    });
  });
  await context.route("**/api/boneyard-sync", async (route) => {
    await route.fulfill({
      json: { ok: true, boneyardProtocol: 1, revisions: route.request().postDataJSON().revisions },
    });
  });
  await page.reload();
  await page.getByText("Cloud imported story", { exact: true }).waitFor();
  check("cloud download appears in a browser with no previous story copy", true);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("throughline.v1.user.fixture-newwriter");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("nodes", "readwrite");
      tx.objectStore("nodes").put({
        id: "cloud-story",
        type: "project",
        title: "Local conflicting edit",
      });
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  cloudRecords.set("nodes:cloud-story", {
    kind: "nodes",
    id: "cloud-story",
    data: { id: "cloud-story", type: "project", title: "Newer remote edit" },
    version: 2,
  });
  await page.goto(base + "/profile");
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await page.getByRole("heading", { name: "Choose which version to keep", exact: true }).waitFor();
  check(
    "conflict preserves both versions and offers an explicit choice",
    (await page.getByRole("button", { name: "Download both versions" }).isVisible()) &&
      cloudRecords.get("nodes:cloud-story")?.data.title === "Newer remote edit",
  );
  await page.getByRole("button", { name: "Use cloud versions", exact: true }).click();
  await page.getByText("Newer remote edit", { exact: true }).waitFor();
  check("cloud conflict resolution updates the story library", true);
  await page.goto(base + "/profile");
  await page.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
  check(
    "profile explains that attachment bytes stay on this device",
    await page
      .getByText(/Uploaded PDFs and images, unsent drafts and undo history stay on this device/)
      .isVisible(),
  );
  const secondState = await context.storageState({ indexedDB: true });
  for (const origin of secondState.origins) {
    const withDatabases = origin as typeof origin & { indexedDB?: Array<{ name: string }> };
    withDatabases.indexedDB = withDatabases.indexedDB?.filter(
      (db) => db.name === "firebaseLocalStorageDb",
    );
  }
  const secondDevice = await browser.newContext({ storageState: secondState });
  await secondDevice.route("**/api/auth/access", (route) =>
    route.fulfill({ json: { uid: "fixture-newwriter", email: "newwriter@example.com" } }),
  );
  await secondDevice.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { configured: true, registrationEnabled: true, remaining: 2 } }),
  );
  await secondDevice.route("**/api/auth/invitations", (route) =>
    route.fulfill({ json: { owner: false } }),
  );
  await secondDevice.route("**/api/sync", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { configured: true }
          : { ok: true, protocol: 2, records: [...cloudRecords.values()], syncedAt: Date.now() },
    }),
  );
  await secondDevice.route("**/api/boneyard-sync", (route) =>
    route.fulfill({ json: { ok: true, boneyardProtocol: 1, revisions: [] } }),
  );
  await secondDevice.route("https://identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      json: {
        users: [
          {
            localId: "fixture-newwriter",
            email: "newwriter@example.com",
            emailVerified: true,
            providerUserInfo: [{ providerId: "password", email: "newwriter@example.com" }],
          },
        ],
      },
    }),
  );
  const secondPage = await secondDevice.newPage();
  await secondPage.goto(base + "/stories");
  await secondPage.getByText("Newer remote edit", { exact: true }).waitFor();
  check("independent browser session downloads writing without a local workspace copy", true);
  await page.goto(base + "/stories");
  await page.getByRole("button", { name: "Delete project Newer remote edit", exact: true }).click();
  const deleteDialog = page.getByRole("dialog");
  await deleteDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  check(
    "cancel project deletion keeps the project",
    await page.getByText("Newer remote edit", { exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "Delete project Newer remote edit", exact: true }).click();
  const deletionSync = page.waitForResponse(
    (response) => response.url().endsWith("/api/sync") && response.request().method() === "POST",
  );
  await deleteDialog.getByRole("button", { name: "Delete project", exact: true }).click();
  await deleteDialog.waitFor({ state: "detached" });
  await deletionSync;
  check(
    "project deletion sends a cloud tombstone",
    cloudRecords.get("nodes:cloud-story")?.data === null,
  );
  await page.reload();
  await page.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
  check(
    "deleted project stays absent after reload",
    (await page.getByText("Newer remote edit", { exact: true }).count()) === 0,
  );
  await secondPage.reload();
  await secondPage.getByRole("heading", { name: "Your stories", exact: true }).waitFor();
  await secondPage.waitForFunction(async () => {
    const req = indexedDB.open("throughline.v1.user.fixture-newwriter");
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
    const absent = await new Promise<boolean>((resolve) => {
      const get = db.transaction("nodes").objectStore("nodes").get("cloud-story");
      get.onsuccess = () => resolve(!get.result);
    });
    db.close();
    return absent;
  });
  check(
    "cloud deletion removes the story in the second browser session",
    (await secondPage.getByText("Newer remote edit", { exact: true }).count()) === 0,
  );
  await secondDevice.close();
  await context.close();
  console.log(
    `${passed}/${passed} login browser assertions passed (Firebase responses mocked; browser storage real).`,
  );
} finally {
  await browser.close();
}
