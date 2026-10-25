
revoke execute on function public.concluir_onboarding_ao_atribuir() from service_role;
revoke execute on function public.existe_filho_sem_mesada_no_limite(bigint) from service_role;

revoke execute on function public.guard_assignment_history() from anon, authenticated, service_role;
revoke execute on function public.guard_nao_fez_limit() from anon, authenticated, service_role;
revoke execute on function public.guard_occurrence_active_validity() from anon, authenticated, service_role;
revoke execute on function public.guard_validity_history() from anon, authenticated, service_role;
revoke execute on function public.guard_validity_overlap() from anon, authenticated, service_role;

revoke execute on function public.guard_mesada_assignment() from anon, authenticated, service_role;
revoke execute on function public.guard_mesada_child() from anon, authenticated, service_role;
revoke execute on function public.guard_mesada_validity() from anon, authenticated, service_role;

revoke execute on function public.handle_new_auth_user() from anon, authenticated, service_role;
revoke execute on function public.proteger_admin_master() from service_role;
revoke execute on function public.recalcular_estado_atribuicao(bigint) from service_role;
revoke execute on function public.recalcular_estado_atribuicao_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_estado_por_regra_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_penalidade_por_atribuicao_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_penalidade_por_filho_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_penalidade_por_ocorrencia_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_penalidade_por_vigencia_trigger() from anon, authenticated, service_role;
revoke execute on function public.recalcular_penalidade_vigencia(bigint) from service_role;
revoke execute on function public.sinalizar_app_config() from anon, authenticated, service_role;
revoke execute on function public.touch_filho_acesso_publico_updated_at() from anon, authenticated, service_role;
