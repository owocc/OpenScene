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
