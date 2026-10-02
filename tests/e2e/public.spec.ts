import { test, expect } from "@playwright/test";

test.describe("Combinado Família - acesso público", () => {
  test("abre a página inicial e apresenta login/cadastro", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Combinado/i);
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Cadastrar" })).toBeVisible();
  });

  test("permite abrir o cadastro e exibe regras de senha", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Cadastrar" }).click();
    await expect(page.getByRole("heading", { name: "Cadastrar usuário" })).toBeVisible();
    await page.locator("#cs").fill("abc");
    await expect(page.getByText("Pelo menos 6 caracteres")).toBeVisible();
    await expect(page.getByText("Uma letra maiúscula")).toBeVisible();
  });

  test("não cria overflow horizontal no celular", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
