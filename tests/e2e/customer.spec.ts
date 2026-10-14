import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { localSupabase } from "../local-supabase";
let local: ReturnType<typeof localSupabase>;
const email = `dd-browser-${Date.now()}@example.test`;
const password = "Browser-Sandbox-Test-123!";
const artifacts = "test-results/verified";
test.beforeAll(() => {
  local = localSupabase();
});
test.afterAll(async () => {
  const { data } = await local.admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (user) await local.admin.auth.admin.deleteUser(user.id);
});
async function emailLink(request: APIRequestContext, subject: string) {
  let link = "";
  await expect
    .poll(
      async () => {
        const list = await (
          await request.get(`${local.mail}/api/v1/messages`)
        ).json();
        const item = list.messages?.find(
          (m: { To: { Address: string }[]; Subject: string }) =>
            m.To.some((to) => to.Address === email) &&
            m.Subject.toLowerCase().includes(subject),
        );
        if (!item) return false;
        const message = await (
          await request.get(`${local.mail}/api/v1/message/${item.ID}`)
        ).json();
        link =
          message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&") ??
          "";
        return Boolean(link);
      },
      { timeout: 20000 },
    )
    .toBe(true);
  return link;
}
async function connect(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Versicherer verbinden", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: new RegExp(name) }).click();
  await dialog.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(
    dialog.getByText("Sie sind als Alex Morgan angemeldet."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Verbinden & Dokumente abrufen" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Verbinden & Dokumente abrufen" })
    .click();
  await expect(dialog).not.toBeVisible();
}
test("real customer journey: confirmation, consent, inbox, PDFs, account persistence and recovery", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.text().startsWith("PDF preview failed"))
      console.log(message.text());
  });
  page.on("request", (r) => {
    if (new URL(r.url()).searchParams.has("password"))
      errors.push("Password appeared in URL");
  });
  await page.goto("/register");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Konto erstellen", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Prüfen Sie Ihr E-Mail-Postfach",
  );
  // Email confirmation is genuinely required, not bypassed by the UI.
  const unconfirmed = await local
    .client()
    .auth.signInWithPassword({ email, password });
  expect(unconfirmed.error).toBeTruthy();
  await page.goto(await emailLink(request, "confirm"));
  await expect(
    page.getByRole("heading", { name: "Ihr Postfach wartet auf Sie." }),
  ).toBeVisible();
  await page.screenshot({
    path: `${artifacts}/empty-desktop.png`,
    fullPage: true,
  });
  // Canceling authorization must not create a connection.
  await page
    .getByRole("button", { name: "Versicherer verbinden", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Abbrechen" })
    .click();
  expect(
    (await (await page.request.get("/api/workspace")).json()).connections,
  ).toHaveLength(0);
  await connect(page, "Nordlicht");
  await expect(page.locator(".document-row")).toHaveCount(6);
  await connect(page, "Linden Leben");
  await expect(page.locator(".document-row")).toHaveCount(12);
  await connect(page, "Elbe Gesund");
  await expect(page.locator(".document-row")).toHaveCount(18);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.images).every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `${artifacts}/inbox-desktop.png`,
    fullPage: true,
  });
  // Search and combined filters.
  await page
    .getByPlaceholder("Dokumente durchsuchen …")
    .fill("Beitragsrechnung");
  await expect(page.locator(".document-row")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Versicherer", exact: true })
    .selectOption({ label: "Nordlicht" });
  await expect(page.locator(".document-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page
    .getByLabel("Dokumentenart", { exact: true })
    .selectOption("policy");
  await expect(page.locator(".document-row")).toHaveCount(6);
  await page.getByLabel("Von", { exact: true }).fill("2026-09-09");
  await page.getByLabel("Bis", { exact: true }).fill("2026-09-09");
  await expect(page.locator(".document-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page
    .getByPlaceholder("Dokumente durchsuchen …")
    .fill("nonexistent document");
  await expect(
    page.getByRole("heading", { name: "Keine passenden Dokumente" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filter zurücksetzen" })
    .first()
    .click();
  // Preview, second attachment and an actual download.
  await page.locator(".document-row").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "PDF öffnen" })).toBeVisible();
  await expect(dialog.locator(".attachment")).toHaveCount(2);
  await dialog.locator(".attachment").nth(1).click();
  await expect(dialog.getByRole("link", { name: "PDF öffnen" })).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Herunterladen", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^SAMPLE-.*-2.pdf$/);
  await expect(dialog.locator("canvas[data-ready=true]")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/document-preview.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /^Ungelesen/ }).click();
  await expect(page.locator(".document-row")).toHaveCount(17);
  await page.reload();
  await expect(page.locator(".document-row.unread")).toHaveCount(17);
  // Desktop and mobile EN/DE layouts remain usable.
  await page.getByLabel("Sprache ändern").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Everything important. In one place." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${artifacts}/inbox-mobile.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Insurers", exact: true })
    .click();
  await expect(page.locator(".insurer-card")).toHaveCount(3);
  await page.screenshot({
    path: `${artifacts}/connections-mobile.png`,
    fullPage: true,
  });
  await page.getByLabel("Change language").selectOption("de");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Refresh is idempotent and disconnection retains imported documents.
  await page
    .locator(".insurer-card")
    .first()
    .getByRole("button", { name: "Aktualisieren" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "auf dem neuesten Stand",
  );
  await page
    .locator(".insurer-card")
    .first()
    .getByRole("button", { name: "Verbindung trennen" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Verbindung trennen" })
    .click();
  await expect(page.getByRole("status")).toContainText("Verbindung getrennt");
  await page.getByRole("link", { name: /^Postfach/ }).click();
  await expect(page.locator(".document-row")).toHaveCount(18);
  await page.locator(".document-row").first().click();
  await expect(page.getByRole("link", { name: "PDF öffnen" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Mein Konto", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(
    page.getByRole("button", { name: "Anmelden", exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator(".document-row")).toHaveCount(18);
  // Recovery email and real password change.
  await page.goto("/forgot-password");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Link senden" }).click();
  await expect(page.getByRole("status")).toContainText("Falls ein Konto");
  await page.goto(await emailLink(request, "reset"));
  await expect(
    page.getByRole("button", { name: "Passwort speichern" }),
  ).toBeEnabled();
  await page
    .getByLabel("Neues Passwort", { exact: true })
    .fill("Changed-Browser-Password-123!");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("status")).toContainText("aktualisiert");
  expect(
    (
      await local
        .client()
        .auth.signInWithPassword({
          email,
          password: "Changed-Browser-Password-123!",
        })
    ).error,
  ).toBeNull();
  // Reset affects sample progress only.
  await page.goto("/account");
  await page.getByRole("button", { name: "Sandbox zurücksetzen" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sandbox zurücksetzen" })
    .click();
  await expect(page.getByRole("status")).toContainText("zurückgesetzt");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ihr Postfach wartet auf Sie." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
