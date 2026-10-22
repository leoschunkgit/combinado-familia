revoke all on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) from public, anon, authenticated, service_role;
grant execute on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) to authenticated;

revoke all on function public.desfazer_ocorrencias(bigint[])
  from public, anon, authenticated, service_role;
grant execute on function public.desfazer_ocorrencias(bigint[])
  to authenticated;

revoke all on function public.resolver_revisao_tarefa_filho(bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolver_revisao_tarefa_filho(bigint,text)
  to authenticated;

revoke all on function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text)
  to service_role;

revoke all on function public.sincronizar_estrela_ocorrencia_interno(bigint,bigint)
  from public, anon, authenticated, service_role;

revoke all on function public.reconciliar_recompensas_estrelas_filho_interno(bigint,bigint)
  from public, anon, authenticated, service_role;
