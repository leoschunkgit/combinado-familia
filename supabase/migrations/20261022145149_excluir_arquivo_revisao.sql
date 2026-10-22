-- Remoção do histórico de revisão autorizada pelo responsável pelo projeto.
lock table arquivo_interno.registros_retirados in access exclusive mode;
do $guard$
begin
  if exists (select 1 from arquivo_interno.registros_retirados where recurso <> 'revisao') then
    raise exception 'Arquivo contém dados de outro recurso; remoção cancelada';
  end if;
end;
$guard$;
drop table arquivo_interno.registros_retirados;
drop schema arquivo_interno;
