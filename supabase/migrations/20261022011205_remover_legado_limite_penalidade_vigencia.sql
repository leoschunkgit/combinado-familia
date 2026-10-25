
-- Remove definitivamente o modelo antigo de limite/penalidade por vigência.
-- DEV está em manutenção: não mantemos camada de compatibilidade com legado de teste.

-- 1) Remover triggers do modelo antigo.
drop trigger if exists trg_guard_nao_fez_limit on public.t_ocorrencia;
drop trigger if exists trg_recalcular_estado_atribuicao on public.t_ocorrencia;
drop trigger if exists trg_recalcular_penalidade_ocorrencia on public.t_ocorrencia;
drop trigger if exists trg_recalcular_penalidade_atribuicao on public.t_filho_tarefa;
drop trigger if exists trg_recalcular_estado_filho_regra on public.t_filho;
drop trigger if exists trg_recalcular_penalidade_filho on public.t_filho;
drop trigger if exists trg_recalcular_estado_vigencia_regra on public.t_vigencia;
drop trigger if exists trg_recalcular_penalidade_vigencia on public.t_vigencia;

-- O guard de histórico continua existindo, mas agora vigência só tem período.
drop trigger if exists guard_validity_history_before_change on public.t_vigencia;
create trigger guard_validity_history_before_change
before delete or update of data_inicio, data_fim
on public.t_vigencia
for each row
execute function public.guard_validity_history();

-- 2) Remover funções antigas ligadas a limite, contador persistido e penalidade da vigência.
drop function if exists public.guard_nao_fez_limit();
drop function if exists public.recalcular_estado_atribuicao(bigint);
drop function if exists public.recalcular_estado_atribuicao_trigger();
drop function if exists public.recalcular_estado_por_regra_trigger();
drop function if exists public.existe_filho_sem_mesada_no_limite(bigint);
drop function if exists public.recalcular_penalidade_vigencia(bigint);
drop function if exists public.recalcular_penalidade_por_ocorrencia_trigger();
drop function if exists public.recalcular_penalidade_por_atribuicao_trigger();
drop function if exists public.recalcular_penalidade_por_filho_trigger();
drop function if exists public.recalcular_penalidade_por_vigencia_trigger();
drop function if exists public.registrar_nao_fez_com_penalidade(bigint,timestamptz,bigint,text);
drop function if exists public.guard_mesada_assignment();
drop function if exists public.guard_mesada_child();
drop function if exists public.guard_mesada_validity();

-- 3) Vigência fica exclusivamente como contexto/período.
-- Atribuição deixa de persistir estado derivado de Não fez.
alter table public.t_filho_tarefa
  drop column if exists qtd_nao_fez,
  drop column if exists feito;

alter table public.t_vigencia
  drop column if exists penalidade,
  drop column if exists qtd_ocorrencia,
  drop column if exists tipo_penalidade,
  drop column if exists valor_debito;

-- 4) Duplicação de vigência agora duplica apenas período + atribuições.
drop function if exists public.duplicar_vigencia_com_atribuicoes(
  bigint,timestamptz,timestamptz,text,integer,numeric
);

create or replace function public.duplicar_vigencia_com_atribuicoes(
  p_modelo_id bigint,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
returns table(id_vigencia bigint, qtd_atribuicoes integer)
language plpgsql
security definer
set search_path = ''
as $$
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
  where ft.id_usuario_pai = v_pai_id
    and ft.id_vigencia = p_modelo_id;

  get diagnostics v_qtd = row_count;
  return query select v_nova_id, v_qtd;
end;
$$;

revoke all on function public.duplicar_vigencia_com_atribuicoes(
  bigint,timestamptz,timestamptz
) from public;
grant execute on function public.duplicar_vigencia_com_atribuicoes(
  bigint,timestamptz,timestamptz
) to authenticated;

-- 5) Contrato do painel do filho passa a refletir o modelo novo.
create or replace function public.montar_painel_filho(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
                      'bonificacao_tipo', o.bonificacao_tipo,
                      'bonificacao_descricao', o.bonificacao_descricao,
                      'bonificacao_valor', o.bonificacao_valor,
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
$$;

comment on table public.t_vigencia is
'Contexto temporal do combinado. Regras de consequência não pertencem à vigência.';

comment on table public.t_ocorrencia_consequencia is
'Consequência individual de um NAO_FEZ. Desconto ou penalidade pertencem à ocorrência, nunca à vigência.';
