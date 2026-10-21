export type RecompensaEstrelaResumo = {
  id: number;
  nome: string;
  descricao: string | null;
  nome_exibicao: string;
  descricao_exibicao: string | null;
  estrelas_necessarias: number;
  progresso: number;
  faltam: number;
  disponivel: boolean;
  pendente: boolean;
  conquistada: boolean;
  meta_exibicao: number;
  progresso_exibicao: number;
  faltam_exibicao: number;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_desativar: boolean;
  pode_confirmar_aproveitada: boolean;
  marco_estrelas: number;
  conquista_id?: number | null;
  conquista_nome?: string | null;
  conquista_descricao?: string | null;
  conquista_meta?: number | null;
};

export type CicloRecompensaResumo = {
  id: number;
  id_recompensa: number | null;
  status: "PENDENTE" | "ENTREGUE" | "CANCELADO";

  // Contrato semantico para apresentacao.
  nome_exibicao: string;
  descricao_exibicao: string | null;
  quantidade_estrelas_conquista: number;
  conquistou_em: string;
  aproveitou_em: string | null;
  contagem_recomecou_em: string | null;
  confirmado_por: "FILHO" | "RESPONSAVEL" | null;

  // Snapshot tecnico preservado para auditoria e compatibilidade.
  recompensa_nome: string;
  recompensa_descricao_no_resgate: string | null;
  estrelas_utilizadas: number;
  meta_estrelas_no_resgate: number;
  total_estrelas_no_resgate: number | null;
  created_at: string;
  entregue_em: string | null;
  cancelado_em: string | null;
};

export type ResumoEstrelas = {
  hoje: number;
  vigencia_atual: number;
  total_conquistado: number;
  recompensas: RecompensaEstrelaResumo[];
  resgates: CicloRecompensaResumo[];
};

export const resumoEstrelasVazio: ResumoEstrelas = {
  hoje: 0,
  vigencia_atual: 0,
  total_conquistado: 0,
  recompensas: [],
  resgates: [],
};
