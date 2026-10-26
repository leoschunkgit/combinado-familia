
create or replace function public.excluir_filho_com_regra(p_id_filho bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select f.nome
    into v_nome
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = v_pai_id
  for update;

  if v_nome is null then
    raise exception 'Filho não encontrado para este responsável';
  end if;

  delete from public.t_filho
  where id = p_id_filho
    and id_usuario_pai = v_pai_id;

  return jsonb_build_object(
    'ok', true,
    'id_filho', p_id_filho,
    'nome', v_nome
  );
end;
$$;

revoke all on function public.excluir_filho_com_regra(bigint)
from public, anon, authenticated, service_role;

grant execute on function public.excluir_filho_com_regra(bigint)
to authenticated, service_role;

create or replace function public.excluir_todos_filhos_com_regra()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  delete from public.t_filho
  where id_usuario_pai = v_pai_id;

  get diagnostics v_total = row_count;

  return jsonb_build_object(
    'ok', true,
    'qtd_excluida', v_total
  );
end;
$$;

revoke all on function public.excluir_todos_filhos_com_regra()
from public, anon, authenticated, service_role;

grant execute on function public.excluir_todos_filhos_com_regra()
to authenticated, service_role;
