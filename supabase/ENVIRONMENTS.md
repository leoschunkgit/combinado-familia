# Ambientes Supabase — Combinado Família

## Projetos

| Ambiente | Projeto | Project Ref | Região |
| --- | --- | --- | --- |
| PRD | Combinado Família | `radwzkgpgdcwyjcpfcqw` | `sa-east-1` |
| DEV | Combinado Família DEV | `ewljvqwuxwhhxdxqezhn` | `sa-east-1` |

## Regra oficial de promoção

1. Toda alteração de banco deve ser criada como migration versionada no repositório.
2. Aplicar primeiro em DEV.
3. Validar migration, regras, RLS, triggers, RPCs e comportamento do app em DEV.
4. Somente depois aplicar a mesma migration, sem alterações, em PRD.
5. Edge Functions seguem a mesma ordem: DEV -> teste -> PRD.
6. Secrets, Auth, dados, cron e integrações são independentes por ambiente e nunca devem ser copiados automaticamente.
7. Dados de teste pertencem ao DEV. PRD recebe apenas dados reais.
8. Nunca apontar uma build de desenvolvimento para o Supabase PRD.

## Estado inicial sincronizado

Em 14/10/2026, DEV e PRD foram conferidos com a mesma estrutura:
- 17 tabelas públicas;
- 17 tabelas com RLS;
- 53 funções públicas;
- 17 triggers;
- 14 policies;
- Realtime em `t_app_config_signal`;
- migrations funcionais até `0057_restringir_funcao_interna_admin_master`;
- Edge Functions: `registrar-push-token`, `excluir-conta`, `enviar-pendencias-push` e `enviar-whatsapp`.

O cron de push antigo da Lovable não deve ser reutilizado. Cada ambiente terá seu próprio cron e seus próprios secrets.
