
-- Reforço estrutural do domínio de estrelas/recompensas.
-- O banco passa a garantir também as relações compostas de proprietário/filho/recompensa,
-- mantém concessões imutáveis e congela os snapshots do resgate.
-- "Hoje" e "Nesta vigência" continuam indicadores do FEZ atual; o total de estrelas é mérito permanente.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='t_filho_pai_id_uniq'
      and conrelid='public.t_filho'::regclass
  ) then
    alter table public.t_filho
      add constraint t_filho_pai_id_uniq unique (id_usuario_pai, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='t_recompensa_estrela_pai_filho_id_uniq'
      and conrelid='public.t_recompensa_estrela'::regclass
  ) then
    alter table public.t_recompensa_estrela
      add constraint t_recompensa_estrela_pai_filho_id_uniq
      unique (id_usuario_pai, id_filho, id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='t_estrela_concessao_same_pai_filho_fk'
      and conrelid='public.t_estrela_concessao'::regclass
  ) then
    alter table public.t_estrela_concessao
      add constraint t_estrela_concessao_same_pai_filho_fk
      foreign key (id_usuario_pai, id_filho)
      references public.t_filho(id_usuario_pai, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='t_recompensa_estrela_same_pai_filho_fk'
      and conrelid='public.t_recompensa_estrela'::regclass
  ) then
    alter table public.t_recompensa_estrela
      add constraint t_recompensa_estrela_same_pai_filho_fk
      foreign key (id_usuario_pai, id_filho)
      references public.t_filho(id_usuario_pai, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='t_recompensa_resgate_same_pai_filho_fk'
      and conrelid='public.t_recompensa_resgate'::regclass
  ) then
    alter table public.t_recompensa_resgate
      add constraint t_recompensa_resgate_same_pai_filho_fk
      foreign key (id_usuario_pai, id_filho)
      references public.t_filho(id_usuario_pai, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='t_recompensa_resgate_same_recompensa_fk'
      and conrelid='public.t_recompensa_resgate'::regclass
  ) then
    alter table public.t_recompensa_resgate
      add constraint t_recompensa_resgate_same_recompensa_fk
      foreign key (id_usuario_pai, id_filho, id_recompensa)
      references public.t_recompensa_estrela(id_usuario_pai, id_filho, id);
  end if;
end
$$;

alter table public.t_recompensa_resgate
  add column if not exists recompensa_descricao_no_resgate text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='t_recompensa_resgate_meta_compat_chk'
      and conrelid='public.t_recompensa_resgate'::regclass
  ) then
    alter table public.t_recompensa_resgate
      add constraint t_recompensa_resgate_meta_compat_chk
      check (
        meta_estrelas_no_resgate is null
        or meta_estrelas_no_resgate = estrelas_utilizadas
      );
  end if;
end
$$;

create index if not exists t_recompensa_resgate_recompensa_idx
  on public.t_recompensa_resgate(id_usuario_pai, id_filho, id_recompensa, created_at desc);

create or replace function public.proteger_concessao_estrela_imutavel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'Concessão de estrela é imutável';
end;
$function$;

drop trigger if exists trg_proteger_concessao_estrela_imutavel
  on public.t_estrela_concessao;

create trigger trg_proteger_concessao_estrela_imutavel
before update on public.t_estrela_concessao
for each row
execute function public.proteger_concessao_estrela_imutavel();

create or replace function public.proteger_resgate_estrela_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDENTE' then
      raise exception 'Novo resgate deve iniciar como PENDENTE';
    end if;

    if new.meta_estrelas_no_resgate is null
       or new.total_estrelas_no_resgate is null then
      raise exception 'Resgate exige snapshot da meta e do total de estrelas';
    end if;

    if new.estrelas_utilizadas <> new.meta_estrelas_no_resgate then
      raise exception 'Meta histórica do resgate inconsistente';
    end if;

    if new.entregue_em is not null or new.cancelado_em is not null then
      raise exception 'Novo resgate não pode nascer entregue ou cancelado';
    end if;

    return new;
  end if;

  if new.id_usuario_pai is distinct from old.id_usuario_pai
     or new.id_filho is distinct from old.id_filho
     or new.id_recompensa is distinct from old.id_recompensa
     or new.recompensa_nome is distinct from old.recompensa_nome
     or new.recompensa_descricao_no_resgate is distinct from old.recompensa_descricao_no_resgate
     or new.estrelas_utilizadas is distinct from old.estrelas_utilizadas
     or new.meta_estrelas_no_resgate is distinct from old.meta_estrelas_no_resgate
     or new.total_estrelas_no_resgate is distinct from old.total_estrelas_no_resgate
     or new.created_at is distinct from old.created_at then
    raise exception 'Snapshot do resgate é imutável';
  end if;

  if old.status <> 'PENDENTE' and new.status is distinct from old.status then
    raise exception 'Resgate finalizado não pode mudar de status';
  end if;

  if new.status = 'PENDENTE' then
    if new.entregue_em is not null or new.cancelado_em is not null then
      raise exception 'Resgate pendente não pode possuir data de entrega/cancelamento';
    end if;
  elsif new.status = 'ENTREGUE' then
    if new.entregue_em is null or new.cancelado_em is not null then
      raise exception 'Resgate entregue exige data de entrega e não pode estar cancelado';
    end if;
  elsif new.status = 'CANCELADO' then
    if new.cancelado_em is null or new.entregue_em is not null then
      raise exception 'Resgate cancelado exige data de cancelamento e não pode estar entregue';
    end if;
  else
    raise exception 'Status de resgate inválido';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_proteger_resgate_estrela_snapshot
  on public.t_recompensa_resgate;

create trigger trg_proteger_resgate_estrela_snapshot
before insert or update on public.t_recompensa_resgate
for each row
execute function public.proteger_resgate_estrela_snapshot();

create or replace function public.resgatar_recompensa_estrelas(
  p_id_recompensa bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_nome text;
  v_descricao text;
  v_meta integer;
  v_total integer;
  v_marco integer;
  v_progresso integer;
  v_resgate_id bigint;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select r.id_filho, r.nome, r.descricao, r.estrelas_necessarias
    into v_filho_id, v_nome, v_descricao, v_meta
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = v_pai_id
    and r.ativo = true;

  if v_filho_id is null then
    raise exception 'Recompensa não encontrada ou inativa';
  end if;

  perform 1
  from public.t_filho f
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id
  for update;

  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = v_pai_id
      and rr.id_filho = v_filho_id
      and rr.id_recompensa = p_id_recompensa
      and rr.status = 'PENDENTE'
  ) then
    raise exception 'Esta recompensa já possui um resgate aguardando entrega';
  end if;

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);

  select coalesce((
    select rr.total_estrelas_no_resgate
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = v_pai_id
      and rr.id_filho = v_filho_id
      and rr.id_recompensa = p_id_recompensa
      and rr.status = 'ENTREGUE'
      and rr.total_estrelas_no_resgate is not null
    order by rr.entregue_em desc nulls last, rr.id desc
    limit 1
  ), 0)
  into v_marco;

  v_progresso := greatest(v_total - v_marco, 0);

  if v_progresso < v_meta then
    raise exception 'Esta recompensa ainda não atingiu a quantidade necessária de estrelas';
  end if;

  insert into public.t_recompensa_resgate (
    id_usuario_pai,
    id_filho,
    id_recompensa,
    recompensa_nome,
    recompensa_descricao_no_resgate,
    estrelas_utilizadas,
    meta_estrelas_no_resgate,
    total_estrelas_no_resgate,
    status
  )
  values (
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    v_nome,
    v_descricao,
    v_meta,
    v_meta,
    v_total,
    'PENDENTE'
  )
  returning id into v_resgate_id;

  return v_resgate_id;
end;
$function$;

create or replace function public.resumo_estrelas_filho_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_total integer;
  v_hoje integer;
  v_vigencia_id bigint;
  v_vigencia integer;
  v_recompensas jsonb;
  v_resgates jsonb;
begin
  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  -- Indicador operacional: reflete o FEZ atual de hoje, não o mérito permanente.
  select count(*)::integer
    into v_hoje
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and o.tipo = 'FEZ'
    and timezone('America/Sao_Paulo', o.created_at)::date =
        timezone('America/Sao_Paulo', now())::date;

  select v.id
    into v_vigencia_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_id_usuario_pai
    and now() between v.data_inicio and v.data_fim
    and exists (
      select 1
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_filho = p_id_filho
        and ft.id_vigencia = v.id
    )
  order by v.data_inicio desc
  limit 1;

  -- Indicador operacional: reflete os FEZ atualmente marcados na vigência.
  if v_vigencia_id is null then
    v_vigencia := 0;
  else
    select count(*)::integer
      into v_vigencia
    from public.t_ocorrencia o
    join public.t_filho_tarefa ft
      on ft.id = o.id_filho_tarefa
     and ft.id_usuario_pai = o.id_usuario_pai
    where o.id_usuario_pai = p_id_usuario_pai
      and ft.id_filho = p_id_filho
      and ft.id_vigencia = v_vigencia_id
      and o.tipo = 'FEZ';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'nome', r.nome,
        'descricao', r.descricao,
        'estrelas_necessarias', r.estrelas_necessarias,
        'progresso', x.progresso,
        'faltam', greatest(r.estrelas_necessarias - x.progresso, 0),
        'disponivel', (not x.tem_pendente and x.progresso >= r.estrelas_necessarias),
        'pendente', x.tem_pendente,
        'marco_estrelas', x.marco_estrelas
      )
      order by r.estrelas_necessarias, r.nome
    ),
    '[]'::jsonb
  )
  into v_recompensas
  from public.t_recompensa_estrela r
  cross join lateral (
    select
      greatest(
        v_total - coalesce((
          select rr.total_estrelas_no_resgate
          from public.t_recompensa_resgate rr
          where rr.id_usuario_pai = p_id_usuario_pai
            and rr.id_filho = p_id_filho
            and rr.id_recompensa = r.id
            and rr.status = 'ENTREGUE'
            and rr.total_estrelas_no_resgate is not null
          order by rr.entregue_em desc nulls last, rr.id desc
          limit 1
        ), 0),
        0
      )::integer as progresso,
      coalesce((
        select rr.total_estrelas_no_resgate
        from public.t_recompensa_resgate rr
        where rr.id_usuario_pai = p_id_usuario_pai
          and rr.id_filho = p_id_filho
          and rr.id_recompensa = r.id
          and rr.status = 'ENTREGUE'
          and rr.total_estrelas_no_resgate is not null
        order by rr.entregue_em desc nulls last, rr.id desc
        limit 1
      ), 0)::integer as marco_estrelas,
      exists (
        select 1
        from public.t_recompensa_resgate rr
        where rr.id_usuario_pai = p_id_usuario_pai
          and rr.id_filho = p_id_filho
          and rr.id_recompensa = r.id
          and rr.status = 'PENDENTE'
      ) as tem_pendente
  ) x
  where r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho = p_id_filho
    and r.ativo = true;

  select coalesce(jsonb_agg(x.item order by x.ordem desc), '[]'::jsonb)
    into v_resgates
  from (
    select
      rr.created_at as ordem,
      jsonb_build_object(
        'id', rr.id,
        'id_recompensa', rr.id_recompensa,
        'recompensa_nome', rr.recompensa_nome,
        'recompensa_descricao_no_resgate', rr.recompensa_descricao_no_resgate,
        'estrelas_utilizadas', rr.estrelas_utilizadas,
        'meta_estrelas_no_resgate', coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'total_estrelas_no_resgate', rr.total_estrelas_no_resgate,
        'status', rr.status,
        'created_at', rr.created_at,
        'entregue_em', rr.entregue_em,
        'cancelado_em', rr.cancelado_em
      ) as item
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
    order by rr.created_at desc
    limit 20
  ) x;

  return jsonb_build_object(
    'hoje', v_hoje,
    'vigencia_atual', v_vigencia,
    'saldo', v_total,
    'total_conquistado', v_total,
    'recompensas', v_recompensas,
    'resgates', v_resgates
  );
end;
$function$;

comment on table public.t_estrela_concessao is
'Livro razão de mérito permanente. Uma concessão por responsável/filho/vigência/tarefa/data. Não referencia tarefa, vigência, atribuição ou ocorrência por FK para preservar o mérito quando essas entidades operacionais forem excluídas; somente o filho é o dono do mérito e sua exclusão remove as concessões por CASCADE.';

comment on column public.t_estrela_concessao.id_vigencia is
'Identificador histórico da vigência de origem; intencionalmente sem FK para sobreviver à exclusão da vigência.';

comment on column public.t_estrela_concessao.id_tarefa is
'Identificador histórico da tarefa de origem; intencionalmente sem FK para sobreviver à exclusão da tarefa.';

comment on column public.t_estrela_concessao.id_filho_tarefa_origem is
'Identificador histórico da atribuição de origem; intencionalmente sem FK para sobreviver à exclusão da atribuição.';

comment on column public.t_estrela_concessao.id_ocorrencia_origem is
'Identificador histórico da ocorrência que primeiro concedeu o mérito; intencionalmente sem FK para sobreviver ao desfazer/excluir da ocorrência.';

revoke all on function public.proteger_concessao_estrela_imutavel()
from public, anon, authenticated, service_role;

revoke all on function public.proteger_resgate_estrela_snapshot()
from public, anon, authenticated, service_role;
