# Alinhamento da PRD — 22/10/2026

Direção autorizada: DEV → PRD, incluindo dev → main. Nenhum registro da DEV foi copiado.

## Procedimento aplicado

Os três SQLs desta pasta foram executados exclusivamente na PRD radwzkgpgdcwyjcpfcqw via apply_migration, com as versões correspondentes aos nomes dos arquivos. São registros de implantação sobre o estado anterior da PRD, não migrações para reaplicar na DEV ou na cadeia histórica de uma instalação nova.

Não executar db push indiscriminadamente para reaplicar as migrações históricas da DEV na PRD. A reconciliação estrutural foi feita diretamente com base nos catálogos dos dois ambientes; o histórico de execução de migrações continua específico de cada ambiente.

## Preservação dos dados

Os registros e valores das colunas mantidas nas 28 tabelas preexistentes que continuam no modelo foram conferidos por checksums antes/depois na mesma transação. A migração aborta se encontrar alteração.
As tabelas novas foram criadas vazias. A tabela de revisão estava vazia.
A vigência e as duas atribuições permanecem com seus mesmos identificadores e demais valores.
Os três registros completos anteriores à remoção das colunas legadas estão em preservacao_prd.estrutura_anterior_20261022, com RLS e sem acesso para public, anon, authenticated ou service_role. Essa área privada é uma diferença deliberada para atender à preservação dos dados da PRD.

## Verificações

- Simulação completa com rollback aprovada.
- Teste retirar_fluxo_revisao.sql aprovado após aplicação, com todos os dados sintéticos revertidos.
- Catálogos públicos comparados: tabelas, colunas, funções e ACLs de funções, constraints, índices, políticas, triggers e views iguais.
- Permissões de tabelas/sequências, privilégios padrão e comentários alinhados.
- Extensões e trigger de cadastro Auth iguais.
- Agendamentos cron iguais, incluindo comando, horário e estado ativo.
- Publicação Realtime da aplicação igual; partições internas da plataforma não são copiadas.
- Sete Edge Functions comparadas por conteúdo, preservando JWT. Cinco já coincidiam. acesso-filho-app e notificar-resposta-filho atualizadas com o código da DEV.
- Build de produção aprovado.
- Configurações gerenciadas de Auth, domínio, SMTP e secrets não foram copiadas nem certificadas como idênticas: são específicas do ambiente e não há ferramenta disponível nesta sessão para compará-las integralmente.
- Não foi feita publicação em loja nem teste em aparelho real.
