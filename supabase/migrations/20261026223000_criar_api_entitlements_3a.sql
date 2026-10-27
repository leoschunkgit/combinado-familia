-- Fase 3A: API central de Entitlements.
-- Backend DEV apenas. Nenhuma tela ou regra do aplicativo passa a consumir esta API nesta fase.

create or replace function billing.entitlements_sessao()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_id_usuario_pai bigint;
  v_direitos jsonb;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise sqlstate '42501'
      using message = 'Autenticação obrigatória.';
  end if;

  select p.id
    into v_id_usuario_pai
    from public.t_usuario_pai p
   where p.auth_user_id = v_auth_user_id
   limit 1;

  if v_id_usuario_pai is null then
    raise sqlstate '42501'
      using message = 'Conta responsável não encontrada para a sessão autenticada.';
  end if;

  v_direitos := billing.direitos_efetivos(v_id_usuario_pai, now());

  return jsonb_build_object(
    'versao_contrato', 1,
    'direitos', coalesce(v_direitos, '{}'::jsonb)
  );
end;
$$;

comment on function billing.entitlements_sessao() is
  'Resolvedor privilegiado interno dos direitos da sessão autenticada. Não é exposto diretamente pela Data API.';

revoke all on function billing.entitlements_sessao() from public;
revoke all on function billing.entitlements_sessao() from anon;
revoke all on function billing.entitlements_sessao() from authenticated;

-- O wrapper público é SECURITY INVOKER. Para alcançar a função interna,
-- authenticated recebe somente USAGE no schema e EXECUTE nesta função.
-- Nenhuma tabela billing recebe SELECT/INSERT/UPDATE/DELETE.
grant usage on schema billing to authenticated;
grant execute on function billing.entitlements_sessao() to authenticated;

create or replace function public.entitlements_obter()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select billing.entitlements_sessao();
$$;

comment on function public.entitlements_obter() is
  'API pública controlada para leitura dos direitos efetivos da própria conta autenticada. Sem parâmetros de usuário.';

revoke all on function public.entitlements_obter() from public;
revoke all on function public.entitlements_obter() from anon;
grant execute on function public.entitlements_obter() to authenticated;
