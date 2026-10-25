
alter table public.t_ocorrencia
  add constraint t_ocorrencia_pai_id_uniq
  unique (id_usuario_pai, id);

alter table public.t_ocorrencia_consequencia
  add constraint t_ocorrencia_consequencia_mesmo_pai_fk
  foreign key (id_usuario_pai, id_ocorrencia)
  references public.t_ocorrencia (id_usuario_pai, id)
  on delete cascade;
