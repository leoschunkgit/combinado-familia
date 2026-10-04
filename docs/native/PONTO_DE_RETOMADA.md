# Ponto de retomada — Combinado Família Android

Atualizado em 04/10/2026.

## Já concluído nesta etapa

- Fluxo de exclusão de conta implementado no app.
- Função de backend para exclusão criada.
- Confirmação forte na tela Minha conta.
- Bateria de CI concluída com sucesso:
  - build principal;
  - Capacitor Android;
  - Manifest;
  - identidade Android;
  - APK;
  - AAB;
  - release;
  - validação de assinatura.
- Workflow manual para publicar a função de exclusão preparado sem credenciais gravadas no código.
- A preparação desse deploy também passou na bateria de CI.

## Próximo ponto obrigatório

1. Configurar no GitHub o secret necessário para autenticar o deploy do Supabase.
2. Executar manualmente o workflow "Deploy Supabase Edge Function".
3. Testar a exclusão usando uma conta descartável.
4. Confirmar que:
   - os dados da conta foram removidos;
   - os links públicos antigos deixaram de funcionar;
   - o usuário excluído não consegue mais entrar.
5. Só depois marcar a exclusão de conta como concluída no checklist principal.

## Observação

A etapa não deve ser considerada 100% concluída antes do deploy no backend real e do teste de ponta a ponta com conta descartável.
