# Autoteste da exclusão de conta

## Objetivo

Validar automaticamente o fluxo completo de exclusão sem exigir que o usuário crie manualmente uma conta de teste.

A função temporária está em:

`supabase/functions/testar-exclusao-conta/index.ts`

## O que ela faz

1. cria um usuário descartável no Auth;
2. cria o responsável;
3. cria filho;
4. cria tarefa;
5. cria vigência;
6. cria atribuição;
7. cria ocorrência;
8. cria link público;
9. faz login com o usuário descartável;
10. chama a função real `excluir-conta`;
11. verifica se:
   - o usuário do Auth foi removido;
   - as tabelas vinculadas ao responsável ficaram zeradas;
   - o link público deixou de funcionar.

## Segurança

Essa função é exclusivamente de teste e usa privilégios administrativos do backend para criar a conta descartável.

Ela NÃO deve permanecer publicada depois da validação.

## Prompt para o Lovable

Use no chat do projeto:

> Publique temporariamente no Lovable Cloud a função serverless/Edge Function `testar-exclusao-conta` que já está no repositório em `supabase/functions/testar-exclusao-conta/index.ts`. Não altere nenhuma tabela, RLS, trigger, autenticação ou regra existente. Depois do deploy, execute essa função uma única vez e me mostre o JSON retornado. Se o resultado for `AUTOTESTE_APROVADO`, remova/despublique imediatamente a função `testar-exclusao-conta`, mantendo publicada apenas a função real `excluir-conta`.

## Critério de aprovação

O retorno esperado é:

`AUTOTESTE_APROVADO`

E todos os checks devem estar `true`.

Depois disso:
- remover/despublicar `testar-exclusao-conta`;
- manter `excluir-conta`;
- atualizar o checklist principal como exclusão validada de ponta a ponta.
