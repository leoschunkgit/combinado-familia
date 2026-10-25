export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_cron_config: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      t_admin: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          id_usuario_pai: number
          nivel: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_usuario_pai: number
          nivel?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_usuario_pai?: number
          nivel?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_admin_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: true
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_admin_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string | null
          id: number
          id_admin: number
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade: string
          entidade_id?: string | null
          id?: number
          id_admin: number
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string
          entidade_id?: string | null
          id?: number
          id_admin?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_admin_auditoria_id_admin_fkey"
            columns: ["id_admin"]
            isOneToOne: false
            referencedRelation: "t_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      t_app_config: {
        Row: {
          android_min_version_code: number | null
          android_min_version_name: string | null
          id: number
          ios_min_version_code: number | null
          ios_min_version_name: string | null
          manutencao_ativa: boolean
          manutencao_mensagem: string | null
          mensagem_global: string | null
          mensagem_global_ativa: boolean
          updated_at: string
          updated_by_admin_id: number | null
        }
        Insert: {
          android_min_version_code?: number | null
          android_min_version_name?: string | null
          id?: number
          ios_min_version_code?: number | null
          ios_min_version_name?: string | null
          manutencao_ativa?: boolean
          manutencao_mensagem?: string | null
          mensagem_global?: string | null
          mensagem_global_ativa?: boolean
          updated_at?: string
          updated_by_admin_id?: number | null
        }
        Update: {
          android_min_version_code?: number | null
          android_min_version_name?: string | null
          id?: number
          ios_min_version_code?: number | null
          ios_min_version_name?: string | null
          manutencao_ativa?: boolean
          manutencao_mensagem?: string | null
          mensagem_global?: string | null
          mensagem_global_ativa?: boolean
          updated_at?: string
          updated_by_admin_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_app_config_updated_by_admin_id_fkey"
            columns: ["updated_by_admin_id"]
            isOneToOne: false
            referencedRelation: "t_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      t_app_config_signal: {
        Row: {
          id: number
          updated_at: string
          versao: number
        }
        Insert: {
          id?: number
          updated_at?: string
          versao?: number
        }
        Update: {
          id?: number
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      t_app_feature_flag: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          descricao: string | null
          nome: string
          updated_at: string
          updated_by_admin_id: number | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          descricao?: string | null
          nome: string
          updated_at?: string
          updated_by_admin_id?: number | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          descricao?: string | null
          nome?: string
          updated_at?: string
          updated_by_admin_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_app_feature_flag_updated_by_admin_id_fkey"
            columns: ["updated_by_admin_id"]
            isOneToOne: false
            referencedRelation: "t_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      t_app_telemetria: {
        Row: {
          first_seen_at: string
          id: number
          id_usuario_pai: number
          last_seen_at: string
          plataforma: string
          updated_at: string
          version_code: number | null
          version_name: string | null
        }
        Insert: {
          first_seen_at?: string
          id?: number
          id_usuario_pai: number
          last_seen_at?: string
          plataforma: string
          updated_at?: string
          version_code?: number | null
          version_name?: string | null
        }
        Update: {
          first_seen_at?: string
          id?: number
          id_usuario_pai?: number
          last_seen_at?: string
          plataforma?: string
          updated_at?: string
          version_code?: number | null
          version_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_app_telemetria_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: true
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_estrela_concessao: {
        Row: {
          created_at: string
          data_referencia: string
          id: number
          id_filho: number
          id_filho_tarefa_origem: number
          id_ocorrencia_origem: number
          id_tarefa: number
          id_usuario_pai: number
          id_vigencia: number
          tarefa_nome_snapshot: string | null
        }
        Insert: {
          created_at?: string
          data_referencia: string
          id?: number
          id_filho: number
          id_filho_tarefa_origem: number
          id_ocorrencia_origem: number
          id_tarefa: number
          id_usuario_pai: number
          id_vigencia: number
          tarefa_nome_snapshot?: string | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: number
          id_filho?: number
          id_filho_tarefa_origem?: number
          id_ocorrencia_origem?: number
          id_tarefa?: number
          id_usuario_pai?: number
          id_vigencia?: number
          tarefa_nome_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_estrela_concessao_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_estrela_concessao_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_estrela_concessao_same_pai_filho_fk"
            columns: ["id_usuario_pai", "id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_estrela_movimento: {
        Row: {
          created_at: string
          data_referencia: string | null
          descricao: string | null
          id: number
          id_filho: number
          id_ocorrencia: number | null
          id_resgate: number | null
          id_tarefa: number | null
          id_usuario_pai: number
          id_vigencia: number | null
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string
          data_referencia?: string | null
          descricao?: string | null
          id?: number
          id_filho: number
          id_ocorrencia?: number | null
          id_resgate?: number | null
          id_tarefa?: number | null
          id_usuario_pai: number
          id_vigencia?: number | null
          quantidade: number
          tipo: string
        }
        Update: {
          created_at?: string
          data_referencia?: string | null
          descricao?: string | null
          id?: number
          id_filho?: number
          id_ocorrencia?: number | null
          id_resgate?: number | null
          id_tarefa?: number | null
          id_usuario_pai?: number
          id_vigencia?: number | null
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_estrela_movimento_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_estrela_movimento_id_tarefa_fkey"
            columns: ["id_tarefa"]
            isOneToOne: false
            referencedRelation: "t_tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_estrela_movimento_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_estrela_movimento_id_vigencia_fkey"
            columns: ["id_vigencia"]
            isOneToOne: false
            referencedRelation: "t_vigencia"
            referencedColumns: ["id"]
          },
        ]
      }
      t_feedback: {
        Row: {
          assunto: string
          created_at: string
          id: number
          id_usuario_pai: number
          mensagem: string
          pagina_origem: string | null
          plataforma: string
          tipo: string
          version_code: number | null
          version_name: string | null
        }
        Insert: {
          assunto: string
          created_at?: string
          id?: number
          id_usuario_pai: number
          mensagem: string
          pagina_origem?: string | null
          plataforma: string
          tipo: string
          version_code?: number | null
          version_name?: string | null
        }
        Update: {
          assunto?: string
          created_at?: string
          id?: number
          id_usuario_pai?: number
          mensagem?: string
          pagina_origem?: string | null
          plataforma?: string
          tipo?: string
          version_code?: number | null
          version_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_feedback_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_filho: {
        Row: {
          avatar: string | null
          celular: string | null
          cor: string | null
          created_at: string
          email: string | null
          id: number
          id_usuario_pai: number
          idade: number | null
          nome: string
          tem_mesada: boolean
          tem_mesada_opcional: boolean | null
          valor_mesada: number | null
        }
        Insert: {
          avatar?: string | null
          celular?: string | null
          cor?: string | null
          created_at?: string
          email?: string | null
          id?: never
          id_usuario_pai?: number
          idade?: number | null
          nome: string
          tem_mesada?: boolean
          tem_mesada_opcional?: boolean | null
          valor_mesada?: number | null
        }
        Update: {
          avatar?: string | null
          celular?: string | null
          cor?: string | null
          created_at?: string
          email?: string | null
          id?: never
          id_usuario_pai?: number
          idade?: number | null
          nome?: string
          tem_mesada?: boolean
          tem_mesada_opcional?: boolean | null
          valor_mesada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_filho_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_filho_acesso_app: {
        Row: {
          ativo: boolean
          created_at: string
          dispositivo_id: string
          dispositivo_nome: string | null
          id: number
          id_filho: number
          id_usuario_pai: number
          revogado_em: string | null
          token_hash: string
          ultimo_acesso_em: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dispositivo_id?: string
          dispositivo_nome?: string | null
          id?: number
          id_filho: number
          id_usuario_pai: number
          revogado_em?: string | null
          token_hash: string
          ultimo_acesso_em?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dispositivo_id?: string
          dispositivo_nome?: string | null
          id?: number
          id_filho?: number
          id_usuario_pai?: number
          revogado_em?: string | null
          token_hash?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_filho_acesso_app_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_acesso_app_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_filho_acesso_app_chave: {
        Row: {
          ativo: boolean
          chave_hash: string
          created_at: string
          expira_em: string
          id: number
          id_filho: number
          id_usuario_pai: number
          max_tentativas: number
          tentativas: number
          updated_at: string
          usado_em: string | null
        }
        Insert: {
          ativo?: boolean
          chave_hash: string
          created_at?: string
          expira_em: string
          id?: number
          id_filho: number
          id_usuario_pai: number
          max_tentativas?: number
          tentativas?: number
          updated_at?: string
          usado_em?: string | null
        }
        Update: {
          ativo?: boolean
          chave_hash?: string
          created_at?: string
          expira_em?: string
          id?: number
          id_filho?: number
          id_usuario_pai?: number
          max_tentativas?: number
          tentativas?: number
          updated_at?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_filho_acesso_app_chave_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_acesso_app_chave_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_filho_acesso_app_tentativa: {
        Row: {
          bloqueado_ate: string | null
          falhas: number
          identificador_hash: string
          janela_inicio: string
          updated_at: string
        }
        Insert: {
          bloqueado_ate?: string | null
          falhas?: number
          identificador_hash: string
          janela_inicio?: string
          updated_at?: string
        }
        Update: {
          bloqueado_ate?: string | null
          falhas?: number
          identificador_hash?: string
          janela_inicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      t_filho_acesso_publico: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          id_filho: number
          id_usuario_pai: number
          token: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_filho: number
          id_usuario_pai: number
          token?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_filho?: number
          id_usuario_pai?: number
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_filho_acesso_publico_same_family_fk"
            columns: ["id_usuario_pai", "id_filho"]
            isOneToOne: true
            referencedRelation: "t_filho"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_filho_tarefa: {
        Row: {
          created_at: string
          id: number
          id_filho: number
          id_tarefa: number
          id_usuario_pai: number
          id_vigencia: number
        }
        Insert: {
          created_at?: string
          id?: never
          id_filho: number
          id_tarefa: number
          id_usuario_pai?: number
          id_vigencia: number
        }
        Update: {
          created_at?: string
          id?: never
          id_filho?: number
          id_tarefa?: number
          id_usuario_pai?: number
          id_vigencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_filho_tarefa_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_id_tarefa_fkey"
            columns: ["id_tarefa"]
            isOneToOne: false
            referencedRelation: "t_tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_id_vigencia_fkey"
            columns: ["id_vigencia"]
            isOneToOne: false
            referencedRelation: "t_vigencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_same_pai_filho_fk"
            columns: ["id_usuario_pai", "id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id_usuario_pai", "id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_same_pai_tarefa_fk"
            columns: ["id_usuario_pai", "id_tarefa"]
            isOneToOne: false
            referencedRelation: "t_tarefa"
            referencedColumns: ["id_usuario_pai", "id"]
          },
          {
            foreignKeyName: "t_filho_tarefa_same_pai_vigencia_fk"
            columns: ["id_usuario_pai", "id_vigencia"]
            isOneToOne: false
            referencedRelation: "t_vigencia"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_ocorrencia: {
        Row: {
          created_at: string
          id: number
          id_filho_tarefa: number
          id_usuario_pai: number
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: never
          id_filho_tarefa: number
          id_usuario_pai?: number
          tipo: string
        }
        Update: {
          created_at?: string
          id?: never
          id_filho_tarefa?: number
          id_usuario_pai?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_ocorrencia_id_filho_tarefa_fkey"
            columns: ["id_filho_tarefa"]
            isOneToOne: false
            referencedRelation: "t_filho_tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_ocorrencia_same_pai_assignment_fk"
            columns: ["id_usuario_pai", "id_filho_tarefa"]
            isOneToOne: false
            referencedRelation: "t_filho_tarefa"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_ocorrencia_consequencia: {
        Row: {
          cancelada_em: string | null
          created_at: string
          cumprida_em: string | null
          desconto_valor: number | null
          id: number
          id_ocorrencia: number
          id_usuario_pai: number
          penalidade_descricao: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cancelada_em?: string | null
          created_at?: string
          cumprida_em?: string | null
          desconto_valor?: number | null
          id?: number
          id_ocorrencia: number
          id_usuario_pai: number
          penalidade_descricao?: string | null
          status: string
          tipo: string
          updated_at?: string
        }
        Update: {
          cancelada_em?: string | null
          created_at?: string
          cumprida_em?: string | null
          desconto_valor?: number | null
          id?: number
          id_ocorrencia?: number
          id_usuario_pai?: number
          penalidade_descricao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_ocorrencia_consequencia_id_ocorrencia_fkey"
            columns: ["id_ocorrencia"]
            isOneToOne: true
            referencedRelation: "t_ocorrencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_ocorrencia_consequencia_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_ocorrencia_consequencia_mesmo_pai_fk"
            columns: ["id_usuario_pai", "id_ocorrencia"]
            isOneToOne: false
            referencedRelation: "t_ocorrencia"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_ocorrencia_reconciliacao: {
        Row: {
          acao: string
          created_at: string
          estado_anterior: Json | null
          estado_novo: Json | null
          id: number
          id_filho_tarefa: number
          id_ocorrencia: number | null
          id_usuario_pai: number
          motivo: string | null
          origem: string
        }
        Insert: {
          acao: string
          created_at?: string
          estado_anterior?: Json | null
          estado_novo?: Json | null
          id?: number
          id_filho_tarefa: number
          id_ocorrencia?: number | null
          id_usuario_pai: number
          motivo?: string | null
          origem?: string
        }
        Update: {
          acao?: string
          created_at?: string
          estado_anterior?: Json | null
          estado_novo?: Json | null
          id?: number
          id_filho_tarefa?: number
          id_ocorrencia?: number | null
          id_usuario_pai?: number
          motivo?: string | null
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_ocorrencia_reconciliacao_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_push_dispositivo: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          id_usuario_pai: number
          plataforma: string
          token: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_usuario_pai: number
          plataforma: string
          token: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_usuario_pai?: number
          plataforma?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_push_dispositivo_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_push_dispositivo_filho: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          id_acesso_app_filho: number
          id_filho: number
          id_usuario_pai: number
          plataforma: string
          token: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_acesso_app_filho: number
          id_filho: number
          id_usuario_pai: number
          plataforma: string
          token: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          id_acesso_app_filho?: number
          id_filho?: number
          id_usuario_pai?: number
          plataforma?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_push_dispositivo_filho_id_acesso_app_filho_fkey"
            columns: ["id_acesso_app_filho"]
            isOneToOne: false
            referencedRelation: "t_filho_acesso_app"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_dispositivo_filho_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_dispositivo_filho_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_push_envio: {
        Row: {
          created_at: string
          data_referencia: string
          id: number
          id_filho: number
          id_push_dispositivo: number
          id_usuario_pai: number
          janela_envio: string
          qtd_pendencias: number
        }
        Insert: {
          created_at?: string
          data_referencia: string
          id?: number
          id_filho: number
          id_push_dispositivo: number
          id_usuario_pai: number
          janela_envio?: string
          qtd_pendencias: number
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: number
          id_filho?: number
          id_push_dispositivo?: number
          id_usuario_pai?: number
          janela_envio?: string
          qtd_pendencias?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_push_envio_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_envio_id_push_dispositivo_fkey"
            columns: ["id_push_dispositivo"]
            isOneToOne: false
            referencedRelation: "t_push_dispositivo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_envio_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_push_envio_filho: {
        Row: {
          created_at: string
          data_referencia: string
          id: number
          id_filho: number
          id_push_dispositivo_filho: number
          id_usuario_pai: number
          janela_envio: string
          qtd_pendencias: number
        }
        Insert: {
          created_at?: string
          data_referencia: string
          id?: number
          id_filho: number
          id_push_dispositivo_filho: number
          id_usuario_pai: number
          janela_envio: string
          qtd_pendencias: number
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: number
          id_filho?: number
          id_push_dispositivo_filho?: number
          id_usuario_pai?: number
          janela_envio?: string
          qtd_pendencias?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_push_envio_filho_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_envio_filho_id_push_dispositivo_filho_fkey"
            columns: ["id_push_dispositivo_filho"]
            isOneToOne: false
            referencedRelation: "t_push_dispositivo_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_envio_filho_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_push_resposta_filho: {
        Row: {
          created_at: string
          id: number
          id_filho: number
          id_interacao: number
          id_usuario_pai: number
          notificacoes_enviadas: number
          status_resposta: string
          tipo_interacao: string
        }
        Insert: {
          created_at?: string
          id?: number
          id_filho: number
          id_interacao: number
          id_usuario_pai: number
          notificacoes_enviadas: number
          status_resposta: string
          tipo_interacao: string
        }
        Update: {
          created_at?: string
          id?: number
          id_filho?: number
          id_interacao?: number
          id_usuario_pai?: number
          notificacoes_enviadas?: number
          status_resposta?: string
          tipo_interacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_push_resposta_filho_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_push_resposta_filho_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_recompensa_estrela: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          estrelas_necessarias: number
          id: number
          id_filho: number
          id_usuario_pai: number
          marco_inicial_estrelas: number
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estrelas_necessarias: number
          id?: number
          id_filho: number
          id_usuario_pai: number
          marco_inicial_estrelas: number
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estrelas_necessarias?: number
          id?: number
          id_filho?: number
          id_usuario_pai?: number
          marco_inicial_estrelas?: number
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_recompensa_estrela_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recompensa_estrela_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recompensa_estrela_same_pai_filho_fk"
            columns: ["id_usuario_pai", "id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_recompensa_resgate: {
        Row: {
          cancelado_em: string | null
          confirmado_por: string | null
          created_at: string
          entregue_em: string | null
          estrelas_utilizadas: number
          id: number
          id_filho: number
          id_recompensa: number | null
          id_usuario_pai: number
          meta_estrelas_no_resgate: number | null
          recompensa_descricao_no_resgate: string | null
          recompensa_nome: string
          status: string
          total_estrelas_no_resgate: number | null
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          entregue_em?: string | null
          estrelas_utilizadas: number
          id?: number
          id_filho: number
          id_recompensa?: number | null
          id_usuario_pai: number
          meta_estrelas_no_resgate?: number | null
          recompensa_descricao_no_resgate?: string | null
          recompensa_nome: string
          status?: string
          total_estrelas_no_resgate?: number | null
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          entregue_em?: string | null
          estrelas_utilizadas?: number
          id?: number
          id_filho?: number
          id_recompensa?: number | null
          id_usuario_pai?: number
          meta_estrelas_no_resgate?: number | null
          recompensa_descricao_no_resgate?: string | null
          recompensa_nome?: string
          status?: string
          total_estrelas_no_resgate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_recompensa_resgate_id_filho_fkey"
            columns: ["id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recompensa_resgate_id_recompensa_fkey"
            columns: ["id_recompensa"]
            isOneToOne: false
            referencedRelation: "t_recompensa_estrela"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recompensa_resgate_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recompensa_resgate_same_pai_filho_fk"
            columns: ["id_usuario_pai", "id_filho"]
            isOneToOne: false
            referencedRelation: "t_filho"
            referencedColumns: ["id_usuario_pai", "id"]
          },
        ]
      }
      t_solicitacao_tarefa_filho: {
        Row: {
          created_at: string
          data_referencia: string
          id: number
          id_filho_tarefa: number
          observacao: string | null
          resolvido_em: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_referencia: string
          id?: number
          id_filho_tarefa: number
          observacao?: string | null
          resolvido_em?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: number
          id_filho_tarefa?: number
          observacao?: string | null
          resolvido_em?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_solicitacao_tarefa_filho_id_filho_tarefa_fkey"
            columns: ["id_filho_tarefa"]
            isOneToOne: false
            referencedRelation: "t_filho_tarefa"
            referencedColumns: ["id"]
          },
        ]
      }
      t_tarefa: {
        Row: {
          arquivada_em: string | null
          ativo: boolean
          created_at: string
          id: number
          id_usuario_pai: number
          nome: string
        }
        Insert: {
          arquivada_em?: string | null
          ativo?: boolean
          created_at?: string
          id?: never
          id_usuario_pai?: number
          nome: string
        }
        Update: {
          arquivada_em?: string | null
          ativo?: boolean
          created_at?: string
          id?: never
          id_usuario_pai?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_tarefa_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
      t_usuario_pai: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: number
          nome: string
          onboarding_concluido: boolean
        }
        Insert: {
          auth_user_id?: string
          created_at?: string
          email: string
          id?: never
          nome: string
          onboarding_concluido?: boolean
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: never
          nome?: string
          onboarding_concluido?: boolean
        }
        Relationships: []
      }
      t_vigencia: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          id: number
          id_usuario_pai: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: never
          id_usuario_pai?: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: never
          id_usuario_pai?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_vigencia_id_usuario_pai_fkey"
            columns: ["id_usuario_pai"]
            isOneToOne: false
            referencedRelation: "t_usuario_pai"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      remover_tarefa_com_regra: {
        Args: { p_id_tarefa: number }
        Returns: string
      }
      remover_todas_tarefas_com_regra: {
        Args: never
        Returns: Json
      }
      admin_adicionar: { Args: { p_email: string }; Returns: number }
      admin_auditar: {
        Args: {
          p_acao: string
          p_detalhes?: Json
          p_entidade: string
          p_entidade_id?: string
        }
        Returns: undefined
      }
      admin_auditoria_listar: {
        Args: { p_limite?: number }
        Returns: {
          acao: string
          admin_email: string
          admin_id: number
          admin_nome: string
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string
          id: number
        }[]
      }
      admin_comunicacao_salvar: {
        Args: {
          p_manutencao_ativa: boolean
          p_manutencao_mensagem: string
          p_mensagem_global: string
          p_mensagem_global_ativa: boolean
        }
        Returns: Json
      }
      admin_config_salvar: {
        Args: {
          p_android_min_version_code: number
          p_android_min_version_name: string
          p_ios_min_version_code: number
          p_ios_min_version_name: string
          p_manutencao_ativa: boolean
          p_manutencao_mensagem: string
          p_mensagem_global: string
          p_mensagem_global_ativa: boolean
        }
        Returns: Json
      }
      admin_definir_status: {
        Args: { p_admin_id: number; p_ativo: boolean }
        Returns: boolean
      }
      admin_diagnostico: {
        Args: { p_version_code?: number; p_version_name?: string }
        Returns: Json
      }
      admin_feature_salvar: {
        Args: {
          p_ativo: boolean
          p_chave: string
          p_descricao: string
          p_nome: string
        }
        Returns: Json
      }
      admin_feedback_excluir: {
        Args: { p_feedback_id: number }
        Returns: boolean
      }
      admin_feedbacks: {
        Args: { p_limite?: number }
        Returns: {
          assunto: string
          created_at: string
          id: number
          id_usuario_pai: number
          mensagem: string
          pagina_origem: string
          plataforma: string
          tipo: string
          usuario_email: string
          usuario_nome: string
          version_code: number
          version_name: string
        }[]
      }
      admin_listar_admins: {
        Args: never
        Returns: {
          ativo: boolean
          created_at: string
          eh_atual: boolean
          email: string
          id: number
          id_usuario_pai: number
          nivel: string
          nome: string
          ultimo_acesso: string
        }[]
      }
      admin_limpar_dados_usuario: {
        Args: { p_email: string }
        Returns: Json
      }
      admin_localizar_usuario_limpeza: {
        Args: { p_email: string }
        Returns: Json
      }
      admin_operacao: { Args: never; Returns: Json }
      admin_registrar_acesso: { Args: never; Returns: undefined }
      admin_resumo: { Args: never; Returns: Json }
      admin_sistema_obter: { Args: never; Returns: Json }
      admin_usuarios: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: number
          nome: string
          onboarding_concluido: boolean
          qtd_atribuicoes: number
          qtd_filhos: number
          qtd_tarefas: number
          qtd_vigencias: number
          ultimo_movimento: string
        }[]
      }
      admin_versoes_salvar: {
        Args: {
          p_android_min_version_code: number
          p_android_min_version_name: string
          p_ios_min_version_code: number
          p_ios_min_version_name: string
        }
        Returns: Json
      }
      alterar_status_resgate_estrelas: {
        Args: { p_id_resgate: number; p_status: string }
        Returns: boolean
      }
      app_config_publico: { Args: never; Returns: Json }
      concluir_ciclo_recompensa_interno: {
        Args: {
          p_confirmado_por: string
          p_id_filho: number
          p_id_recompensa: number
          p_id_usuario_pai: number
        }
        Returns: Json
      }
      concluir_recompensa_filho_interno: {
        Args: { p_id_recompensa: number; p_token: string }
        Returns: Json
      }
      confirmar_recompensa_aproveitada: {
        Args: { p_id_recompensa: number }
        Returns: Json
      }
      contar_nao_fez_filho_vigencia: {
        Args: { p_id_filho: number; p_id_vigencia: number }
        Returns: number
      }
      criar_solicitacao_tarefa_filho_interno: {
        Args: {
          p_id_filho_tarefa: number
          p_observacao?: string
          p_token: string
        }
        Returns: Json
      }
      current_admin_id: { Args: never; Returns: number }
      current_pai_id: { Args: never; Returns: number }
      desativar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: boolean
      }
      desativar_recompensa_estrelas: {
        Args: { p_id_recompensa: number }
        Returns: boolean
      }
      duplicar_vigencia_com_atribuicoes: {
        Args: { p_data_fim: string; p_data_inicio: string; p_modelo_id: number }
        Returns: {
          id_vigencia: number
          qtd_atribuicoes: number
        }[]
      }
      enviar_feedback: {
        Args: {
          p_assunto: string
          p_mensagem: string
          p_pagina_origem?: string
          p_plataforma: string
          p_tipo: string
          p_version_code?: number
          p_version_name?: string
        }
        Returns: number
      }
      estrelas_saldo_filho_interno: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: number
      }
      estrelas_total_conquistado_interno: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: number
      }
      excluir_recompensa_estrelas: {
        Args: { p_id_recompensa: number }
        Returns: boolean
      }
      excluir_vigencia_com_regra: {
        Args: { p_id_vigencia: number }
        Returns: boolean
      }
      garantir_conquista_recompensa_estrelas_interno: {
        Args: {
          p_id_filho: number
          p_id_recompensa?: number
          p_id_usuario_pai: number
        }
        Returns: undefined
      }
      gerar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      gerar_chave_acesso_app_filho: {
        Args: { p_id_filho: number }
        Returns: {
          chave: string
          expira_em: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      listar_acessos_app_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          created_at: string
          dispositivo_id: string
          dispositivo_nome: string
          id: number
          revogado_em: string
          ultimo_acesso_em: string
        }[]
      }
      marco_recompensa_estrelas_interno: {
        Args: {
          p_id_filho: number
          p_id_recompensa: number
          p_id_usuario_pai: number
        }
        Returns: number
      }
      montar_painel_app_filho: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: Json
      }
      montar_painel_filho: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: Json
      }
      motivo_bloqueio_alteracao_resultado_interno: {
        Args: { p_id_ocorrencia: number; p_id_usuario_pai: number }
        Returns: string
      }
      obter_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      obter_painel_app_filho_interno: {
        Args: { p_token: string }
        Returns: Json
      }
      obter_painel_publico_filho: { Args: { p_token: string }; Returns: Json }
      parear_acesso_app_filho_interno: {
        Args: {
          p_chave: string
          p_cliente_hash: string
          p_dispositivo_nome: string
          p_ip_hash: string
        }
        Returns: Json
      }
      reconciliar_ocorrencia: {
        Args: {
          p_acao: string
          p_consequencia_tipo?: string
          p_created_at?: string
          p_desconto_valor?: number
          p_id_filho_tarefa?: number
          p_id_ocorrencia?: number
          p_motivo?: string
          p_novo_tipo?: string
          p_penalidade_descricao?: string
        }
        Returns: Json
      }
      reconciliar_recompensas_estrelas_filho_interno: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: undefined
      }
      regenerar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      registrar_telemetria_app: {
        Args: {
          p_plataforma: string
          p_version_code?: number
          p_version_name?: string
        }
        Returns: undefined
      }
      resgatar_recompensa_estrelas: {
        Args: { p_id_recompensa: number }
        Returns: number
      }
      resumo_estrelas_filho: { Args: { p_id_filho: number }; Returns: Json }
      resumo_estrelas_filho_interno: {
        Args: { p_id_filho: number; p_id_usuario_pai: number }
        Returns: Json
      }
      revogar_acesso_app_filho: {
        Args: { p_id_acesso: number }
        Returns: boolean
      }
      revogar_todos_acessos_app_filho: {
        Args: { p_id_filho: number }
        Returns: number
      }
      sair_acesso_app_filho_interno: {
        Args: { p_token: string }
        Returns: boolean
      }
      salvar_recompensa_estrelas: {
        Args: {
          p_descricao: string
          p_estrelas_necessarias: number
          p_id_filho: number
          p_id_recompensa?: number
          p_nome: string
        }
        Returns: number
      }
      sincronizar_estrela_ocorrencia_interno: {
        Args: { p_id_ocorrencia: number; p_id_usuario_pai: number }
        Returns: undefined
      }
      total_descontos_aplicados_filho_vigencia_interno: {
        Args: {
          p_id_filho: number
          p_id_usuario_pai: number
          p_id_vigencia: number
          p_ignorar_id_consequencia?: number
        }
        Returns: number
      }
      vigencia_ocorrencia_em_andamento_interno: {
        Args: { p_id_ocorrencia: number; p_id_usuario_pai: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
