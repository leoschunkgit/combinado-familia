-- 0084 - Fecha atalhos manuais do fluxo antigo de recompensas.
-- O responsavel apenas configura e acompanha; conquista e automatica e a conclusao e confirmada pelo filho.

create or replace function public.resgatar_recompensa_estrelas(
  p_id_recompensa bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
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

  raise exception 'A recompensa é conquistada automaticamente ao atingir a meta';
end;
$function$;

create or replace function public.alterar_status_resgate_estrelas(
  p_id_resgate bigint,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
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

  raise exception 'A conclusão da recompensa deve ser confirmada pelo filho';
end;
$function$;

create or replace function public.desativar_recompensa_estrelas(
  p_id_recompensa bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
begin
  select p.id into v_pai_id
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
    and r.ativo = true
  for update;

  if v_filho_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = v_pai_id
      and rr.id_filho = v_filho_id
      and rr.id_recompensa = p_id_recompensa
      and rr.status = 'PENDENTE'
  ) then
    raise exception 'Aguarde o filho confirmar que aproveitou a recompensa antes de desativá-la';
  end if;

  update public.t_recompensa_estrela
  set ativo = false,
      updated_at = now()
  where id = p_id_recompensa
    and id_usuario_pai = v_pai_id
    and ativo = true;

  return found;
end;
$function$;
