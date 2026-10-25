
revoke execute on function public.desativar_acesso_publico_filho(bigint) from anon, service_role;
revoke execute on function public.gerar_acesso_publico_filho(bigint) from anon, service_role;
revoke execute on function public.obter_acesso_publico_filho(bigint) from anon, service_role;
revoke execute on function public.regenerar_acesso_publico_filho(bigint) from anon, service_role;
revoke execute on function public.obter_painel_publico_filho(uuid) from service_role;
