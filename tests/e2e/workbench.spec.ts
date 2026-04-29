import { expect, test } from "@playwright/test";

test("loads the workbench and simplifies the normal function example", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "公式化简工作台" })).toBeVisible();
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);

  await page.getByRole("button", { name: "普通函数" }).click();
  await page.getByRole("button", { name: "运行化简" }).click();

  await expect(page.locator(".result-value")).toHaveText("x+2", { timeout: 15_000 });
  expect(consoleErrors).toEqual([]);
});

test("enforces the shared f/g/h function limit", async ({ page }) => {
  await page.goto("/");

  const functionsPanel = page.locator(".functions-panel");
  const addButton = functionsPanel.getByRole("button", { name: "添加自定义函数" });

  await addButton.click();
  await functionsPanel.getByRole("button", { name: "递推" }).click();
  await addButton.click();
  await functionsPanel.getByRole("button", { name: "普通" }).click();
  await addButton.click();

  await expect(functionsPanel.getByText("已达到 f/g/h 数量上限")).toBeVisible();
  await expect(functionsPanel.getByRole("button", { name: "已达到 f/g/h 数量上限" })).toBeDisabled();
});

test("keeps the grammar reference collapsed until requested", async ({ page }) => {
  await page.goto("/");

  const grammar = page.locator(".grammar-reference");
  const details = page.locator(".grammar-details");
  await expect(grammar.getByText("乘法必须显式写")).toBeVisible();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(grammar.getByText('FunctionName  ::= "f" | "g" | "h"')).toBeHidden();

  await grammar.getByText("展开输入文法").click();

  await expect(details).toHaveAttribute("open", "");
  await expect(grammar.getByText('FunctionName  ::= "f" | "g" | "h"')).toBeVisible();
  await expect(grammar.getByText('"sin(" Factor ")"')).toBeVisible();
  await expect(grammar.getByText("ArgList       ::= Factor | Factor")).toBeVisible();
});
