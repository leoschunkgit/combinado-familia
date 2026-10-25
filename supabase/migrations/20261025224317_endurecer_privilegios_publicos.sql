
-- Privilégios de DDL/estrutura nunca são necessários ao cliente.
revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger on tables
from anon, authenticated;

-- Tabelas internas não precisam ser visíveis ao usuário anônimo.
revoke select
on table public.t_ocorrencia_consequencia
from anon;

revoke select
on table public.t_ocorrencia_reconciliacao
from anon;

-- Restringe as policies internas ao papel autenticado.
alter policy ocorrencia_consequencia_select_own
on public.t_ocorrencia_consequencia
to authenticated;

alter policy ocorrencia_reconciliacao_select_own
on public.t_ocorrencia_reconciliacao
to authenticated;

-- Helper interno: triggers/RPCs privilegiados continuam podendo usá-lo,
-- mas ele deixa de ser uma RPC pública para usuários autenticados.
revoke execute
on function public.total_descontos_aplicados_filho_vigencia_interno(bigint,bigint,bigint,bigint)
from authenticated;
