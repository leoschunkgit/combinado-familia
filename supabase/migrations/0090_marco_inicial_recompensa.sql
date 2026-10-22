-- 0090 - Marco inicial permanente para recompensas.
-- Uma recompensa nova passa a contar somente as estrelas conquistadas depois de sua criação.
-- Ciclos seguintes continuam usando o total de estrelas do último ciclo concluído como marco.
-- O mérito total do filho permanece permanente e independente das recompensas.

alter table public.t_recompensa_estrela
  add column if not exists marco_inicial_estrelas integer null;

-- Backfill coerente com a nova regra: quantas estrelas o filho já possuía
-- no instante em que cada recompensa existente foi criada.
update public.t_recompensa_estrela r
set marco_inicial_estrelas = (
  select count(*)::integer
  from public.t_estrela_concessao ec
  where ec.id_usuario_pai = r.id_usuario_pai
    and ec.id_filho = r.id_filho
    and ec.created_at <= r.created_at
)
where r.marco_inicial_estrelas is null;

alter table public.t_recompensa_estrela
  alter column marco_inicial_estrelas set not null;

alter table public.t_recompensa_estrela
  drop constraint if exists t_recompensa_estrela_marco_inicial_chk;

alter table public.t_recompensa_estrela
  add constraint t_recompensa_estrela_marco_inicial_chk
  check (marco_inicial_estrelas >= 0);

create or replace function public.marco_recompensa_estrelas_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_recompensa bigint
)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select rr.total_estrelas_no_resgate
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = p_id_recompensa
        and rr.status = 'ENTREGUE'
        and rr.total_estrelas_no_resgate is not null
      order by rr.entregue_em desc nulls last, rr.id desc
      limit 1
    ),
    (
      select r.marco_inicial_estrelas
      from public.t_recompensa_estrela r
      where r.id = p_id_recompensa
        and r.id_usuario_pai = p_id_usuario_pai
        and r.id_filho = p_id_filho
    ),
    0
  )::integer;
$function$;

create or replace function public.proteger_marco_inicial_recompensa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.marco_inicial_estrelas is distinct from old.marco_inicial_estrelas then
    raise exception 'O marco inicial da recompensa é imutável';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_proteger_marco_inicial_recompensa
on public.t_recompensa_estrela;

create trigger trg_proteger_marco_inicial_recompensa
before update of marco_inicial_estrelas
on public.t_recompensa_estrela
for each row
execute function public.proteger_marco_inicial_recompensa();

create or replace function public.salvar_recompensa_estrelas(
  p_id_filho bigint,
  p_nome text,
  p_descricao text,
  p_estrelas_necessarias integer,
  p_id_recompensa bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_id bigint;
  v_nome text;
  v_descricao text;
  v_marco_inicial integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then raise exception 'Responsável não encontrado'; end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = v_pai_id
  for update;

  if not found then raise exception 'Filho não encontrado para este responsável'; end if;

  v_nome := btrim(coalesce(p_nome, ''));
  v_descricao := nullif(btrim(coalesce(p_descricao, '')), '');

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then
    raise exception 'Informe uma recompensa entre 2 e 100 caracteres';
  end if;
  if v_descricao is not null and char_length(v_descricao) > 300 then
    raise exception 'A descrição da recompensa deve ter no máximo 300 caracteres';
  end if;
  if p_estrelas_necessarias is null or p_estrelas_necessarias < 1 or p_estrelas_necessarias > 100000 then
    raise exception 'Informe uma quantidade válida de estrelas';
  end if;

  if p_id_recompensa is null then
    insert into public.t_recompensa_estrela (
      id_usuario_pai, id_filho, nome, descricao, estrelas_necessarias, ativo
    )
    values (
      v_pai_id, p_id_filho, v_nome, v_descricao, p_estrelas_necessarias, true
    )
    returning id into v_id;
  else
    update public.t_recompensa_estrela
    set nome = v_nome,
        descricao = v_descricao,
        estrelas_necessarias = p_estrelas_necessarias,
        updated_at = now()
    where id = p_id_recompensa
      and id_usuario_pai = v_pai_id
      and id_filho = p_id_filho
    returning id into v_id;

    if v_id is null then raise exception 'Recompensa não encontrada'; end if;
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id, p_id_filho, v_id
  );

  return v_id;
end;
$function$;

create or replace function public.garantir_conquista_recompensa_estrelas_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_recompensa bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total integer;
  v_marco integer;
  v_recompensa record;
begin
  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then return; end if;

  v_total := public.estrelas_total_conquistado_interno(p_id_usuario_pai, p_id_filho);

  for v_recompensa in
    select r.id, r.nome, r.descricao, r.estrelas_necessarias
    from public.t_recompensa_estrela r
    where r.id_usuario_pai = p_id_usuario_pai
      and r.id_filho = p_id_filho
      and r.ativo = true
      and (p_id_recompensa is null or r.id = p_id_recompensa)
    order by r.id
    for update
  loop
    if exists (
      select 1
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = v_recompensa.id
        and rr.status = 'PENDENTE'
    ) then
      continue;
    end if;

    v_marco := public.marco_recompensa_estrelas_interno(
      p_id_usuario_pai,
      p_id_filho,
      v_recompensa.id
    );

    if greatest(v_total - v_marco, 0) < v_recompensa.estrelas_necessarias then
      continue;
    end if;

    insert into public.t_recompensa_resgate (
      id_usuario_pai, id_filho, id_recompensa, recompensa_nome,
      recompensa_descricao_no_resgate, estrelas_utilizadas,
      meta_estrelas_no_resgate, total_estrelas_no_resgate, status
    )
    values (
      p_id_usuario_pai, p_id_filho, v_recompensa.id, v_recompensa.nome,
      v_recompensa.descricao, v_recompensa.estrelas_necessarias,
      v_recompensa.estrelas_necessarias, v_total, 'PENDENTE'
    );
  end loop;
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
    select 1 from public.t_filho f
    where f.id = p_id_filho and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  v_total := public.estrelas_total_conquistado_interno(p_id_usuario_pai, p_id_filho);

  -- Estrelas do dia são mérito já concedido e não dependem da ocorrência continuar existindo.
  select count(*)::integer into v_hoje
  from public.t_estrela_concessao ec
  where ec.id_usuario_pai = p_id_usuario_pai
    and ec.id_filho = p_id_filho
    and ec.data_referencia = timezone('America/Sao_Paulo', now())::date;

  select v.id into v_vigencia_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_id_usuario_pai
    and now() between v.data_inicio and v.data_fim
    and exists (
      select 1 from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_filho = p_id_filho
        and ft.id_vigencia = v.id
    )
  order by v.data_inicio desc
  limit 1;

  if v_vigencia_id is null then
    v_vigencia := 0;
  else
    -- Mesma regra para a vigência: conta concessões permanentes daquela vigência.
    select count(*)::integer into v_vigencia
    from public.t_estrela_concessao ec
    where ec.id_usuario_pai = p_id_usuario_pai
      and ec.id_filho = p_id_filho
      and ec.id_vigencia = v_vigencia_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'nome', r.nome,
        'descricao', r.descricao,
        'nome_exibicao', r.nome,
        'descricao_exibicao', r.descricao,
        'estrelas_necessarias', r.estrelas_necessarias,
        'progresso', x.progresso,
        'faltam', greatest(r.estrelas_necessarias - x.progresso, 0),
        'disponivel', (not x.tem_pendente and x.progresso >= r.estrelas_necessarias),
        'pendente', x.tem_pendente,
        'conquistada', (x.tem_pendente or x.progresso >= r.estrelas_necessarias),
        'meta_exibicao',
          case
            when x.tem_pendente then coalesce(x.pendente_meta, r.estrelas_necessarias)
            else r.estrelas_necessarias
          end,
        'progresso_exibicao',
          case
            when x.tem_pendente then coalesce(x.pendente_meta, r.estrelas_necessarias)
            when x.progresso >= r.estrelas_necessarias then r.estrelas_necessarias
            else least(x.progresso, r.estrelas_necessarias)
          end,
        'faltam_exibicao',
          case
            when x.tem_pendente or x.progresso >= r.estrelas_necessarias then 0
            else greatest(r.estrelas_necessarias - x.progresso, 0)
          end,
        'pode_excluir', (not x.tem_pendente),
        'pode_desativar', (not x.tem_pendente),
        'pode_confirmar_aproveitada', x.tem_pendente,
        'marco_estrelas', x.marco_estrelas,
        'conquista_id', x.pendente_id,
        'conquista_nome', x.pendente_nome,
        'conquista_descricao', x.pendente_descricao,
        'conquista_meta', x.pendente_meta
      )
      order by r.estrelas_necessarias, r.nome
    ),
    '[]'::jsonb
  ) into v_recompensas
  from public.t_recompensa_estrela r
  cross join lateral (
    select
      greatest(
        v_total - public.marco_recompensa_estrelas_interno(
          p_id_usuario_pai,
          p_id_filho,
          r.id
        ),
        0
      )::integer as progresso,
      public.marco_recompensa_estrelas_interno(
        p_id_usuario_pai,
        p_id_filho,
        r.id
      )::integer as marco_estrelas,
      (p.id is not null) as tem_pendente,
      exists (
        select 1
        from public.t_recompensa_resgate rr_hist
        where rr_hist.id_usuario_pai = p_id_usuario_pai
          and rr_hist.id_filho = p_id_filho
          and rr_hist.id_recompensa = r.id
      ) as tem_historico,
      p.id as pendente_id,
      p.recompensa_nome as pendente_nome,
      p.recompensa_descricao_no_resgate as pendente_descricao,
      coalesce(p.meta_estrelas_no_resgate, p.estrelas_utilizadas) as pendente_meta
    from (
      select rr.id, rr.recompensa_nome, rr.recompensa_descricao_no_resgate,
             rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = r.id
        and rr.status = 'PENDENTE'
      order by rr.created_at desc, rr.id desc
      limit 1
    ) p
    right join (select 1 as chave) base on true
  ) x
  where r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho = p_id_filho
    and r.ativo = true;

  select coalesce(jsonb_agg(x.item order by x.ordem desc), '[]'::jsonb)
    into v_resgates
  from (
    select rr.created_at as ordem,
      jsonb_build_object(
        'id', rr.id,
        'id_recompensa', rr.id_recompensa,
        -- Snapshot tecnico preservado para auditoria/compatibilidade.
        'recompensa_nome', rr.recompensa_nome,
        'recompensa_descricao_no_resgate', rr.recompensa_descricao_no_resgate,
        'estrelas_utilizadas', rr.estrelas_utilizadas,
        'meta_estrelas_no_resgate', coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'total_estrelas_no_resgate', rr.total_estrelas_no_resgate,
        -- Contrato semantico consumido pelas telas.
        'nome_exibicao',
          case when r.id is not null then r.nome else rr.recompensa_nome end,
        'descricao_exibicao',
          case when r.id is not null then r.descricao else rr.recompensa_descricao_no_resgate end,
        'quantidade_estrelas_conquista',
          coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'conquistou_em', rr.created_at,
        'aproveitou_em',
          case when rr.status = 'ENTREGUE' then rr.entregue_em else null end,
        'contagem_recomecou_em',
          case when rr.status = 'ENTREGUE' then rr.entregue_em else null end,
        'confirmado_por', rr.confirmado_por,
        'status', rr.status,
        'created_at', rr.created_at,
        'entregue_em', rr.entregue_em,
        'cancelado_em', rr.cancelado_em
      ) as item
    from public.t_recompensa_resgate rr
    left join public.t_recompensa_estrela r
      on r.id = rr.id_recompensa
     and r.id_usuario_pai = rr.id_usuario_pai
     and r.id_filho = rr.id_filho
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

-- Corrige exclusivamente ciclos PENDENTES criados automaticamente na mesma transação
-- da criação da recompensa pela regra anterior, quando nenhuma estrela nova foi suficiente
-- para atingir a meta segundo o novo marco inicial.
delete from public.t_recompensa_resgate rr
using public.t_recompensa_estrela r
where rr.id_recompensa = r.id
  and rr.id_usuario_pai = r.id_usuario_pai
  and rr.id_filho = r.id_filho
  and rr.status = 'PENDENTE'
  and rr.created_at = r.created_at
  and not exists (
    select 1
    from public.t_recompensa_resgate outro
    where outro.id_recompensa = r.id
      and outro.id <> rr.id
  )
  and (
    select count(*)::integer
    from public.t_estrela_concessao ec
    where ec.id_usuario_pai = r.id_usuario_pai
      and ec.id_filho = r.id_filho
      and ec.created_at > r.created_at
  ) < coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas);

revoke all on function public.marco_recompensa_estrelas_interno(bigint,bigint,bigint)
from public, anon, authenticated, service_role;

revoke all on function public.proteger_marco_inicial_recompensa()
from public, anon, authenticated, service_role;

revoke all on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint)
from public, anon, authenticated, service_role;
grant execute on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint)
to authenticated;

revoke all on function public.garantir_conquista_recompensa_estrelas_interno(bigint,bigint,bigint)
from public, anon, authenticated, service_role;

revoke all on function public.resumo_estrelas_filho_interno(bigint,bigint)
from public, anon, authenticated, service_role;

comment on column public.t_recompensa_estrela.marco_inicial_estrelas is
'Total permanente de estrelas que o filho já possuía quando a recompensa foi criada. É imutável e serve de marco do primeiro ciclo; após a primeira conclusão, o último total concluído passa a ser o marco dos ciclos seguintes.';

comment on function public.marco_recompensa_estrelas_interno(bigint,bigint,bigint) is
'Regra central do marco de progresso da recompensa: usa o total do último ciclo ENTREGUE; se nunca houve ciclo concluído, usa o marco inicial gravado na criação.';
