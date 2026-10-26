create or replace function public.mensagem_codigo_regra_interno(p_codigo text)
returns text
language sql
immutable
security definer
set search_path to ''
as $function$
  select case p_codigo
    when 'ORIGEM_CONFIRMACAO_INVALIDA' then 'Origem de confirmação inválida'
    when 'RECOMPENSA_INVALIDA' then 'Esta recompensa não está disponível'
    when 'RECOMPENSA_INDISPONIVEL' then 'Esta recompensa não está disponível para conclusão agora'
    when 'SESSAO_INVALIDA' then 'Este acesso não está mais ativo'
    when 'TAREFA_INVALIDA' then 'Esta tarefa não pertence a este acesso'
    when 'OBSERVACAO_INVALIDA' then 'A observação deve ter no máximo 120 caracteres'
    when 'VIGENCIA_INATIVA' then 'Só é possível avisar durante a vigência em andamento'
    when 'JA_MARCADA' then 'O responsável já marcou esta tarefa hoje'
    when 'CHAVE_INVALIDA' then 'Chave inválida ou expirada. Peça uma nova chave ao seu responsável'
    when 'REQUISICAO_INVALIDA' then 'Dados inválidos para esta operação'
    when 'BLOQUEADO' then 'Muitas tentativas inválidas. Aguarde antes de tentar novamente'
    else 'Não foi possível concluir a operação. Tente novamente.'
  end
$function$;

revoke all
on function public.mensagem_codigo_regra_interno(text)
from public, anon, authenticated;

grant execute
on function public.mensagem_codigo_regra_interno(text)
to service_role;

create or replace function public.confirmar_recompensa_aproveitada(p_id_recompensa bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
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

  return v_resultado || jsonb_build_object(
    'mensagem',
    public.mensagem_codigo_regra_interno(v_resultado->>'codigo')
  );
end;
$function$;
