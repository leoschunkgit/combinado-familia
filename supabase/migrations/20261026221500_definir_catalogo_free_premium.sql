-- Catálogo de direitos comerciais FREE x PREMIUM.
-- Fase 2: apenas definição central de direitos. Nenhuma trava do app é aplicada aqui.
-- Convenção: -1 em recursos LIMITE_INTEIRO significa ilimitado.

insert into billing.recurso (codigo, nome, descricao, tipo, ativo)
values
  ('FILHOS.LIMITE', 'Limite de filhos', 'Quantidade máxima de filhos cadastrados na conta. -1 significa ilimitado.', 'LIMITE_INTEIRO', true),
  ('RECOMPENSAS.LIMITE', 'Limite de recompensas', 'Quantidade máxima de recompensas cadastradas na conta. -1 significa ilimitado.', 'LIMITE_INTEIRO', true),
  ('TAREFAS.LIMITE', 'Limite de tarefas', 'Quantidade máxima de tarefas cadastradas na conta. -1 significa ilimitado.', 'LIMITE_INTEIRO', true),
  ('VIGENCIAS.HABILITADA', 'Vigências habilitadas', 'Permite criar e utilizar vigências. Recurso essencial ao funcionamento do app.', 'BOOLEANO', true),
  ('VIGENCIAS.CLONAR', 'Clonar vigência', 'Permite clonar/duplicar uma vigência existente.', 'BOOLEANO', true),
  ('APP_FILHO.TERMINEI', 'Terminei no app do filho', 'Permite ao filho informar pelo app que concluiu uma tarefa.', 'BOOLEANO', true),
  ('MESADA.HABILITADA', 'Mesada', 'Permite definir e utilizar mesada para filhos.', 'BOOLEANO', true),
  ('HISTORICO.PDF', 'PDF do histórico', 'Permite gerar PDF do histórico.', 'BOOLEANO', true),
  ('APP_FILHO.ACESSOS.LIMITE', 'Limite de acessos do app do filho', 'Quantidade máxima de acessos do app do filho permitidos por conta. -1 significa ilimitado.', 'LIMITE_INTEIRO', true),
  ('TAREFAS.SUGESTOES', 'Sugestões de tarefas', 'Permite utilizar sugestões de tarefas no cadastro.', 'BOOLEANO', true)
on conflict (codigo) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    tipo = excluded.tipo,
    ativo = excluded.ativo,
    updated_at = now();

with valores(codigo_plano, codigo_recurso, valor) as (
  values
    ('FREE',    'FILHOS.LIMITE',             '1'::jsonb),
    ('FREE',    'RECOMPENSAS.LIMITE',        '1'::jsonb),
    ('FREE',    'TAREFAS.LIMITE',            '3'::jsonb),
    ('FREE',    'VIGENCIAS.HABILITADA',       'true'::jsonb),
    ('FREE',    'VIGENCIAS.CLONAR',           'false'::jsonb),
    ('FREE',    'APP_FILHO.TERMINEI',         'false'::jsonb),
    ('FREE',    'MESADA.HABILITADA',          'false'::jsonb),
    ('FREE',    'HISTORICO.PDF',              'false'::jsonb),
    ('FREE',    'APP_FILHO.ACESSOS.LIMITE',   '1'::jsonb),
    ('FREE',    'TAREFAS.SUGESTOES',          'false'::jsonb),

    ('PREMIUM', 'FILHOS.LIMITE',             '-1'::jsonb),
    ('PREMIUM', 'RECOMPENSAS.LIMITE',        '-1'::jsonb),
    ('PREMIUM', 'TAREFAS.LIMITE',            '-1'::jsonb),
    ('PREMIUM', 'VIGENCIAS.HABILITADA',       'true'::jsonb),
    ('PREMIUM', 'VIGENCIAS.CLONAR',           'true'::jsonb),
    ('PREMIUM', 'APP_FILHO.TERMINEI',         'true'::jsonb),
    ('PREMIUM', 'MESADA.HABILITADA',          'true'::jsonb),
    ('PREMIUM', 'HISTORICO.PDF',              'true'::jsonb),
    ('PREMIUM', 'APP_FILHO.ACESSOS.LIMITE',   '-1'::jsonb),
    ('PREMIUM', 'TAREFAS.SUGESTOES',          'true'::jsonb)
)
insert into billing.plano_recurso (id_plano, id_recurso, valor)
select p.id, r.id, v.valor
from valores v
join billing.plano p on p.codigo = v.codigo_plano
join billing.recurso r on r.codigo = v.codigo_recurso
on conflict (id_plano, id_recurso) do update
set valor = excluded.valor,
    updated_at = now();
