import { expect, test } from "@playwright/test";

test.describe("Admin OpenAPI docs", () => {
  async function openDocsPage(page: import("@playwright/test").Page, appId: string) {
    await page.goto(`/openapi-docs?mode=standalone&lang=en&appId=${appId}`);
    await expect(page.getByRole("heading", { name: "OpenAPI docs" })).toBeVisible();
  }

  test("lists, creates and toggles default for OpenAPI documents", async ({ page, request }) => {
    const key = `openapi-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "OpenAPI test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as { id: string };

    await openDocsPage(page, app.id);

    await page.getByRole("button", { name: "Create" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(`pw-doc-${Date.now()}`);
    await dialog.getByLabel("OpenAPI JSON").fill(
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "PW", version: "1.0" },
        paths: { "/ping": { get: { summary: "Ping" } } },
      }),
    );
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Created")).toBeVisible();

    const row = page.locator("tbody tr", { hasText: "pw-doc-" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "1", exact: true })).toBeVisible();
  });

  test("rejects invalid JSON and shows the error hint", async ({ page, request }) => {
    const key = `openapi-invalid-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "OpenAPI invalid test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as { id: string };

    await openDocsPage(page, app.id);

    await page.getByRole("button", { name: "Create" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("invalid-json-doc");
    await dialog.getByLabel("OpenAPI JSON").fill("{ not json");
    await expect(dialog.getByText("Invalid JSON: must be an object with paths")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
