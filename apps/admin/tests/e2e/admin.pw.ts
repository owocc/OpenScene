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
    const systemLink = page.getByRole("link", { name: "系统", exact: true });
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
    await expect(page.getByRole("heading", { name: "Apps" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0, { timeout: 10000 });

    await page.getByRole("button", { name: "Create" }).first().click();
    const createDialog = page.getByRole("dialog", { name: /Create App/i });
    await expect(createDialog).toBeVisible();
    const key = `table-test-${Date.now()}`;
    await createDialog.getByLabel("Key").fill(key);
    await createDialog.getByLabel("Name").fill("Table test app");
    await expect(createDialog.getByLabel("Key")).toHaveValue(key);
    await expect(createDialog.getByLabel("Name")).toHaveValue("Table test app");
    await createDialog.locator("button", { hasText: "Create" }).click({ force: true });
    await expect(createDialog).toBeHidden();
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    const targetRow = table.locator("tr", { hasText: key });
    await expect(targetRow).toBeVisible();
    await expect(targetRow.getByRole("button", { name: "More options" })).toHaveCount(1);
    await expect(targetRow.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(targetRow.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await targetRow.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(key)).toHaveCount(0);
  });

  test("keeps the sidebar mounted while the page changes", async ({ page }) => {
    await page.goto("/apps?mode=standalone&lang=en");
    const sidebar = page.getByRole("complementary");
    await sidebar.evaluate((element) => {
      element.setAttribute("data-test-sidebar-instance", "persistent");
    });

    await sidebar.getByRole("link", { name: "System", exact: true }).click();
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
    await page.getByRole("button", { name: "Open sidebar" }).click({ force: true });
    await expect(page.getByRole("link", { name: "API reference" })).toBeVisible();
  });
  test("supports icon collapsible sidebar with persistent state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/apps?mode=standalone&lang=en");
    const sidebar = page.getByRole("complementary");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    const toggleButton = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggleButton).toBeVisible();
    await toggleButton.evaluate((el: HTMLElement) => el.click());
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await page.reload();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });
});

test.describe("Components console", () => {
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
    await expect(page.getByRole("button", { name: /Create|Edit|Delete|Push/ })).toHaveCount(0);
  });
});
