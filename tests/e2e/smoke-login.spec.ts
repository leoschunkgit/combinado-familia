import { test, expect } from "@playwright/test";

test("smoke: login + cadastrar filho", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD não configurados");

  await page.goto("/");
  await expect(page.locator("#le")).toBeVisible();
  await expect(page.locator("#ls")).toBeVisible();

  await page.locator("#le").fill(email!);
  await page.locator("#ls").fill(password!);

  const authResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/token") &&
      response.request().method() === "POST",
    { timeout: 15_000 }
  );

  await page.getByRole("button", { name: "Entrar" }).click();

  const authResponse = await authResponsePromise;
  const authStatus = authResponse.status();

  if (authStatus !== 200) {
    let details = "";
    try {
      const body = await authResponse.json();
      details = [
        body.error_code,
        body.code,
        body.msg,
        body.message,
        body.error,
      ]
        .filter(Boolean)
        .join(" | ");
    } catch {
      // Não expõe corpo bruto da resposta em caso de erro.
    }

    throw new Error(
      `LOGIN_FAILED_AUTH: Supabase respondeu HTTP ${authStatus}${details ? ` — ${details}` : ""}`
    );
  }

  await expect(page).toHaveURL(/\/ocorrencias/, { timeout: 15_000 });

  const nomeFilho = `Teste E2E ${Date.now()}`;
  await page.goto("/filhos");
  await expect(page.getByRole("heading", { name: "Filhos" })).toBeVisible();

  const nomeInput = page.locator("input").first();
  await nomeInput.fill(nomeFilho);

  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Filho cadastrado")).toBeVisible();
  await expect(page.getByText(nomeFilho, { exact: true })).toBeVisible();

  const nomeTarefa = `Teste E2E tarefa ${Date.now()}`;
  await page.goto("/tarefas");
  await expect(page.getByRole("heading", { name: "Tarefas" })).toBeVisible();

  const tarefaInput = page.locator("input").first();
  await tarefaInput.fill(nomeTarefa);

  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Tarefa cadastrada")).toBeVisible();
  await expect(page.getByText(nomeTarefa, { exact: true })).toBeVisible();

  await page.goto("/vigencias");
  await expect(page.getByRole("heading", { name: "Vigências" })).toBeVisible();

  await page.locator("#inicio").fill("01/10/2026 00:00");
  await page.locator("#fim").fill("31/12/2026 23:59");
  await page.locator("#novo-penalidade").fill("Sem videogame");
  await page.locator("#novo-valor").fill("20,00");
  await page.getByRole("spinbutton").fill("3");

  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Vigência cadastrada")).toBeVisible();

  await page.goto("/atribuicoes");
  await expect(page.getByRole("heading", { name: "Filho na tarefa" })).toBeVisible();

  const selects = page.getByRole("combobox");
  await selects.nth(0).click();
  await page.getByRole("option").first().click();

  await selects.nth(1).click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: /Selecione/ }).click();
  await page.getByRole("menuitemcheckbox").nth(1).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: /^Cadastrar \(1\)$/ }).click();

  await expect(page.getByText(/1 atribuição\(ões\) cadastrada\(s\)/)).toBeVisible();
});
