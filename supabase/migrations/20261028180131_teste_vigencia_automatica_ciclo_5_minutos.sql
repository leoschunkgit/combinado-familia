-- TEMPORARIO DEV
-- Encurta o ciclo automatico para 5 minutos apenas para validar renovacao.
-- Restaurar a regra de fim do mes as 23:59 apos os testes.

create or replace function private.vigencia_automatica_fim_periodo(
  p_inicio timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select p_inicio + interval '5 minutes' - interval '1 minute'
$function$;

comment on function private.vigencia_automatica_fim_periodo(timestamptz) is
  'TEMPORARIO DEV: ciclo automatico de 5 minutos para teste de renovacao. Restaurar para fim do mes 23:59 apos os testes.';
