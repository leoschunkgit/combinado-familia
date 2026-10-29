create or replace function private.normalizar_nome_pessoa_maiusculo_interno()
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
drop trigger if exists normalizar_nome_pessoa_before_write on public.t_filho;
drop function if exists private.normalizar_nome_filho_interno();

create trigger normalizar_nome_pessoa_before_write
before insert or update of nome on public.t_filho
for each row
execute function private.normalizar_nome_pessoa_maiusculo_interno();

drop trigger if exists normalizar_nome_pessoa_before_write on public.t_usuario_pai;

create trigger normalizar_nome_pessoa_before_write
before insert or update of nome on public.t_usuario_pai
for each row
execute function private.normalizar_nome_pessoa_maiusculo_interno();

update public.t_filho
set nome = upper(btrim(nome))
where nome is distinct from upper(btrim(nome));

update public.t_usuario_pai
set nome = upper(btrim(nome))
where nome is distinct from upper(btrim(nome));

create or replace function public.cadastrar_filho_com_recompensas(
  p_nome text,
  p_idade integer default null::integer,
  p_cor text default null::text,
  p_avatar text default null::text,
  p_valor_mesada numeric default null::numeric,
  p_recompensas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_nome text;
  v_cor text;
  v_avatar text;
  v_item jsonb;
  v_nome_recompensa text;
  v_descricao_recompensa text;
  v_estrelas_texto text;
  v_estrelas integer;
  v_recompensa_id bigint;
  v_ids_recompensas jsonb := '[]'::jsonb;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then raise exception 'Responsável não encontrado'; end if;

  v_nome := upper(btrim(coalesce(p_nome, '')));
  v_cor := nullif(btrim(coalesce(p_cor, '')), '');
  v_avatar := nullif(btrim(coalesce(p_avatar, '')), '');

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then raise exception 'Informe o nome do filho'; end if;
  if p_idade is not null and (p_idade < 0 or p_idade > 150) then raise exception 'Informe uma idade inteira entre 0 e 150'; end if;
  if v_cor is not null and char_length(v_cor) > 50 then raise exception 'Use uma cor válida'; end if;
  if v_avatar is not null and v_avatar not in ('menino', 'menina') then raise exception 'Avatar inválido'; end if;
  if p_valor_mesada is not null and (p_valor_mesada <= 0 or p_valor_mesada > 9999999999.99) then raise exception 'Informe um valor de mesada válido'; end if;

  if p_recompensas is null then p_recompensas := '[]'::jsonb; end if;
  if jsonb_typeof(p_recompensas) <> 'array' then raise exception 'Lista de recompensas inválida'; end if;

  insert into public.t_filho (
    id_usuario_pai, nome, idade, tem_mesada, valor_mesada, cor, avatar
  ) values (
    v_pai_id, v_nome, p_idade, p_valor_mesada is not null, p_valor_mesada, v_cor, v_avatar
  )
  returning id into v_filho_id;

  for v_item in select value from jsonb_array_elements(p_recompensas)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Recompensa inválida'; end if;

    v_nome_recompensa := btrim(coalesce(v_item->>'nome', ''));
    v_descricao_recompensa := nullif(btrim(coalesce(v_item->>'descricao', '')), '');
    v_estrelas_texto := btrim(coalesce(v_item->>'estrelas_necessarias', ''));

    if char_length(v_nome_recompensa) < 2 or char_length(v_nome_recompensa) > 100 then raise exception 'Informe uma recompensa entre 2 e 100 caracteres'; end if;
    if v_descricao_recompensa is not null and char_length(v_descricao_recompensa) > 300 then raise exception 'A descrição da recompensa deve ter no máximo 300 caracteres'; end if;
    if v_estrelas_texto !~ '^[0-9]+$' then raise exception 'Informe uma quantidade válida de estrelas'; end if;

    v_estrelas := v_estrelas_texto::integer;
    if v_estrelas < 1 or v_estrelas > 100000 then raise exception 'Informe uma quantidade válida de estrelas'; end if;

    v_recompensa_id := public.salvar_recompensa_estrelas(
      v_filho_id, v_nome_recompensa, coalesce(v_descricao_recompensa, ''), v_estrelas, null
    );

    v_ids_recompensas := v_ids_recompensas || jsonb_build_array(v_recompensa_id);
  end loop;

  return jsonb_build_object(
    'id', v_filho_id,
    'nome', v_nome,
    'cor', v_cor,
    'avatar', v_avatar,
    'qtd_recompensas', jsonb_array_length(v_ids_recompensas),
    'recompensas_ids', v_ids_recompensas
  );
end;
$function$;
