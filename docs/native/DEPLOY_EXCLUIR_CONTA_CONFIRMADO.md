# Deploy da exclusão de conta confirmado

Data: 04/10/2026

O Lovable confirmou que a função `excluir-conta` foi publicada com sucesso no Lovable Cloud.

A função está disponível para a chamada:

`supabase.functions.invoke("excluir-conta")`

## Próxima etapa obrigatória

Testar o fluxo de ponta a ponta com uma conta descartável.

Validar:
- exclusão dos dados da conta;
- invalidação dos links públicos antigos;
- impossibilidade de login com a conta excluída;
- nenhuma outra conta afetada.

Só depois dessa validação a exclusão de conta deve ser marcada como concluída no checklist principal.
