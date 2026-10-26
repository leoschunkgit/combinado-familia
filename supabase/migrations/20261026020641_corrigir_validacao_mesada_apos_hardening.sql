alter function public.validar_mesada_filho_vigencia_interno()
  security definer;

revoke all
on function public.validar_mesada_filho_vigencia_interno()
from public, anon, authenticated, service_role;

comment on function public.validar_mesada_filho_vigencia_interno() is
'Trigger interno de validação da mesada. SECURITY DEFINER para consultar o helper interno de descontos sem expor esse helper como RPC a authenticated.';
