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
- migrations funcionais versionadas até `0061_consolidar_permissoes_funcoes_auditadas`;
- Edge Functions: `registrar-push-token`, `excluir-conta`, `enviar-pendencias-push` e `enviar-whatsapp`.

O cron de push antigo da Lovable não deve ser reutilizado. Cada ambiente possui seu próprio cron, secrets e Vault.\n\n## Estado de segurança após auditoria\n\n- DEV e PRD com ACLs de funções alinhadas e consolidadas em `0061_consolidar_permissoes_funcoes_auditadas`.\n- Tabelas internas e tabelas de push endurecidas em `0060_hardening_tabelas_internas_e_push`.\n- `anon` e `authenticated` sem acesso direto às tabelas internas de push; Edge Functions usam `service_role` com privilégio mínimo.\n- Painel público do filho mantém apenas a RPC `obter_painel_publico_filho(uuid)` para `anon`, por desenho.\n- Security Advisor: os 8 itens `RLS Enabled No Policy` das tabelas internas são intencionais (default deny).\n- Push agendado em duas janelas diárias por ambiente: 12:00 e 19:30 (America/Sao_Paulo), versionado em `0058` e `0059`.\n
