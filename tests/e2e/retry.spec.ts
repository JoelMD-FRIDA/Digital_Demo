import { test, expect } from "@playwright/test";
import { localSupabase } from "../local-supabase";

test("failed import and preview can be retried without duplicate data or lost consent", async ({
  page,
}) => {
  const local = localSupabase();
  const email = `dd-retry-${Date.now()}@example.test`;
  const password = "Local-Retry-Password-123!";
  const { data, error } = await local.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error || new Error("No test user");
  try {
    await page.goto("/login");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ihr Postfach wartet auf Sie." }),
    ).toBeVisible();
    let failSync = true;
    await page.route("**/api/connections", async (route) => {
      if (
        route.request().method() === "POST" &&
        route.request().postDataJSON().action === "sync" &&
        failSync
      ) {
        failSync = false;
        return route.fulfill({ status: 500, json: { error: "TEST_FAILURE" } });
      }
      return route.continue();
    });
    await page
      .getByRole("button", { name: "Versicherer verbinden", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Nordlicht/ }).click();
    await dialog.getByRole("button", { name: "Weiter" }).click();
    await dialog.getByRole("button", { name: "Weiter" }).click();
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Verbinden & Dokumente abrufen" })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Verbunden, aber der Abruf ist fehlgeschlagen",
    );
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Versicherer", exact: true })
      .click();
    await page
      .locator(".insurer-card")
      .first()
      .getByRole("button", { name: "Aktualisieren" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "auf dem neuesten Stand",
    );
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /^Postfach/ })
      .click();
    await expect(page.locator(".document-row")).toHaveCount(6);
    let failPreview = true;
    await page.route("**/api/files/**", async (route) => {
      if (failPreview) {
        return route.fulfill({ status: 500, json: { error: "TEST_FAILURE" } });
      }
      return route.continue();
    });
    await page.locator(".document-row").first().click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    failPreview = false;
    await dialog.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(dialog.locator("canvas[data-ready=true]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    // Focus returns to the document trigger after the native dialog closes.
    await expect(page.locator(".document-row").first()).toBeFocused();
    expect(
      (await (await page.request.get("/api/workspace")).json()).documents,
    ).toHaveLength(6);
  } finally {
    await local.admin.auth.admin.deleteUser(data.user.id);
  }
});
