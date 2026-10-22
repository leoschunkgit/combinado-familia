alter table public.t_filho
  add column if not exists mesada_ciclo_atual bigint not null default 0;

alter table public.t_ocorrencia_consequencia
  add column if not exists mesada_ciclo bigint;

update public.t_filho
set mesada_ciclo_atual = 1
where mesada_ciclo_atual = 0;

update public.t_ocorrencia_consequencia c
set mesada_ciclo = f.mesada_ciclo_atual
from public.t_ocorrencia o
join public.t_filho_tarefa ft
  on ft.id = o.id_filho_tarefa
join public.t_filho f
  on f.id = ft.id_filho
 and f.id_usuario_pai = ft.id_usuario_pai
where c.id_ocorrencia = o.id
  and c.id_usuario_pai = o.id_usuario_pai
  and c.tipo = 'DESCONTO'
  and c.mesada_ciclo is null;

alter table public.t_filho
  drop constraint if exists chk_t_filho_mesada_ciclo_atual_nonnegative;

alter table public.t_filho
  add constraint chk_t_filho_mesada_ciclo_atual_nonnegative
  check (mesada_ciclo_atual >= 0);

alter table public.t_ocorrencia_consequencia
  drop constraint if exists chk_t_ocorrencia_consequencia_mesada_ciclo_positive;

alter table public.t_ocorrencia_consequencia
  add constraint chk_t_ocorrencia_consequencia_mesada_ciclo_positive
  check (mesada_ciclo is null or mesada_ciclo > 0);

create or replace function public.definir_ciclo_mesada_filho_interno()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_old_ativa boolean;
  v_new_ativa boolean;
begin
  v_new_ativa :=
    coalesce(new.tem_mesada_opcional, false)
    and new.valor_mesada is not null;

  if tg_op = 'INSERT' then
    new.mesada_ciclo_atual := case when v_new_ativa then 1 else 0 end;
    return new;
  end if;

  v_old_ativa :=
    coalesce(old.tem_mesada_opcional, false)
    and old.valor_mesada is not null;

  if not v_old_ativa and v_new_ativa then
    new.mesada_ciclo_atual :=
      greatest(coalesce(old.mesada_ciclo_atual, 0) + 1, 1);
  else
    new.mesada_ciclo_atual := coalesce(old.mesada_ciclo_atual, 0);
  end if;

  return new;
end;
$function$;

drop trigger if exists definir_ciclo_mesada_filho_before_change
  on public.t_filho;

create trigger definir_ciclo_mesada_filho_before_change
before insert or update of tem_mesada_opcional, valor_mesada, mesada_ciclo_atual
on public.t_filho
for each row
execute function public.definir_ciclo_mesada_filho_interno();

create or replace function public.definir_ciclo_mesada_consequencia_interno()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_ciclo bigint;
  v_mesada_ativa boolean;
begin
  if new.tipo is distinct from 'DESCONTO' then
    if tg_op = 'INSERT' then
      new.mesada_ciclo := null;
    else
      new.mesada_ciclo := old.mesada_ciclo;
    end if;
    return new;
  end if;

  select
    f.mesada_ciclo_atual,
    coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null
  into
    v_ciclo,
    v_mesada_ativa
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
    raise exception 'Não foi possível identificar o filho da consequência';
  end if;

  if tg_op = 'INSERT'
     or old.tipo is distinct from 'DESCONTO'
     or (
       old.status is distinct from 'APLICADO'
       and new.status = 'APLICADO'
     ) then
    if new.status = 'APLICADO' and not v_mesada_ativa then
      raise exception 'Desconto só pode ser aplicado quando o filho possui mesada ativa';
    end if;

    new.mesada_ciclo := v_ciclo;
  else
    new.mesada_ciclo := old.mesada_ciclo;
  end if;

  return new;
end;
$function$;

drop trigger if exists a_definir_ciclo_mesada_consequencia_before_change
  on public.t_ocorrencia_consequencia;

create trigger a_definir_ciclo_mesada_consequencia_before_change
before insert or update
on public.t_ocorrencia_consequencia
for each row
execute function public.definir_ciclo_mesada_consequencia_interno();

revoke all on function public.definir_ciclo_mesada_filho_interno()
  from public, anon, authenticated;

revoke all on function public.definir_ciclo_mesada_consequencia_interno()
  from public, anon, authenticated;

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
      'valor_mesada', f.valor_mesada,
      'mesada_ciclo_atual', f.mesada_ciclo_atual
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
                            'cancelada_em', c.cancelada_em,
                            'mesada_ciclo', c.mesada_ciclo
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

comment on column public.t_filho.mesada_ciclo_atual is
'Ciclo funcional da mesada. Incrementa somente quando uma mesada inativa volta a ficar ativa.';

comment on column public.t_ocorrencia_consequencia.mesada_ciclo is
'Ciclo da mesada ao qual o desconto pertence. Descontos de ciclos antigos permanecem no histórico, mas não reduzem a mesada atual.';

comment on function public.definir_ciclo_mesada_filho_interno() is
'Controla o ciclo da mesada no cadastro do filho. Retirar e reativar a mesada inicia um novo ciclo.';

comment on function public.definir_ciclo_mesada_consequencia_interno() is
'Vincula cada desconto ao ciclo de mesada vigente quando ele passa a ser aplicado.';
