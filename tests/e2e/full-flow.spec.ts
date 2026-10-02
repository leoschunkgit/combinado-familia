import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Combinado Família - fluxo E2E completo", () => {
  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para executar o fluxo autenticado.");

  test("filho → tarefa → vigência → atribuição → ocorrência → relatório → PDF", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Fluxo completo roda no desktop; o projeto mobile valida navegação e layout.");

    const sufixo = Date.now();
    const nomeFilho = `E2E Filho ${sufixo}`;
    const nomeTarefa = `E2E Tarefa ${sufixo}`;
    const penalidade = `E2E Penalidade ${sufixo}`;

    const agora = new Date();
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - 1);
    const fim = new Date(agora);
    fim.setDate(fim.getDate() + 30);

    const brDateTime = (date: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    await page.goto("/");
    await page.locator("#le").fill(email!);
    await page.locator("#ls").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/ocorrencias/);

    const pularGuia = page.getByRole("button", { name: "Pular guia" }).first();
    if (await pularGuia.isVisible().catch(() => false)) {
      await pularGuia.click();
    }

    await test.step("cadastrar filho", async () => {
      await page.goto("/filhos");
      await expect(page.getByRole("heading", { name: "Filhos" })).toBeVisible();
      await page.getByLabel("Nome").fill(nomeFilho);
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page.getByText(nomeFilho, { exact: true })).toBeVisible();
    });

    await test.step("cadastrar tarefa", async () => {
      await page.goto("/tarefas");
      await expect(page.getByRole("heading", { name: "Tarefas" })).toBeVisible();
      await page.getByLabel("Nome").fill(nomeTarefa);
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page.getByText(nomeTarefa, { exact: true })).toBeVisible();
    });

    await test.step("cadastrar vigência em andamento", async () => {
      await page.goto("/vigencias");
      await expect(page.getByRole("heading", { name: "Vigências" })).toBeVisible();
      await page.locator("#inicio").fill(brDateTime(inicio));
      await page.locator("#fim").fill(brDateTime(fim));
      await page.locator("#novo-penalidade").fill(penalidade);
      await page.locator("#novo-valor").fill("10");
      await page.locator('input[type="number"]').first().fill("3");
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page.getByText(penalidade, { exact: true })).toBeVisible();
    });

    await test.step("criar atribuição", async () => {
      await page.goto("/atribuicoes");
      await expect(page.getByRole("heading", { name: "Filho na tarefa" })).toBeVisible();

      const selects = page.getByRole("button", { name: "Selecione" });
      await selects.nth(0).click();
      await page.getByRole("option").filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ }).first().click();

      await page.getByRole("button", { name: "Selecione" }).nth(0).click();
      await page.getByRole("option", { name: nomeFilho, exact: true }).click();

      await page.getByRole("button", { name: "Selecione" }).nth(0).click();
      await page.getByRole("menuitemcheckbox", { name: nomeTarefa, exact: true }).click();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Adicionar" }).click();
      await expect(page.getByText(nomeTarefa, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cadastrar (1)" }).click();
      await expect(page.getByText(/1 atribuição.*cadastrada/i)).toBeVisible();
    });

    await test.step("registrar Não fez", async () => {
      await page.goto("/ocorrencias");
      await expect(page.getByText(nomeFilho, { exact: true })).toBeVisible();
      const tarefa = page.getByText(nomeTarefa, { exact: true }).first();
      await expect(tarefa).toBeVisible();
      const naoFez = tarefa.locator("..").getByRole("button", { name: "Não fez" });
      await naoFez.click();
      await expect(page.getByRole("heading", { name: "Registrar “Não fez”" })).toBeVisible();
      await page.getByRole("button", { name: "Confirmar" }).click();
      await expect(page.getByText(/Ocorrência registrada \(1\/3\)/)).toBeVisible();
      await expect(page.getByText(/1º não fez/)).toBeVisible();
    });

    await test.step("validar relatório", async () => {
      await page.goto("/relatorio");
      await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
      await expect(page.getByText(nomeFilho, { exact: true })).toBeVisible();
      await expect(page.getByText(nomeTarefa, { exact: true })).toBeVisible();
      await expect(page.getByText("Não fez: 1 de 3", { exact: true })).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Extrair PDF" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^relatorio-combinado-.*\.pdf$/);
    });
  });
});
