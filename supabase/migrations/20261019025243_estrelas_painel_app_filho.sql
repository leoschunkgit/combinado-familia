-- Mantem estrelas exclusivas do acesso interno do filho pelo app.
-- O painel publico por link continua usando montar_painel_filho sem estrelas.

create or replace function public.montar_painel_app_filho(
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
  v_painel jsonb;
  v_estrelas jsonb;
begin
  v_painel := public.montar_painel_filho(p_id_usuario_pai, p_id_filho);

  if v_painel is null then
    return null;
  end if;

  v_estrelas := public.resumo_estrelas_filho_interno(p_id_usuario_pai, p_id_filho);

  return v_painel || jsonb_build_object(
    'estrelas',
    coalesce(v_estrelas, jsonb_build_object(
      'hoje', 0,
      'vigencia_atual', 0,
      'saldo', 0,
      'total_conquistado', 0,
      'recompensas', '[]'::jsonb,
      'resgates', '[]'::jsonb
    ))
  );
end;
$function$;

revoke all on function public.montar_painel_app_filho(bigint,bigint)
from public, anon, authenticated, service_role;

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

  return public.montar_painel_app_filho(v_pai_id, v_filho_id);
end;
$function$;

revoke all on function public.obter_painel_app_filho_interno(text)
from public, anon, authenticated;
grant execute on function public.obter_painel_app_filho_interno(text)
to service_role;
