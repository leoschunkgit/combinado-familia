create or replace function private.vigencia_automatica_feature_flag_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.chave = 'vigencia_automatica'
     and new.ativo = true
     and (
       tg_op = 'INSERT'
       or old.ativo is distinct from new.ativo
     ) then
    perform private.vigencia_automatica_inicializar_existentes();
  end if;

  return new;
end;
$$;

drop trigger if exists vigencia_automatica_feature_flag_after_change
  on public.t_app_feature_flag;

create trigger vigencia_automatica_feature_flag_after_change
after insert or update of ativo
on public.t_app_feature_flag
for each row
when (new.chave = 'vigencia_automatica')
execute function private.vigencia_automatica_feature_flag_after_change();

revoke execute on function private.vigencia_automatica_feature_flag_after_change()
  from public, anon, authenticated;
