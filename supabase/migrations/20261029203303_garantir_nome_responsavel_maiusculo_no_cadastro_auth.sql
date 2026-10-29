create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.t_usuario_pai (
    auth_user_id,
    nome,
    email
  )
  values (
    new.id,
    upper(btrim(coalesce(new.raw_user_meta_data ->> 'nome', ''))),
    coalesce(new.email, '')
  );

  return new;
end;
$function$;
