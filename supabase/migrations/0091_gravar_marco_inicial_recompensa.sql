-- 0091 - Garante que toda recompensa nova grave explicitamente seu marco inicial.
-- A 0090 criou a coluna/regra central; esta função é a única porta pública de criação/edição
-- e passa a capturar o total permanente de estrelas na mesma transação da criação.

create or replace function public.salvar_recompensa_estrelas(
  p_id_filho bigint,
  p_nome text,
  p_descricao text,
  p_estrelas_necessarias integer,
  p_id_recompensa bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_id bigint;
  v_nome text;
  v_descricao text;
  v_marco_inicial integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then raise exception 'Responsável não encontrado'; end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = v_pai_id
  for update;

  if not found then raise exception 'Filho não encontrado para este responsável'; end if;

  v_nome := btrim(coalesce(p_nome, ''));
  v_descricao := nullif(btrim(coalesce(p_descricao, '')), '');

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then
    raise exception 'Informe uma recompensa entre 2 e 100 caracteres';
  end if;
  if v_descricao is not null and char_length(v_descricao) > 300 then
    raise exception 'A descrição da recompensa deve ter no máximo 300 caracteres';
  end if;
  if p_estrelas_necessarias is null or p_estrelas_necessarias < 1 or p_estrelas_necessarias > 100000 then
    raise exception 'Informe uma quantidade válida de estrelas';
  end if;

  if p_id_recompensa is null then
    v_marco_inicial := public.estrelas_total_conquistado_interno(
      v_pai_id,
      p_id_filho
    );

    insert into public.t_recompensa_estrela (
      id_usuario_pai,
      id_filho,
      nome,
      descricao,
      estrelas_necessarias,
      marco_inicial_estrelas,
      ativo
    )
    values (
      v_pai_id,
      p_id_filho,
      v_nome,
      v_descricao,
      p_estrelas_necessarias,
      v_marco_inicial,
      true
    )
    returning id into v_id;
  else
    update public.t_recompensa_estrela
    set nome = v_nome,
        descricao = v_descricao,
        estrelas_necessarias = p_estrelas_necessarias,
        updated_at = now()
    where id = p_id_recompensa
      and id_usuario_pai = v_pai_id
      and id_filho = p_id_filho
    returning id into v_id;

    if v_id is null then raise exception 'Recompensa não encontrada'; end if;
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    p_id_filho,
    v_id
  );

  return v_id;
end;
$function$;

revoke all on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint)
from public, anon, authenticated, service_role;

grant execute on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint)
to authenticated;

comment on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint) is
'Cria recompensa gravando o total atual de estrelas como marco inicial imutável; edições preservam esse marco.';
