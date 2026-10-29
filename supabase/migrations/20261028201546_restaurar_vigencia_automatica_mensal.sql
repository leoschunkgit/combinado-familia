-- Restaura a regra definitiva da vigência automática após os testes de ciclo curto no DEV.
-- Ciclos automáticos passam a terminar no último instante do mês em America/Sao_Paulo.
-- Vigências ADOTADAS preservam as datas originais; apenas ciclos automáticos ativos
-- criados pela automação são estendidos para a regra mensal.

create or replace function private.vigencia_automatica_fim_periodo(
  p_inicio timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_inicio_local timestamp without time zone;
  v_fim_local timestamp without time zone;
  v_fim timestamptz;
begin
  v_inicio_local := timezone('America/Sao_Paulo', p_inicio);

  v_fim_local :=
    date_trunc('month', v_inicio_local)
    + interval '1 month'
    - interval '1 microsecond';

  v_fim := v_fim_local at time zone 'America/Sao_Paulo';

  if v_fim <= p_inicio then
    v_fim_local :=
      date_trunc('month', v_inicio_local)
      + interval '2 months'
      - interval '1 microsecond';

    v_fim := v_fim_local at time zone 'America/Sao_Paulo';
  end if;

  return v_fim;
end;
$function$;

comment on function private.vigencia_automatica_fim_periodo(timestamptz) is
  'Regra definitiva: vigencia automatica termina no ultimo instante do mes, considerando America/Sao_Paulo.';

with candidatos as (
  select
    v.id,
    private.vigencia_automatica_fim_periodo(v.data_inicio) as novo_fim
  from public.t_vigencia v
  join private.t_vigencia_automacao_ciclo c
    on c.id_vigencia = v.id
  where c.origem in ('INICIAL', 'RENOVACAO')
    and statement_timestamp() between v.data_inicio and v.data_fim
),
seguros as (
  select c.*
  from candidatos c
  where not exists (
    select 1
    from public.t_vigencia f
    join public.t_vigencia atual on atual.id = c.id
    where f.id_usuario_pai = atual.id_usuario_pai
      and f.id <> atual.id
      and f.data_inicio <= c.novo_fim
      and f.data_fim >= atual.data_fim
      and f.data_inicio > atual.data_fim
  )
)
update public.t_vigencia v
set data_fim = s.novo_fim
from seguros s
where v.id = s.id
  and v.data_fim < s.novo_fim;
