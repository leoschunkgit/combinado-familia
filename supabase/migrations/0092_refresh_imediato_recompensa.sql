-- 0092 - Retorno atomico do estado atualizado apos concluir recompensa.
-- Evita uma segunda leitura separada logo apos "Ja aproveitou" e garante
-- que a tela receba o novo ciclo (0/meta) e o historico na mesma operacao.

create or replace function public.confirmar_recompensa_aproveitada(
  p_id_recompensa bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_resultado jsonb;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select r.id_filho
    into v_filho_id
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = v_pai_id
    and r.ativo = true;

  if v_filho_id is null then
    raise exception 'Recompensa não encontrada';
  end if;

  v_resultado := public.concluir_ciclo_recompensa_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    'RESPONSAVEL'
  );

  if coalesce((v_resultado->>'ok')::boolean, false) then
    return v_resultado || jsonb_build_object(
      'resumo',
      public.resumo_estrelas_filho_interno(v_pai_id, v_filho_id)
    );
  end if;

  return v_resultado;
end;
$function$;

create or replace function public.concluir_recompensa_filho_interno(
  p_token text,
  p_id_recompensa bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
  v_nome_filho text;
  v_resultado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(lower(p_token), 'sha256'),
    'hex'
  );

  select a.id_usuario_pai, a.id_filho, f.nome
    into v_pai_id, v_filho_id, v_nome_filho
  from public.t_filho_acesso_app a
  join public.t_filho f
    on f.id = a.id_filho
   and f.id_usuario_pai = a.id_usuario_pai
  where a.token_hash = v_token_hash
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  v_resultado := public.concluir_ciclo_recompensa_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    'FILHO'
  );

  if coalesce((v_resultado->>'ok')::boolean, false) then
    update public.t_filho_acesso_app
    set ultimo_acesso_em = now(),
        updated_at = now()
    where token_hash = v_token_hash
      and ativo = true;

    return v_resultado || jsonb_build_object(
      'nome_filho', v_nome_filho,
      'estrelas', public.resumo_estrelas_filho_interno(v_pai_id, v_filho_id)
    );
  end if;

  return v_resultado;
end;
$function$;

revoke all on function public.confirmar_recompensa_aproveitada(bigint)
from public, anon, authenticated, service_role;
grant execute on function public.confirmar_recompensa_aproveitada(bigint)
to authenticated;

revoke all on function public.concluir_recompensa_filho_interno(text,bigint)
from public, anon, authenticated;
grant execute on function public.concluir_recompensa_filho_interno(text,bigint)
to service_role;

comment on function public.confirmar_recompensa_aproveitada(bigint) is
'Conclui o ciclo pelo responsável e devolve, na mesma operação, o resumo de estrelas já atualizado para o próximo ciclo.';

comment on function public.concluir_recompensa_filho_interno(text,bigint) is
'Conclui o ciclo pelo filho e devolve, na mesma operação, o resumo de estrelas já atualizado para o próximo ciclo.';
