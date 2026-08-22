import { expect, test } from "@playwright/test";

test.describe("Admin shell", () => {
  test("renders standalone navigation and preserves query context", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/apps?mode=standalone&lang=zh-CN");
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("link", { name: "应用" })).toBeVisible();
    const appSelector = sidebar.getByRole("combobox", { name: "选择应用" });
    await expect(appSelector).toHaveClass(/!w-full/);
    await expect(sidebar.getByRole("textbox", { name: "搜索" })).toBeVisible();
    await expect(sidebar.getByText("OpenScene")).toHaveCount(0);
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.height ?? 0).toBeGreaterThan(890);
    const appSelectorBox = await appSelector.boundingBox();
    expect(appSelectorBox?.width ?? 0).toBeGreaterThan((sidebarBox?.width ?? 0) - 40);
    const systemLink = page.getByRole("link", { name: "系统" });
    await expect(systemLink).toHaveAttribute("href", /mode=standalone/);
    await expect(systemLink).toHaveAttribute("href", /lang=zh-CN/);
  });

  test("keeps dialog content away from the panel edges", async ({ page }) => {
    await page.goto("/apps?mode=standalone&lang=en");
    await page.getByRole("button", { name: "Create" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("padding-left", "32px");
    await expect(dialog).toHaveCSS("padding-top", "24px");
  });

  test("uses a single dropdown action for app rows", async ({ page }) => {
    await page.goto("/apps?mode=standalone&lang=en");

    await page.getByRole("button", { name: "Create" }).first().click();
    const createDialog = page.getByRole("dialog");
    const key = `table-test-${Date.now()}`;
    await createDialog.getByLabel("Key").fill(key);
    await createDialog.getByLabel("Name").fill("Table test app");
    await createDialog.getByRole("button", { name: "Create" }).click();

    const credentialsDialog = page.getByRole("dialog").filter({ hasText: "Created" });
    await credentialsDialog.getByRole("button", { name: "Continue" }).click();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    const firstRow = table.getByRole("row").nth(1);
    await expect(firstRow.getByRole("button", { name: "More options" })).toHaveCount(1);
    await expect(firstRow.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(firstRow.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await firstRow.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();

    await page.getByRole("menuitem", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
  });

  test("keeps the sidebar mounted while the page changes", async ({ page }) => {
    await page.goto("/apps?mode=standalone&lang=en");
    const sidebar = page.getByRole("complementary");
    await sidebar.evaluate((element) => {
      element.setAttribute("data-test-sidebar-instance", "persistent");
    });

    await sidebar.getByRole("link", { name: "System" }).click();
    await expect(page).toHaveURL(/\/system\?/);
    await expect(sidebar).toHaveAttribute("data-test-sidebar-instance", "persistent");
  });

  test("hides global chrome in embedded mode", async ({ page }) => {
    await page.goto("/apps?mode=embedded&lang=en");
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Apps" })).toBeVisible();
  });

  test("supports the mobile sidebar sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/apps?mode=standalone&lang=en");
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await expect(page.getByRole("link", { name: "API reference" })).toBeVisible();
  });
});

test.describe("App Key rotation", () => {
  test("confirms rotation, reveals the replacement once, and revokes the old key", async ({
    page,
    request,
  }) => {
    const key = `rotation-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "Rotation test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as {
      id: string;
      credentials: { appKey: string };
    };
    const manifest = {
      protocolVersion: "1.0.0",
      app: { key, type: "web" },
      components: {},
    };

    await page.goto(`/settings?mode=standalone&lang=en&appId=${app.id}`);
    await page.getByRole("button", { name: "Rotate App Key" }).click();

    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText(
      "Your current App Key will be revoked immediately. Builds and manifest publishing that use it will stop working.",
    );
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmation).toBeHidden();

    const unchangedKeyResponse = await request.post(`/api/v1/apps/${app.id}/manifest/push`, {
      headers: { "x-openscene-app-key": app.credentials.appKey },
      data: manifest,
    });
    expect(unchangedKeyResponse.ok()).toBeTruthy();

    await page.getByRole("button", { name: "Rotate App Key" }).click();
    await confirmation.getByRole("button", { name: "Rotate App Key" }).click();

    const result = page.getByRole("dialog").filter({ hasText: "App Key rotated" });
    await expect(result).toBeVisible();
    const replacementKey = (await result.getByText(/^appkey_/).textContent()) ?? "";
    expect(replacementKey).not.toBe("");
    expect(replacementKey).not.toBe(app.credentials.appKey);
    await expect(page).not.toHaveURL(new RegExp(replacementKey));

    const oldKeyResponse = await request.post(`/api/v1/apps/${app.id}/manifest/push`, {
      headers: { "x-openscene-app-key": app.credentials.appKey },
      data: manifest,
    });
    expect(oldKeyResponse.ok()).toBeFalsy();
    const replacementKeyResponse = await request.post(`/api/v1/apps/${app.id}/manifest/push`, {
      headers: { "x-openscene-app-key": replacementKey },
      data: manifest,
    });
    expect(replacementKeyResponse.ok()).toBeTruthy();

    await result.getByRole("button", { name: "Continue" }).click();
    await expect(result).toBeHidden();
    await expect(page.getByText(replacementKey)).toHaveCount(0);
    const persistedBrowserState = await page.evaluate(() =>
      JSON.stringify({
        localStorage: Object.fromEntries(
          Array.from({ length: localStorage.length }, (_, index) => {
            const key = localStorage.key(index);
            return [key, key === null ? null : localStorage.getItem(key)];
          }),
        ),
        sessionStorage: Object.fromEntries(
          Array.from({ length: sessionStorage.length }, (_, index) => {
            const key = sessionStorage.key(index);
            return [key, key === null ? null : sessionStorage.getItem(key)];
          }),
        ),
      }),
    );
    expect(persistedBrowserState).not.toContain(replacementKey);
  });
});

test.describe("Components console", () => {
  test("lists active-manifest components in record-key order and opens their metadata", async ({
    page,
    request,
  }) => {
    const key = `components-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "Components test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as {
      id: string;
      credentials: { appKey: string };
    };
    const manifestResponse = await request.post(`/api/v1/apps/${app.id}/manifest/push`, {
      headers: { "x-openscene-app-key": app.credentials.appKey },
      data: {
        protocolVersion: "1.0.0",
        app: { key, type: "web" },
        components: {
          Button: {
            title: "Button",
            category: "Controls",
            props: { type: "object", properties: { label: { type: "string" } } },
            editor: { icon: "cursor" },
            events: { press: {} },
            capabilities: { interactive: true },
          },
          Alert: {
            title: "Alert",
            category: "Feedback",
            props: { type: "object", properties: {} },
            dynamic: { visible: true },
            slots: {},
            runtime: { component: "Alert" },
          },
        },
      },
    });
    expect(manifestResponse.ok()).toBeTruthy();

    await page.goto(`/components?mode=standalone&lang=en&appId=${app.id}`);
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("row").nth(1)).toContainText("Alert");
    await expect(table.getByRole("row").nth(2)).toContainText("Button");
    await expect(table.getByRole("row").nth(2)).toContainText("1");

    const search = page.getByRole("textbox", { name: "Search components" });
    await search.fill("controls");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table).toContainText("Button");

    await table.getByRole("link", { name: "Details" }).click();
    await expect(page).toHaveURL(/\/components\/Button\?/);
    await expect(page.getByRole("heading", { name: "Button" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Props schema" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editor metadata" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Runtime mapping" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create|Edit|Delete|Push|App Key/ })).toHaveCount(
      0,
    );
  });

  test("guides build publication when the selected app has no active manifest", async ({
    page,
    request,
  }) => {
    const key = `components-empty-${Date.now()}`;
    const appResponse = await request.post("/api/v1/apps", {
      data: {
        key,
        name: "Components empty test app",
        type: "web",
        status: "active",
        manifest: { mode: "push" },
      },
    });
    expect(appResponse.ok()).toBeTruthy();
    const app = (await appResponse.json()) as { id: string };

    await page.goto(`/components?mode=standalone&lang=en&appId=${app.id}`);
    await expect(page.getByRole("heading", { name: "No active manifest" })).toBeVisible();
    await expect(page.getByText("Components are managed by build output.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create|Edit|Delete|Push|App Key/ })).toHaveCount(
      0,
    );
  });
});
