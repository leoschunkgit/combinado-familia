
create table if not exists public.t_filho_acesso_app_tentativa (
  identificador_hash text primary key,
  janela_inicio timestamptz not null default now(),
  falhas integer not null default 0,
  bloqueado_ate timestamptz null,
  updated_at timestamptz not null default now(),
  constraint t_filho_acesso_app_tentativa_falhas_chk check (falhas >= 0),
  constraint t_filho_acesso_app_tentativa_hash_chk check (char_length(identificador_hash) between 32 and 128)
);

alter table public.t_filho_acesso_app_tentativa enable row level security;

revoke all on public.t_filho_acesso_app_tentativa from public, anon, authenticated;
revoke all on public.t_filho_acesso_app_chave from public, anon, authenticated;
revoke all on public.t_filho_acesso_app from public, anon, authenticated;

create or replace function public.montar_painel_filho(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'responsavel', jsonb_build_object('nome', p.nome),
    'filho', jsonb_build_object(
      'nome', f.nome,
      'cor', f.cor,
      'avatar', f.avatar,
      'tem_mesada', coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
      'valor_mesada', f.valor_mesada
    ),
    'vigencias', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'data_inicio', v.data_inicio,
          'data_fim', v.data_fim,
          'penalidade', v.penalidade,
          'qtd_ocorrencia', v.qtd_ocorrencia,
          'valor_debito', v.valor_debito,
          'tarefas', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ft.id,
                'nome', t.nome,
                'ocorrencias', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'tipo', o.tipo,
                      'data', o.created_at,
                      'bonificacao_tipo', o.bonificacao_tipo,
                      'bonificacao_descricao', o.bonificacao_descricao,
                      'bonificacao_valor', o.bonificacao_valor
                    )
                    order by o.created_at desc
                  )
                  from public.t_ocorrencia o
                  where o.id_filho_tarefa = ft.id
                    and o.id_usuario_pai = p_id_usuario_pai
                ), '[]'::jsonb)
              )
              order by t.nome
            )
            from public.t_filho_tarefa ft
            join public.t_tarefa t
              on t.id = ft.id_tarefa
             and t.id_usuario_pai = p_id_usuario_pai
            where ft.id_vigencia = v.id
              and ft.id_filho = p_id_filho
              and ft.id_usuario_pai = p_id_usuario_pai
          ), '[]'::jsonb)
        )
        order by
          case
            when now() between v.data_inicio and v.data_fim then 0
            when now() < v.data_inicio then 1
            else 2
          end,
          case when now() < v.data_inicio then v.data_inicio end asc,
          case when now() > v.data_fim then v.data_inicio end desc,
          v.data_inicio asc
      )
      from public.t_vigencia v
      where v.id_usuario_pai = p_id_usuario_pai
        and exists (
          select 1
          from public.t_filho_tarefa ft
          where ft.id_vigencia = v.id
            and ft.id_filho = p_id_filho
            and ft.id_usuario_pai = p_id_usuario_pai
        )
    ), '[]'::jsonb),
    'atualizado_em', now()
  )
  into v_result
  from public.t_filho f
  join public.t_usuario_pai p on p.id = p_id_usuario_pai
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai;

  return v_result;
end;
$function$;

revoke all on function public.montar_painel_filho(bigint,bigint) from public, anon, authenticated, service_role;

create or replace function public.obter_painel_publico_filho(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
begin
  select a.id_usuario_pai, a.id_filho
    into v_pai_id, v_filho_id
  from public.t_filho_acesso_publico a
  join public.t_filho f
    on f.id = a.id_filho
   and f.id_usuario_pai = a.id_usuario_pai
  where a.token = p_token
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return null;
  end if;

  return public.montar_painel_filho(v_pai_id, v_filho_id);
end;
$function$;

revoke all on function public.obter_painel_publico_filho(uuid) from public;
grant execute on function public.obter_painel_publico_filho(uuid) to anon, authenticated;

create or replace function public.gerar_chave_acesso_app_filho(p_id_filho bigint)
returns table(chave text, expira_em timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_codigo text;
  v_expira timestamptz := now() + interval '15 minutes';
  v_tentativa integer := 0;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Filho não encontrado para este responsável';
  end if;

  update public.t_filho_acesso_app_chave
  set ativo = false,
      updated_at = now()
  where id_usuario_pai = v_pai_id
    and id_filho = p_id_filho
    and ativo = true;

  loop
    v_tentativa := v_tentativa + 1;
    v_codigo := lpad(
      (((('x' || substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000))::text,
      6,
      '0'
    );

    exit when not exists (
      select 1
      from public.t_filho_acesso_app_chave a
      where a.ativo = true
        and a.usado_em is null
        and a.expira_em > now()
        and extensions.crypt(v_codigo, a.chave_hash) = a.chave_hash
    );

    if v_tentativa >= 20 then
      raise exception 'Não foi possível gerar uma chave única. Tente novamente.';
    end if;
  end loop;

  insert into public.t_filho_acesso_app_chave (
    id_usuario_pai,
    id_filho,
    chave_hash,
    expira_em,
    ativo
  )
  values (
    v_pai_id,
    p_id_filho,
    extensions.crypt(v_codigo, extensions.gen_salt('bf', 10)),
    v_expira,
    true
  );

  return query select v_codigo, v_expira;
end;
$function$;

revoke all on function public.gerar_chave_acesso_app_filho(bigint) from public, anon;
grant execute on function public.gerar_chave_acesso_app_filho(bigint) to authenticated;

create or replace function public.listar_acessos_app_filho(p_id_filho bigint)
returns table(
  id bigint,
  dispositivo_id uuid,
  dispositivo_nome text,
  ativo boolean,
  ultimo_acesso_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Filho não encontrado para este responsável';
  end if;

  return query
  select
    a.id,
    a.dispositivo_id,
    a.dispositivo_nome,
    a.ativo,
    a.ultimo_acesso_em,
    a.revogado_em,
    a.created_at
  from public.t_filho_acesso_app a
  where a.id_usuario_pai = v_pai_id
    and a.id_filho = p_id_filho
  order by a.ativo desc, coalesce(a.ultimo_acesso_em, a.created_at) desc;
end;
$function$;

revoke all on function public.listar_acessos_app_filho(bigint) from public, anon;
grant execute on function public.listar_acessos_app_filho(bigint) to authenticated;

create or replace function public.revogar_acesso_app_filho(p_id_acesso bigint)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_count integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  update public.t_filho_acesso_app
  set ativo = false,
      revogado_em = coalesce(revogado_em, now()),
      updated_at = now()
  where id = p_id_acesso
    and id_usuario_pai = v_pai_id
    and ativo = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.revogar_acesso_app_filho(bigint) from public, anon;
grant execute on function public.revogar_acesso_app_filho(bigint) to authenticated;

create or replace function public.revogar_todos_acessos_app_filho(p_id_filho bigint)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_count integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Filho não encontrado para este responsável';
  end if;

  update public.t_filho_acesso_app
  set ativo = false,
      revogado_em = coalesce(revogado_em, now()),
      updated_at = now()
  where id_usuario_pai = v_pai_id
    and id_filho = p_id_filho
    and ativo = true;

  get diagnostics v_count = row_count;

  update public.t_filho_acesso_app_chave
  set ativo = false,
      updated_at = now()
  where id_usuario_pai = v_pai_id
    and id_filho = p_id_filho
    and ativo = true;

  return v_count;
end;
$function$;

revoke all on function public.revogar_todos_acessos_app_filho(bigint) from public, anon;
grant execute on function public.revogar_todos_acessos_app_filho(bigint) to authenticated;

create or replace function public.parear_acesso_app_filho_interno(
  p_chave text,
  p_dispositivo_nome text,
  p_ip_hash text,
  p_cliente_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ident text;
  v_rate public.t_filho_acesso_app_tentativa%rowtype;
  v_chave_id bigint;
  v_pai_id bigint;
  v_filho_id bigint;
  v_token text;
  v_token_hash text;
  v_dispositivo_id uuid;
  v_nome text;
  v_agora timestamptz := now();
  v_novas_falhas integer;
  v_bloqueado_ate timestamptz;
begin
  if p_chave is null or p_chave !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'codigo', 'CHAVE_INVALIDA');
  end if;

  if p_ip_hash is null or char_length(p_ip_hash) <> 64
     or p_cliente_hash is null or char_length(p_cliente_hash) <> 64 then
    return jsonb_build_object('ok', false, 'codigo', 'REQUISICAO_INVALIDA');
  end if;

  foreach v_ident in array array[p_ip_hash, p_cliente_hash]
  loop
    select *
      into v_rate
    from public.t_filho_acesso_app_tentativa
    where identificador_hash = v_ident
    for update;

    if found and v_rate.bloqueado_ate is not null and v_rate.bloqueado_ate > v_agora then
      return jsonb_build_object(
        'ok', false,
        'codigo', 'BLOQUEADO',
        'tentar_em_segundos', greatest(1, ceil(extract(epoch from (v_rate.bloqueado_ate - v_agora)))::integer)
      );
    end if;
  end loop;

  select a.id, a.id_usuario_pai, a.id_filho
    into v_chave_id, v_pai_id, v_filho_id
  from public.t_filho_acesso_app_chave a
  join public.t_filho f
    on f.id = a.id_filho
   and f.id_usuario_pai = a.id_usuario_pai
  where a.ativo = true
    and a.usado_em is null
    and a.expira_em > v_agora
    and extensions.crypt(p_chave, a.chave_hash) = a.chave_hash
  order by a.created_at desc
  limit 1
  for update of a;

  if v_chave_id is null then
    foreach v_ident in array array[p_ip_hash, p_cliente_hash]
    loop
      select *
        into v_rate
      from public.t_filho_acesso_app_tentativa
      where identificador_hash = v_ident
      for update;

      if not found or v_rate.janela_inicio < v_agora - interval '15 minutes' then
        v_novas_falhas := 1;
        v_bloqueado_ate := null;

        insert into public.t_filho_acesso_app_tentativa (
          identificador_hash, janela_inicio, falhas, bloqueado_ate, updated_at
        )
        values (
          v_ident, v_agora, v_novas_falhas, v_bloqueado_ate, v_agora
        )
        on conflict (identificador_hash) do update
        set janela_inicio = excluded.janela_inicio,
            falhas = excluded.falhas,
            bloqueado_ate = excluded.bloqueado_ate,
            updated_at = excluded.updated_at;
      else
        v_novas_falhas := v_rate.falhas + 1;
        v_bloqueado_ate := case
          when v_novas_falhas >= 5 then v_agora + interval '30 minutes'
          else null
        end;

        update public.t_filho_acesso_app_tentativa
        set falhas = v_novas_falhas,
            bloqueado_ate = v_bloqueado_ate,
            updated_at = v_agora
        where identificador_hash = v_ident;
      end if;
    end loop;

    if v_novas_falhas >= 5 then
      return jsonb_build_object('ok', false, 'codigo', 'BLOQUEADO', 'tentar_em_segundos', 1800);
    end if;

    return jsonb_build_object('ok', false, 'codigo', 'CHAVE_INVALIDA');
  end if;

  update public.t_filho_acesso_app_chave
  set ativo = false,
      usado_em = v_agora,
      updated_at = v_agora
  where id = v_chave_id;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_nome := nullif(left(trim(coalesce(p_dispositivo_nome, '')), 120), '');

  insert into public.t_filho_acesso_app (
    id_usuario_pai,
    id_filho,
    token_hash,
    dispositivo_nome,
    ativo,
    ultimo_acesso_em
  )
  values (
    v_pai_id,
    v_filho_id,
    v_token_hash,
    v_nome,
    true,
    v_agora
  )
  returning dispositivo_id into v_dispositivo_id;

  delete from public.t_filho_acesso_app_tentativa
  where identificador_hash in (p_ip_hash, p_cliente_hash);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'dispositivo_id', v_dispositivo_id,
    'painel', public.montar_painel_filho(v_pai_id, v_filho_id)
  );
end;
$function$;

revoke all on function public.parear_acesso_app_filho_interno(text,text,text,text) from public, anon, authenticated;
grant execute on function public.parear_acesso_app_filho_interno(text,text,text,text) to service_role;

create or replace function public.obter_painel_app_filho_interno(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  v_token_hash := pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex');

  select a.id_usuario_pai, a.id_filho
    into v_pai_id, v_filho_id
  from public.t_filho_acesso_app a
  join public.t_filho f
    on f.id = a.id_filho
   and f.id_usuario_pai = a.id_usuario_pai
  where a.token_hash = v_token_hash
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return null;
  end if;

  update public.t_filho_acesso_app
  set ultimo_acesso_em = now(),
      updated_at = now()
  where token_hash = v_token_hash
    and ativo = true;

  return public.montar_painel_filho(v_pai_id, v_filho_id);
end;
$function$;

revoke all on function public.obter_painel_app_filho_interno(text) from public, anon, authenticated;
grant execute on function public.obter_painel_app_filho_interno(text) to service_role;

create or replace function public.sair_acesso_app_filho_interno(p_token text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token_hash text;
  v_count integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  v_token_hash := pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex');

  update public.t_filho_acesso_app
  set ativo = false,
      revogado_em = coalesce(revogado_em, now()),
      updated_at = now()
  where token_hash = v_token_hash
    and ativo = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.sair_acesso_app_filho_interno(text) from public, anon, authenticated;
grant execute on function public.sair_acesso_app_filho_interno(text) to service_role;
