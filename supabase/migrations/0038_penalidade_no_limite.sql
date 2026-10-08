-- 0038 - Penalidade da vigência informada somente quando o limite de "Não fez" for atingido.
-- Mantém a regra atual de limite e a regra de mesada sem alterações.
-- Preserva penalidades históricas e penalidades de vigências em andamento que já atingiram o limite.
-- Limpa apenas penalidades preenchidas antecipadamente em vigências futuras ou ainda abaixo do limite.

alter table public.t_vigencia
  alter column penalidade drop not null;

update public.t_vigencia v
set penalidade = null
where v.penalidade is not null
  and btrim(v.penalidade) <> ''
  and v.data_fim >= now()
  and (
    v.data_inicio > now()
    or not exists (
      select 1
      from public.t_filho_tarefa ft
      join public.t_filho f
        on f.id = ft.id_filho
       and f.id_usuario_pai = ft.id_usuario_pai
      where ft.id_vigencia = v.id
        and not (
          f.tem_mesada_opcional is true
          and f.valor_mesada is not null
          and v.valor_debito is not null
        )
      group by ft.id_filho
      having (
        select count(*)
        from public.t_ocorrencia o
        join public.t_filho_tarefa ft2
          on ft2.id = o.id_filho_tarefa
        where ft2.id_vigencia = v.id
          and ft2.id_filho = ft.id_filho
          and o.tipo <> 'FEZ'
      ) >= v.qtd_ocorrencia
    )
  );

comment on column public.t_vigencia.penalidade is
  'Penalidade escrita aplicada quando um filho sem mesada atinge o limite de Não fez da vigência.';
