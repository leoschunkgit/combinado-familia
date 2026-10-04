# Deploy da exclusão de conta pelo Lovable Cloud

## Objetivo

Publicar a função serverless `excluir-conta` no backend gerenciado pelo Lovable Cloud e validar o fluxo sem usar a conta principal.

## Pré-condições

- Não migrar o backend.
- Não usar `SUPABASE_ACCESS_TOKEN`.
- Não testar primeiro com a conta principal.
- O código da função está em:
  - `supabase/functions/excluir-conta/index.ts`
- A tela de Minha conta já chama:
  - `supabase.functions.invoke("excluir-conta", ...)`

## Prompt exato para usar no Lovable

Use o seguinte pedido no chat do projeto Lovable:

> Publique no Lovable Cloud a função serverless/Edge Function `excluir-conta` que já está no repositório em `supabase/functions/excluir-conta/index.ts`. Preserve todo o código existente e não altere tabelas, autenticação, RLS, triggers, relações ou regras atuais. A função deve aceitar somente usuário autenticado, identificar o próprio responsável pela sessão, excluir somente os dados vinculados a esse responsável e, por último, excluir o usuário do Auth. Não use nem exponha credenciais no frontend. Depois do deploy, confirme apenas que a função foi publicada com sucesso e está disponível para a chamada `supabase.functions.invoke("excluir-conta")`.

## Depois que o Lovable confirmar o deploy

Criar uma conta descartável e executar este teste:

1. cadastrar um responsável de teste;
2. cadastrar pelo menos um filho;
3. cadastrar tarefa;
4. cadastrar vigência;
5. criar atribuição;
6. registrar uma ocorrência;
7. gerar um link público do filho;
8. guardar o link público;
9. acessar Minha conta;
10. selecionar Excluir minha conta;
11. digitar `EXCLUIR`;
12. confirmar a exclusão.

## Validações obrigatórias

Depois da exclusão:

- a sessão deve encerrar;
- o usuário deve voltar para a tela de login;
- o login com a conta excluída deve falhar;
- o link público antigo do filho deve deixar de funcionar;
- os dados vinculados à conta não devem permanecer acessíveis;
- nenhuma outra conta deve ser afetada.

## Critério de conclusão

Só marcar a exclusão de conta como concluída quando:

- a função estiver publicada no Lovable Cloud;
- o teste com conta descartável passar;
- login, dados e links públicos tiverem sido validados após a exclusão.
