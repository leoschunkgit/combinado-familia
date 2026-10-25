-- 0074 - Encerrar revisao quando o Nao fez que a originou for desfeito.
--
-- A revisao ja possui ciclo proprio. Esta migration fecha a lacuna em que
-- desfazer o NAO_FEZ deixava uma revisao PENDENTE sem ocorrencia para decidir.

alter table public.t_revisao_tarefa_filho
  drop constraint if exists t_revisao_tarefa_filho_status_chk;

alter table public.t_revisao_tarefa_filho
  add constraint t_revisao_tarefa_filho_status_chk
  check (
    status in (
      'PENDENTE',
      'MANTEVE_NAO_FEZ',
      'ALTERADO_PARA_FEZ',
      'MARCACAO_DESFEITA'
    )
  );

comment on column public.t_revisao_tarefa_filho.status is
  'Ciclo da revisao: PENDENTE, MANTEVE_NAO_FEZ, ALTERADO_PARA_FEZ ou MARCACAO_DESFEITA.';

create or replace function public.encerrar_revisao_ao_desfazer_marcacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_data_antiga date;
  v_data_nova date;
begin
  if old.tipo <> 'NAO_FEZ' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_data_antiga := timezone('America/Sao_Paulo', old.created_at)::date;

  if tg_op = 'UPDATE' then
    v_data_nova := timezone('America/Sao_Paulo', new.created_at)::date;

    -- NAO_FEZ -> FEZ na mesma tarefa/data e tratado pela regra existente
    -- resolver_revisao_ao_marcar_fez, que grava ALTERADO_PARA_FEZ.
    if new.tipo = 'FEZ'
       and new.id_filho_tarefa = old.id_filho_tarefa
       and v_data_nova = v_data_antiga then
      return new;
    end if;

    -- Se o mesmo NAO_FEZ continua na mesma chave, a revisao segue pendente.
    if new.tipo = 'NAO_FEZ'
       and new.id_filho_tarefa = old.id_filho_tarefa
       and v_data_nova = v_data_antiga then
      return new;
    end if;
  end if;

  update public.t_revisao_tarefa_filho r
  set
    status = 'MARCACAO_DESFEITA',
    resolvido_em = now()
  where r.id_filho_tarefa = old.id_filho_tarefa
    and r.data_referencia = v_data_antiga
    and r.status = 'PENDENTE';

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

revoke all on function public.encerrar_revisao_ao_desfazer_marcacao()
from public, anon, authenticated, service_role;

drop trigger if exists encerrar_revisao_ao_desfazer_marcacao
on public.t_ocorrencia;

create trigger encerrar_revisao_ao_desfazer_marcacao
after delete or update of tipo, id_filho_tarefa, created_at
on public.t_ocorrencia
for each row
execute function public.encerrar_revisao_ao_desfazer_marcacao();
