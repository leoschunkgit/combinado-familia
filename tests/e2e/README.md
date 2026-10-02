# Testes E2E

Os testes usam Playwright contra a URL de produção definida em `E2E_BASE_URL`.

Para habilitar os testes autenticados no GitHub Actions, configure no repositório os secrets:

- `E2E_EMAIL`: e-mail do usuário de teste
- `E2E_PASSWORD`: senha do usuário de teste

O fluxo completo usa dados com sufixo de timestamp para evitar colisões entre execuções.

Os testes públicos rodam sem secrets. Os testes autenticados são marcados como skipped quando as credenciais não estão configuradas.

Comandos locais:

```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:e2e:ui
```

O fluxo completo valida login, filho, tarefa, vigência, atribuição, ocorrência, relatório e download do PDF. O projeto mobile valida menu, navegação e ausência de overflow horizontal.
