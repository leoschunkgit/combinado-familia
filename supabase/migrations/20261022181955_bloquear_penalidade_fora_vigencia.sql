-- Bloqueia o cumprimento de penalidade fora da vigência em andamento.
-- A regra fica no banco, inclusive para tentativas de UPDATE direto,
-- e é compartilhada por qualquer fluxo que altere t_ocorrencia_consequencia.

create or replace function public.vigencia_ocorrencia_em_andamento_interno(
  p_id_usuario_pai bigint,
  p_id_ocorrencia bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.t_ocorrencia o
    join public.t_filho_tarefa ft
      on ft.id = o.id_filho_tarefa
     and ft.id_usuario_pai = o.id_usuario_pai
    join public.t_vigencia v
      on v.id = ft.id_vigencia
     and v.id_usuario_pai = ft.id_usuario_pai
    where o.id = p_id_ocorrencia
      and o.id_usuario_pai = p_id_usuario_pai
      and now() between v.data_inicio and v.data_fim
  );
$$;

revoke all on function public.vigencia_ocorrencia_em_andamento_interno(bigint,bigint)
  from public, anon, authenticated;

grant execute on function public.vigencia_ocorrencia_em_andamento_interno(bigint,bigint)
  to service_role;

comment on function public.vigencia_ocorrencia_em_andamento_interno(bigint,bigint) is
'Regra interna centralizada: informa se a ocorrência pertence a uma vigência atualmente em andamento.';

create or replace function public.guard_consequencia_resultado_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_resultado text;
begin
  -- Cumprir uma penalidade é uma alteração funcional do resultado.
  -- Portanto só pode acontecer enquanto a vigência estiver em andamento.
  if new.tipo = 'PENALIDADE'
     and new.status = 'CUMPRIDA'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'CUMPRIDA'
     )
     and not public.vigencia_ocorrencia_em_andamento_interno(
       new.id_usuario_pai,
       new.id_ocorrencia
     ) then
    raise exception 'Penalidade só pode ser marcada como cumprida durante a vigência em andamento';
  end if;

  -- Consequências encerradas permanecem como histórico de uma transição.
  if new.status not in ('APLICADO','PENDENTE','CUMPRIDA') then
    return new;
  end if;

  select o.tipo
    into v_tipo_resultado
  from public.t_ocorrencia o
  where o.id = new.id_ocorrencia
    and o.id_usuario_pai = new.id_usuario_pai;

  if v_tipo_resultado is distinct from 'NAO_FEZ' then
    raise exception 'Consequência ativa só pode existir em resultado Não fez';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_consequencia_resultado_interno()
  from public, anon, authenticated;

grant execute on function public.guard_consequencia_resultado_interno()
  to service_role;

comment on function public.guard_consequencia_resultado_interno() is
'Protege a coerência das consequências e bloqueia o cumprimento de penalidade fora da vigência em andamento.';
