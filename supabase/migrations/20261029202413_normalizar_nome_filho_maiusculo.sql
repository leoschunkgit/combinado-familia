create or replace function private.normalizar_nome_filho_interno()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome := upper(btrim(new.nome));
  return new;
end;
$$;

drop trigger if exists normalizar_nome_filho_before_write on public.t_filho;

create trigger normalizar_nome_filho_before_write
before insert or update of nome on public.t_filho
for each row
execute function private.normalizar_nome_filho_interno();

update public.t_filho
set nome = upper(btrim(nome))
where nome is distinct from upper(btrim(nome));
