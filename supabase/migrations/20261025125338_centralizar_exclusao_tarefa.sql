alter table public.t_tarefa
  add column if not exists ativo boolean not null default true,
  add column if not exists arquivada_em timestamptz null;

update public.t_tarefa
set ativo = true
where ativo is null;

create index if not exists t_tarefa_ativas_pai_nome_idx
  on public.t_tarefa (id_usuario_pai, nome)
  where ativo = true;

create or replace function public.tarefa_tem_historico_interno(
  p_id_usuario_pai bigint,
  p_id_tarefa bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.t_filho_tarefa ft
      join public.t_ocorrencia o
        on o.id_filho_tarefa = ft.id
       and o.id_usuario_pai = ft.id_usuario_pai
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_tarefa = p_id_tarefa
    )
    or exists (
      select 1
      from public.t_filho_tarefa ft
      join public.t_solicitacao_tarefa_filho s
        on s.id_filho_tarefa = ft.id
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_tarefa = p_id_tarefa
    )
    or exists (
      select 1
      from public.t_estrela_concessao ec
      where ec.id_usuario_pai = p_id_usuario_pai
        and ec.id_tarefa = p_id_tarefa
    )
    or exists (
      select 1
      from public.t_estrela_movimento em
      where em.id_usuario_pai = p_id_usuario_pai
        and em.id_tarefa = p_id_tarefa
    )
    or exists (
      select 1
      from public.t_ocorrencia_reconciliacao r
      join public.t_filho_tarefa ft
        on ft.id = r.id_filho_tarefa
       and ft.id_usuario_pai = r.id_usuario_pai
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_tarefa = p_id_tarefa
    );
$function$;

revoke all on function public.tarefa_tem_historico_interno(bigint,bigint)
from public, anon, authenticated, service_role;

create or replace function public.proteger_estado_tarefa_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_autorizada boolean;
begin
  v_autorizada :=
    coalesce(current_setting('app.remocao_tarefa_autorizada', true), '') = '1';

  if old.ativo = false then
    raise exception 'Tarefa arquivada é histórica e não pode ser alterada';
  end if;

  if new.ativo is distinct from old.ativo
     or new.arquivada_em is distinct from old.arquivada_em then
    if not v_autorizada then
      raise exception 'Use a regra central de exclusão para remover uma tarefa';
    end if;
  end if;

  if new.ativo = true and new.arquivada_em is not null then
    raise exception 'Tarefa ativa não pode possuir data de arquivamento';
  end if;

  if new.ativo = false and new.arquivada_em is null then
    raise exception 'Tarefa inativa exige data de arquivamento';
  end if;

  return new;
end;
$function$;

revoke all on function public.proteger_estado_tarefa_interno()
from public, anon, authenticated, service_role;

drop trigger if exists proteger_estado_tarefa_before_update on public.t_tarefa;
create trigger proteger_estado_tarefa_before_update
before update on public.t_tarefa
for each row
execute function public.proteger_estado_tarefa_interno();

create or replace function public.proteger_exclusao_tarefa_direta_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if coalesce(current_setting('app.remocao_tarefa_autorizada', true), '') <> '1' then
    raise exception 'Use a regra central de exclusão para remover uma tarefa';
  end if;

  return old;
end;
$function$;

revoke all on function public.proteger_exclusao_tarefa_direta_interno()
from public, anon, authenticated, service_role;

drop trigger if exists proteger_exclusao_tarefa_before_delete on public.t_tarefa;
create trigger proteger_exclusao_tarefa_before_delete
before delete on public.t_tarefa
for each row
execute function public.proteger_exclusao_tarefa_direta_interno();

create or replace function public.validar_tarefa_ativa_atribuicao_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ativa boolean;
begin
  select t.ativo
    into v_ativa
  from public.t_tarefa t
  where t.id = new.id_tarefa
    and t.id_usuario_pai = new.id_usuario_pai;

  if v_ativa is distinct from true then
    raise exception 'Tarefa inativa não pode receber novas atribuições';
  end if;

  return new;
end;
$function$;

revoke all on function public.validar_tarefa_ativa_atribuicao_interno()
from public, anon, authenticated, service_role;

drop trigger if exists validar_tarefa_ativa_atribuicao_before_change
on public.t_filho_tarefa;

create trigger validar_tarefa_ativa_atribuicao_before_change
before insert or update of id_tarefa
on public.t_filho_tarefa
for each row
execute function public.validar_tarefa_ativa_atribuicao_interno();

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

  perform set_config('app.remocao_tarefa_autorizada', '1', true);

  if not v_tem_historico then
    delete from public.t_tarefa t
    where t.id = p_id_tarefa
      and t.id_usuario_pai = p_id_usuario_pai;

    return 'EXCLUIDA';
  end if;

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

  update public.t_tarefa
  set ativo = false,
      arquivada_em = now()
  where id = p_id_tarefa
    and id_usuario_pai = p_id_usuario_pai;

  return 'ARQUIVADA';
end;
$function$;

revoke all on function public.remover_tarefa_interno(bigint,bigint)
from public, anon, authenticated, service_role;

create or replace function public.remover_tarefa_com_regra(
  p_id_tarefa bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  return public.remover_tarefa_interno(v_pai_id, p_id_tarefa);
end;
$function$;

revoke all on function public.remover_tarefa_com_regra(bigint)
from public, anon, authenticated, service_role;
grant execute on function public.remover_tarefa_com_regra(bigint)
to authenticated;

create or replace function public.remover_todas_tarefas_com_regra()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_id_tarefa bigint;
  v_resultado text;
  v_excluidas integer := 0;
  v_arquivadas integer := 0;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  for v_id_tarefa in
    select t.id
    from public.t_tarefa t
    where t.id_usuario_pai = v_pai_id
      and t.ativo = true
    order by t.id
  loop
    v_resultado := public.remover_tarefa_interno(v_pai_id, v_id_tarefa);

    if v_resultado = 'EXCLUIDA' then
      v_excluidas := v_excluidas + 1;
    else
      v_arquivadas := v_arquivadas + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'excluidas', v_excluidas,
    'arquivadas', v_arquivadas
  );
end;
$function$;

revoke all on function public.remover_todas_tarefas_com_regra()
from public, anon, authenticated, service_role;
grant execute on function public.remover_todas_tarefas_com_regra()
to authenticated;

create or replace function public.duplicar_vigencia_com_atribuicoes(
  p_modelo_id bigint,
  p_data_inicio timestamp with time zone,
  p_data_fim timestamp with time zone
)
returns table(id_vigencia bigint, qtd_atribuicoes integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_modelo_fim timestamptz;
  v_nova_id bigint;
  v_qtd integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select v.data_fim into v_modelo_fim
  from public.t_vigencia v
  where v.id = p_modelo_id
    and v.id_usuario_pai = v_pai_id;

  if v_modelo_fim is null then
    raise exception 'Vigência modelo não encontrada';
  end if;

  if p_data_fim <= p_data_inicio then
    raise exception 'A data/hora fim deve ser posterior à data/hora início';
  end if;

  if p_data_inicio <= v_modelo_fim then
    raise exception 'A nova vigência deve começar depois do término da vigência modelo';
  end if;

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    v_pai_id, p_data_inicio, p_data_fim
  )
  returning id into v_nova_id;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_vigencia, id_filho, id_tarefa
  )
  select
    v_pai_id, v_nova_id, ft.id_filho, ft.id_tarefa
  from public.t_filho_tarefa ft
  join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
   and t.ativo = true
  where ft.id_usuario_pai = v_pai_id
    and ft.id_vigencia = p_modelo_id;

  get diagnostics v_qtd = row_count;
  return query select v_nova_id, v_qtd;
end;
$function$;

revoke all on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamptz,timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamptz,timestamptz)
to authenticated;

comment on column public.t_tarefa.ativo is
'Define se a tarefa está disponível para operações novas. Tarefas históricas excluídas pelo usuário permanecem com ativo=false.';

comment on column public.t_tarefa.arquivada_em is
'Data da exclusão lógica de uma tarefa que possui histórico.';

comment on function public.remover_tarefa_com_regra(bigint) is
'Regra central de remoção de tarefa: exclui fisicamente quando não há histórico e arquiva quando há histórico.';

comment on function public.remover_todas_tarefas_com_regra() is
'Aplica a mesma regra central de remoção a todas as tarefas ativas do responsável.';
