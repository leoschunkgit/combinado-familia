
-- Consolida permissões EXECUTE das funções públicas no estado auditado DEV/PRD.
-- O objetivo é evitar permissões implícitas/legadas e preservar apenas os papéis necessários.

-- Funções chamadas pelo usuário autenticado.
revoke all on function public.admin_adicionar(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_adicionar(text) to authenticated;

revoke all on function public.admin_auditoria_listar(integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_auditoria_listar(integer) to authenticated;

revoke all on function public.admin_comunicacao_salvar(boolean,text,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_comunicacao_salvar(boolean,text,boolean,text) to authenticated;

revoke all on function public.admin_config_salvar(boolean,text,boolean,text,text,integer,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_config_salvar(boolean,text,boolean,text,text,integer,text,integer) to authenticated;

revoke all on function public.admin_definir_status(bigint,boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_definir_status(bigint,boolean) to authenticated;

revoke all on function public.admin_diagnostico(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_diagnostico(text,integer) to authenticated;

revoke all on function public.admin_feature_salvar(text,text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_feature_salvar(text,text,text,boolean) to authenticated;

revoke all on function public.admin_feedback_excluir(bigint) from public, anon, authenticated, service_role;
grant execute on function public.admin_feedback_excluir(bigint) to authenticated;

revoke all on function public.admin_feedbacks(integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_feedbacks(integer) to authenticated;

revoke all on function public.admin_listar_admins() from public, anon, authenticated, service_role;
grant execute on function public.admin_listar_admins() to authenticated;

revoke all on function public.admin_operacao() from public, anon, authenticated, service_role;
grant execute on function public.admin_operacao() to authenticated;

revoke all on function public.admin_registrar_acesso() from public, anon, authenticated, service_role;
grant execute on function public.admin_registrar_acesso() to authenticated;

revoke all on function public.admin_resumo() from public, anon, authenticated, service_role;
grant execute on function public.admin_resumo() to authenticated;

revoke all on function public.admin_sistema_obter() from public, anon, authenticated, service_role;
grant execute on function public.admin_sistema_obter() to authenticated;

revoke all on function public.admin_usuarios() from public, anon, authenticated, service_role;
grant execute on function public.admin_usuarios() to authenticated;

revoke all on function public.admin_versoes_salvar(text,integer,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_versoes_salvar(text,integer,text,integer) to authenticated;

revoke all on function public.app_config_publico() from public, anon, authenticated, service_role;
grant execute on function public.app_config_publico() to authenticated;

revoke all on function public.current_admin_id() from public, anon, authenticated, service_role;
grant execute on function public.current_admin_id() to authenticated;

revoke all on function public.current_pai_id() from public, anon, authenticated, service_role;
grant execute on function public.current_pai_id() to authenticated;

revoke all on function public.desativar_acesso_publico_filho(bigint) from public, anon, authenticated, service_role;
grant execute on function public.desativar_acesso_publico_filho(bigint) to authenticated;

revoke all on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamptz,timestamptz,text,integer,numeric) from public, anon, authenticated, service_role;
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamptz,timestamptz,text,integer,numeric) to authenticated;

revoke all on function public.enviar_feedback(text,text,text,text,text,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.enviar_feedback(text,text,text,text,text,integer,text) to authenticated;

revoke all on function public.excluir_vigencia_com_regra(bigint) from public, anon, authenticated, service_role;
grant execute on function public.excluir_vigencia_com_regra(bigint) to authenticated;

revoke all on function public.gerar_acesso_publico_filho(bigint) from public, anon, authenticated, service_role;
grant execute on function public.gerar_acesso_publico_filho(bigint) to authenticated;

revoke all on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.obter_acesso_publico_filho(bigint) from public, anon, authenticated, service_role;
grant execute on function public.obter_acesso_publico_filho(bigint) to authenticated;

revoke all on function public.regenerar_acesso_publico_filho(bigint) from public, anon, authenticated, service_role;
grant execute on function public.regenerar_acesso_publico_filho(bigint) to authenticated;

revoke all on function public.registrar_nao_fez_com_penalidade(bigint,timestamptz,bigint,text) from public, anon, authenticated, service_role;
grant execute on function public.registrar_nao_fez_com_penalidade(bigint,timestamptz,bigint,text) to authenticated;

revoke all on function public.registrar_telemetria_app(text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.registrar_telemetria_app(text,text,integer) to authenticated;

-- Exceção pública intencional: painel do filho por token UUID ativo.
revoke all on function public.obter_painel_publico_filho(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_painel_publico_filho(uuid) to anon, authenticated;

-- Funções internas/trigger: sem execução direta pela API.
revoke all on function public.admin_auditar(text,text,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.concluir_onboarding_ao_atribuir() from public, anon, authenticated, service_role;
revoke all on function public.existe_filho_sem_mesada_no_limite(bigint) from public, anon, authenticated, service_role;
revoke all on function public.guard_assignment_history() from public, anon, authenticated, service_role;
revoke all on function public.guard_nao_fez_limit() from public, anon, authenticated, service_role;
revoke all on function public.guard_occurrence_active_validity() from public, anon, authenticated, service_role;
revoke all on function public.guard_validity_history() from public, anon, authenticated, service_role;
revoke all on function public.guard_validity_overlap() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;
revoke all on function public.proteger_admin_master() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_estado_atribuicao(bigint) from public, anon, authenticated, service_role;
revoke all on function public.recalcular_estado_atribuicao_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_estado_por_regra_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_penalidade_por_atribuicao_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_penalidade_por_filho_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_penalidade_por_ocorrencia_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_penalidade_por_vigencia_trigger() from public, anon, authenticated, service_role;
revoke all on function public.recalcular_penalidade_vigencia(bigint) from public, anon, authenticated, service_role;
revoke all on function public.sinalizar_app_config() from public, anon, authenticated, service_role;
revoke all on function public.touch_filho_acesso_publico_updated_at() from public, anon, authenticated, service_role;
