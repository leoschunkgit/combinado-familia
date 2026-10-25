
create or replace function public.validar_nova_tarefa_ativa_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.ativo is distinct from true or new.arquivada_em is not null then
    raise exception 'Nova tarefa deve iniciar ativa';
  end if;

  return new;
end;
$function$;

revoke all on function public.validar_nova_tarefa_ativa_interno()
from public, anon, authenticated, service_role;

drop trigger if exists validar_nova_tarefa_ativa_before_insert
on public.t_tarefa;

create trigger validar_nova_tarefa_ativa_before_insert
before insert on public.t_tarefa
for each row
execute function public.validar_nova_tarefa_ativa_interno();

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
    and t.id_usuario_pai = new.id_usuario_pai
  for share;

  if v_ativa is distinct from true then
    raise exception 'Tarefa inativa não pode receber novas atribuições';
  end if;

  return new;
end;
$function$;

revoke all on function public.validar_tarefa_ativa_atribuicao_interno()
from public, anon, authenticated, service_role;

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

  -- Serializa a remoção com novas ocorrências/solicitações ligadas às atribuições.
  -- Inserts dependentes precisam manter a atribuição existente via FK.
  perform 1
  from public.t_filho_tarefa ft
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_tarefa = p_id_tarefa
  for update;

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

do $migration$
declare
  v_ddl text;
  v_novo text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_resumo'
  order by p.oid desc
  limit 1;

  v_novo := replace(
    v_ddl,
    '''tarefas'', (SELECT count(*) FROM public.t_tarefa),',
    '''tarefas'', (SELECT count(*) FROM public.t_tarefa WHERE ativo = true),'
  );

  if v_novo = v_ddl then
    raise exception 'Não foi possível ajustar admin_resumo para tarefas ativas';
  end if;

  execute v_novo;

  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_usuarios'
  order by p.oid desc
  limit 1;

  v_novo := replace(
    v_ddl,
    E'    FROM public.t_tarefa t\n    GROUP BY t.id_usuario_pai',
    E'    FROM public.t_tarefa t\n    WHERE t.ativo = true\n    GROUP BY t.id_usuario_pai'
  );

  if v_novo = v_ddl then
    raise exception 'Não foi possível ajustar admin_usuarios para tarefas ativas';
  end if;

  execute v_novo;

  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_diagnostico'
  order by p.oid desc
  limit 1;

  v_novo := replace(
    v_ddl,
    E'        FROM public.t_tarefa t\n      ),',
    E'        FROM public.t_tarefa t\n        WHERE t.ativo = true\n      ),'
  );

  if v_novo = v_ddl then
    raise exception 'Não foi possível ajustar admin_diagnostico para tarefas ativas';
  end if;

  execute v_novo;
end;
$migration$;
