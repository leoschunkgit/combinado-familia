
create or replace function public.remover_tarefa_interno(
  p_id_usuario_pai bigint,
  p_id_tarefa bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ativa boolean;
  v_tem_historico boolean;
  v_flag_anterior text;
begin
  select t.ativo
    into v_ativa
  from public.t_tarefa t
  where t.id = p_id_tarefa
    and t.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  if v_ativa = false then
    return 'ARQUIVADA';
  end if;

  v_tem_historico :=
    public.tarefa_tem_historico_interno(p_id_usuario_pai, p_id_tarefa);

  if not v_tem_historico then
    v_flag_anterior :=
      coalesce(current_setting('app.remocao_tarefa_autorizada', true), '');

    perform set_config('app.remocao_tarefa_autorizada', '1', true);

    delete from public.t_tarefa t
    where t.id = p_id_tarefa
      and t.id_usuario_pai = p_id_usuario_pai;

    perform set_config(
      'app.remocao_tarefa_autorizada',
      v_flag_anterior,
      true
    );

    return 'EXCLUIDA';
  end if;

  -- A tarefa sai da vida futura, mas vínculos atuais e históricos permanecem.
  -- Atribuições futuras vazias podem ser descartadas, pois ainda não viraram fato.
  delete from public.t_filho_tarefa ft
  using public.t_vigencia v
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_tarefa = p_id_tarefa
    and v.id = ft.id_vigencia
    and v.id_usuario_pai = ft.id_usuario_pai
    and v.data_inicio > now()
    and not exists (
      select 1
      from public.t_ocorrencia o
      where o.id_filho_tarefa = ft.id
        and o.id_usuario_pai = ft.id_usuario_pai
    )
    and not exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = ft.id
    );

  v_flag_anterior :=
    coalesce(current_setting('app.remocao_tarefa_autorizada', true), '');

  perform set_config('app.remocao_tarefa_autorizada', '1', true);

  update public.t_tarefa
  set ativo = false,
      arquivada_em = now()
  where id = p_id_tarefa
    and id_usuario_pai = p_id_usuario_pai;

  perform set_config(
    'app.remocao_tarefa_autorizada',
    v_flag_anterior,
    true
  );

  return 'ARQUIVADA';
end;
$function$;

revoke all on function public.remover_tarefa_interno(bigint,bigint)
from public, anon, authenticated, service_role;
