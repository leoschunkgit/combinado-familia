
drop trigger if exists a_definir_ciclo_mesada_consequencia_before_change
  on public.t_ocorrencia_consequencia;

drop trigger if exists definir_ciclo_mesada_filho_before_change
  on public.t_filho;

drop function if exists public.definir_ciclo_mesada_consequencia_interno();
drop function if exists public.definir_ciclo_mesada_filho_interno();

create or replace function public.total_descontos_aplicados_filho_vigencia_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_vigencia bigint,
  p_ignorar_id_consequencia bigint default null
)
returns numeric
language sql
stable
set search_path to ''
as $function$
  select coalesce(sum(c.desconto_valor), 0)::numeric
  from public.t_ocorrencia_consequencia c
  join public.t_ocorrencia o
    on o.id = c.id_ocorrencia
   and o.id_usuario_pai = c.id_usuario_pai
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where c.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and ft.id_vigencia = p_id_vigencia
    and o.tipo = 'NAO_FEZ'
    and c.tipo = 'DESCONTO'
    and c.status = 'APLICADO'
    and (
      p_ignorar_id_consequencia is null
      or c.id <> p_ignorar_id_consequencia
    );
$function$;

revoke all on function public.total_descontos_aplicados_filho_vigencia_interno(bigint,bigint,bigint,bigint)
  from public, anon, authenticated;

create or replace function public.validar_mesada_filho_vigencia_interno()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_id_vigencia bigint;
  v_total_descontos numeric;
  v_mesada_ativa boolean;
begin
  v_mesada_ativa :=
    coalesce(new.tem_mesada_opcional, false)
    and new.valor_mesada is not null;

  if not v_mesada_ativa then
    return new;
  end if;

  for v_id_vigencia in
    select distinct ft.id_vigencia
    from public.t_filho_tarefa ft
    join public.t_vigencia v
      on v.id = ft.id_vigencia
     and v.id_usuario_pai = ft.id_usuario_pai
    where ft.id_usuario_pai = new.id_usuario_pai
      and ft.id_filho = new.id
      and now() between v.data_inicio and v.data_fim
  loop
    v_total_descontos :=
      public.total_descontos_aplicados_filho_vigencia_interno(
        new.id_usuario_pai,
        new.id,
        v_id_vigencia,
        null
      );

    if new.valor_mesada < v_total_descontos then
      raise exception
        'A mesada não pode ser menor que o total de descontos aplicados na vigência atual (R$ %).',
        trim(to_char(v_total_descontos, 'FM9999999990D00'));
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function public.validar_mesada_filho_vigencia_interno()
  from public, anon, authenticated;

drop trigger if exists validar_mesada_filho_vigencia_before_change
  on public.t_filho;

create trigger validar_mesada_filho_vigencia_before_change
before insert or update of tem_mesada, tem_mesada_opcional, valor_mesada
on public.t_filho
for each row
execute function public.validar_mesada_filho_vigencia_interno();

create or replace function public.validar_desconto_mesada_vigencia_interno()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_mesada_ativa boolean;
  v_valor_mesada numeric;
  v_total_outros numeric;
  v_ignorar_id bigint;
begin
  if new.tipo is distinct from 'DESCONTO'
     or new.status is distinct from 'APLICADO' then
    return new;
  end if;

  select
    ft.id_filho,
    ft.id_vigencia,
    coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
    f.valor_mesada
  into
    v_id_filho,
    v_id_vigencia,
    v_mesada_ativa,
    v_valor_mesada
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  join public.t_filho f
    on f.id = ft.id_filho
   and f.id_usuario_pai = ft.id_usuario_pai
  where o.id = new.id_ocorrencia
    and o.id_usuario_pai = new.id_usuario_pai;

  if not found then
    raise exception 'Não foi possível identificar o filho e a vigência da consequência';
  end if;

  if not v_mesada_ativa then
    raise exception 'Desconto de mesada só pode ser aplicado a filho com mesada cadastrada';
  end if;

  if new.desconto_valor is null or new.desconto_valor <= 0 then
    raise exception 'Informe um valor de desconto válido';
  end if;

  v_ignorar_id := case when tg_op = 'UPDATE' then old.id else null end;

  v_total_outros :=
    public.total_descontos_aplicados_filho_vigencia_interno(
      new.id_usuario_pai,
      v_id_filho,
      v_id_vigencia,
      v_ignorar_id
    );

  if v_total_outros + new.desconto_valor > v_valor_mesada then
    raise exception
      'O total de descontos aplicados na vigência não pode ultrapassar a mesada atual (R$ %).',
      trim(to_char(v_valor_mesada, 'FM9999999990D00'));
  end if;

  return new;
end;
$function$;

revoke all on function public.validar_desconto_mesada_vigencia_interno()
  from public, anon, authenticated;

drop trigger if exists a_validar_desconto_mesada_vigencia_before_change
  on public.t_ocorrencia_consequencia;

create trigger a_validar_desconto_mesada_vigencia_before_change
before insert or update
on public.t_ocorrencia_consequencia
for each row
execute function public.validar_desconto_mesada_vigencia_interno();

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
          'qtd_nao_fez', (
            select count(*)::integer
            from public.t_ocorrencia o_count
            join public.t_filho_tarefa ft_count
              on ft_count.id = o_count.id_filho_tarefa
            where ft_count.id_usuario_pai = p_id_usuario_pai
              and ft_count.id_filho = p_id_filho
              and ft_count.id_vigencia = v.id
              and o_count.tipo = 'NAO_FEZ'
          ),
          'qtd_nao_precisou', (
            select count(*)::integer
            from public.t_ocorrencia o_count
            join public.t_filho_tarefa ft_count
              on ft_count.id = o_count.id_filho_tarefa
            where ft_count.id_usuario_pai = p_id_usuario_pai
              and ft_count.id_filho = p_id_filho
              and ft_count.id_vigencia = v.id
              and o_count.tipo = 'NAO_PRECISOU'
          ),
          'tarefas', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ft.id,
                'nome', t.nome,
                'ocorrencias', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'tipo', o.tipo,
                      'data', o.created_at,
                      'consequencia',
                        case when c.id is null then null else
                          jsonb_build_object(
                            'tipo', c.tipo,
                            'desconto_valor', c.desconto_valor,
                            'penalidade_descricao', c.penalidade_descricao,
                            'status', c.status,
                            'cumprida_em', c.cumprida_em,
                            'cancelada_em', c.cancelada_em
                          )
                        end
                    )
                    order by o.created_at desc
                  )
                  from public.t_ocorrencia o
                  left join public.t_ocorrencia_consequencia c
                    on c.id_ocorrencia = o.id
                   and c.id_usuario_pai = o.id_usuario_pai
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

alter table public.t_ocorrencia_consequencia
  drop constraint if exists chk_t_ocorrencia_consequencia_mesada_ciclo_positive;

alter table public.t_filho
  drop constraint if exists chk_t_filho_mesada_ciclo_atual_nonnegative;

alter table public.t_ocorrencia_consequencia
  drop column if exists mesada_ciclo;

alter table public.t_filho
  drop column if exists mesada_ciclo_atual;

comment on function public.total_descontos_aplicados_filho_vigencia_interno(bigint,bigint,bigint,bigint) is
'Soma apenas descontos de Não fez com status APLICADO para um filho dentro de uma vigência.';

comment on function public.validar_mesada_filho_vigencia_interno() is
'Impede ativar ou reduzir uma mesada para valor inferior aos descontos APLICADOS da vigência em andamento.';

comment on function public.validar_desconto_mesada_vigencia_interno() is
'Impede que descontos APLICADOS de uma vigência ultrapassem o valor atual da mesada do filho.';
