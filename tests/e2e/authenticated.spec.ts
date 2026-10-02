import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Combinado Família - usuário autenticado", () => {
  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para executar os testes autenticados.");

  test("faz login e abre ocorrências", async ({ page }) => {
    await page.goto("/");
    await page.locator("#le").fill(email!);
    await page.locator("#ls").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/ocorrencias/);
  });

  test("abre as áreas principais sem erro de rota", async ({ page }) => {
    for (const path of ["/ocorrencias", "/filhos", "/tarefas", "/vigencias", "/atribuicoes", "/historico", "/relatorio"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/404/);
      await expect(page.locator("body")).not.toContainText(/Application error|Unhandled Runtime Error/i);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
  });

  test("menu mobile abre e mostra as opções principais", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1024) >= 768, "Teste exclusivo para o projeto mobile.");
    await page.goto("/ocorrencias");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("complementary", { name: "Menu lateral mobile" })).toBeVisible();
    await expect(page.getByText("Relatório", { exact: true })).toBeVisible();
    await expect(page.getByText("Ajuda", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(page.getByRole("complementary", { name: "Menu lateral mobile" })).toBeHidden();
  });
});
