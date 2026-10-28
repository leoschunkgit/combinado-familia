create index if not exists idx_vigencia_automacao_estado_vigencia
  on private.t_vigencia_automacao_estado(id_vigencia_referencia);

create index if not exists idx_vigencia_automacao_ciclo_pai
  on private.t_vigencia_automacao_ciclo(id_usuario_pai);
