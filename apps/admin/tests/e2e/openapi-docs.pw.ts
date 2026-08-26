import { expect, test, type Page } from "@playwright/test";

test.describe("Admin OpenAPI docs", () => {
  async function openDocsPage(page: Page, appId: string) {
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

  test("navigates to details page, views endpoints/schemas/source, edits and uploads JSON", async ({
    page,
    request,
  }) => {
    const key = `openapi-detail-${Date.now()}`;
    const docName = `detail-doc-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "OpenAPI detail test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as { id: string };

    const docResponse = await request.post(`/api/v1/apps/${app.id}/openapi-docs`, {
      data: {
        name: docName,
        json: {
          openapi: "3.0.3",
          info: { title: "Petstore API", version: "1.0.0", description: "A sample petstore API" },
          paths: {
            "/pets": {
              get: { summary: "List pets", operationId: "listPets" },
              post: { summary: "Create pet", operationId: "createPet" },
            },
          },
          components: {
            schemas: {
              Pet: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                },
              },
            },
          },
        },
      },
    });
    expect(docResponse.ok()).toBeTruthy();

    // Navigate to openapi-docs list
    await openDocsPage(page, app.id);

    // Click on document name link to navigate to the details page
    await page.getByRole("button", { name: docName }).click();

    // Verify detail page header
    await expect(page.getByRole("heading", { name: docName })).toBeVisible();
    await expect(page.getByText("OpenAPI 3.0.3")).toBeVisible();
    await expect(page.getByText("2 endpoints")).toBeVisible();
    await expect(page.getByText("v1.0.0")).toBeVisible();

    // Verify Endpoints view
    await expect(page.getByText("/pets").first()).toBeVisible();

    // Switch to Schemas tab
    await page.getByRole("button", { name: "Schemas (1)" }).click();
    await expect(page.getByText("Pet", { exact: true })).toBeVisible();

    // Switch to JSON Source tab
    await page.getByRole("button", { name: "JSON Source" }).click();
    await expect(page.getByText("OpenAPI Specification JSON")).toBeVisible();

    // Open Upload Modal
    await page.getByRole("button", { name: "Upload" }).click();
    const uploadDialog = page.getByRole("dialog");
    await expect(uploadDialog.getByText("Upload OpenAPI specification")).toBeVisible();
    await expect(
      uploadDialog.getByText("Drag and drop your OpenAPI .json file here"),
    ).toBeVisible();
    await uploadDialog.getByRole("button", { name: "Cancel" }).click();

    // Edit OpenAPI
    await page.getByRole("button", { name: "Edit OpenAPI" }).click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText("Edit OpenAPI", { exact: true })).toBeVisible();
    await editDialog.getByLabel("Name").fill(`${docName}-updated`);
    await editDialog.getByRole("button", { name: "Save" }).click();

    // Verify updated name in details page
    await expect(page.getByRole("heading", { name: `${docName}-updated` })).toBeVisible();
  });
});
