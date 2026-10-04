# Exclusão de conta e dados

## Situação atual

Ainda não existe exclusão automática de conta implementada no produto.

Para a preparação de publicação, foi criada a página pública:

https://www.combinadofamilia.app/exclusao-de-conta

## Escopo de exclusão a considerar

A futura exclusão deve tratar, conforme aplicável:
- usuário responsável;
- filhos vinculados;
- tarefas;
- vigências;
- atribuições;
- ocorrências;
- histórico;
- registros de Fez e Não fez;
- bonificações;
- penalidades;
- dados relacionados a mesada;
- acessos públicos do painel do filho.

## Regras importantes

- confirmar a identidade do titular antes da exclusão;
- evitar excluir dados de outra conta;
- respeitar relacionamentos e cascatas do banco;
- invalidar links públicos relacionados;
- encerrar a sessão após concluir;
- definir prazo de atendimento;
- documentar eventuais retenções obrigatórias;
- não prometer exclusão automática antes da implementação real.

## Próxima decisão necessária

Definir o canal oficial de solicitação de exclusão e suporte.

Depois disso, a página pública e a Política de Privacidade poderão ser atualizadas com o processo final.


## Implementação adicionada

Foi adicionada a Edge Function `excluir-conta`, autenticada pelo token da sessão do usuário.

Fluxo implementado:
1. identifica o usuário autenticado;
2. localiza o responsável em `t_usuario_pai`;
3. exclui ocorrências;
4. exclui links públicos dos filhos;
5. exclui atribuições;
6. exclui vigências;
7. exclui tarefas;
8. exclui filhos;
9. exclui o registro do responsável;
10. exclui o usuário do Supabase Auth.

A tela **Minha conta** ganhou uma área de risco com botão **Excluir minha conta** e confirmação digitando `EXCLUIR`.

## Ainda pendente para considerar operacional

- publicar a Edge Function `excluir-conta` no projeto Supabase/Lovable;
- confirmar que `SUPABASE_SERVICE_ROLE_KEY` está disponível no ambiente da função;
- testar com uma conta descartável;
- validar que todos os registros da conta foram removidos;
- validar que os links públicos antigos deixam de funcionar;
- validar que o usuário não consegue mais efetuar login.

Não testar inicialmente com a conta principal do projeto.


## Deploy manual pelo GitHub Actions

Foi preparado o workflow `.github/workflows/deploy-supabase-functions.yml`.

Ele publica a função `excluir-conta` no projeto Supabase configurado no repositório e roda somente manualmente por `workflow_dispatch`.

Para executar sem expor credenciais no código:

1. criar no GitHub o secret `SUPABASE_ACCESS_TOKEN`;
2. abrir **Actions > Deploy Supabase Edge Function**;
3. clicar em **Run workflow**;
4. aguardar o deploy concluir com sucesso.

O workflow não contém token, senha ou service role key. O ambiente da Edge Function usa as variáveis reservadas do projeto Supabase.

Depois do deploy, o teste deve ser feito primeiro com uma conta descartável.
