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
          feito: string | null
          id: number
          id_filho: number
          id_tarefa: number
          id_usuario_pai: number
          id_vigencia: number
          qtd_nao_fez: number
        }
        Insert: {
          created_at?: string
          feito?: string | null
          id?: never
          id_filho: number
          id_tarefa: number
          id_usuario_pai?: number
          id_vigencia: number
          qtd_nao_fez?: number
        }
        Update: {
          created_at?: string
          feito?: string | null
          id?: never
          id_filho?: number
          id_tarefa?: number
          id_usuario_pai?: number
          id_vigencia?: number
          qtd_nao_fez?: number
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
          bonificacao_descricao: string | null
          bonificacao_tipo: string | null
          bonificacao_valor: number | null
          created_at: string
          id: number
          id_filho_tarefa: number
          id_usuario_pai: number
          tipo: string
        }
        Insert: {
          bonificacao_descricao?: string | null
          bonificacao_tipo?: string | null
          bonificacao_valor?: number | null
          created_at?: string
          id?: never
          id_filho_tarefa: number
          id_usuario_pai?: number
          tipo: string
        }
        Update: {
          bonificacao_descricao?: string | null
          bonificacao_tipo?: string | null
          bonificacao_valor?: number | null
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
      t_push_envio: {
        Row: {
          created_at: string
          data_referencia: string
          id: number
          id_filho: number
          id_push_dispositivo: number
          id_usuario_pai: number
          qtd_pendencias: number
        }
        Insert: {
          created_at?: string
          data_referencia: string
          id?: number
          id_filho: number
          id_push_dispositivo: number
          id_usuario_pai: number
          qtd_pendencias: number
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: number
          id_filho?: number
          id_push_dispositivo?: number
          id_usuario_pai?: number
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
      t_tarefa: {
        Row: {
          created_at: string
          id: number
          id_usuario_pai: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: never
          id_usuario_pai?: number
          nome: string
        }
        Update: {
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
          penalidade: string | null
          qtd_ocorrencia: number
          tipo_penalidade: string
          valor_debito: number | null
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: never
          id_usuario_pai?: number
          penalidade?: string | null
          qtd_ocorrencia?: number
          tipo_penalidade?: string
          valor_debito?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: never
          id_usuario_pai?: number
          penalidade?: string | null
          qtd_ocorrencia?: number
          tipo_penalidade?: string
          valor_debito?: number | null
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
      admin_adicionar: {
        Args: { p_email: string }
        Returns: number
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
          entidade_id: string | null
          id: number
        }[]
      }
      admin_config_salvar: {
        Args: {
          p_android_min_version_code: number | null
          p_android_min_version_name: string | null
          p_ios_min_version_code: number | null
          p_ios_min_version_name: string | null
          p_manutencao_ativa: boolean
          p_manutencao_mensagem: string | null
          p_mensagem_global: string | null
          p_mensagem_global_ativa: boolean
        }
        Returns: Json
      }
      admin_definir_status: {
        Args: { p_admin_id: number; p_ativo: boolean }
        Returns: boolean
      }
      admin_feature_salvar: {
        Args: {
          p_ativo: boolean
          p_chave: string
          p_descricao: string | null
          p_nome: string
        }
        Returns: Json
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
          ultimo_acesso: string | null
        }[]
      }
      admin_registrar_acesso: { Args: never; Returns: undefined }
      admin_sistema_obter: { Args: never; Returns: Json }
      admin_diagnostico: {
        Args: {
          p_version_code?: number | null
          p_version_name?: string | null
        }
        Returns: Json
      }
      admin_operacao: { Args: never; Returns: Json }
      admin_resumo: { Args: never; Returns: Json }
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
      app_config_publico: { Args: never; Returns: Json }
      current_admin_id: { Args: never; Returns: number }
      current_pai_id: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      desativar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: boolean
      }
      duplicar_vigencia_com_atribuicoes: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_modelo_id: number
          p_penalidade: string
          p_qtd_ocorrencia: number
          p_valor_debito: number
        }
        Returns: {
          id_vigencia: number
          qtd_atribuicoes: number
        }[]
      }
      excluir_vigencia_com_regra: {
        Args: { p_id_vigencia: number }
        Returns: boolean
      }
      existe_filho_sem_mesada_no_limite: {
        Args: { p_id_vigencia: number }
        Returns: boolean
      }
      gerar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      obter_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      obter_painel_publico_filho: { Args: { p_token: string }; Returns: Json }
      registrar_telemetria_app: {
        Args: {
          p_plataforma: string
          p_version_code?: number | null
          p_version_name?: string | null
        }
        Returns: undefined
      }
      recalcular_estado_atribuicao: {
        Args: { p_id: number }
        Returns: undefined
      }
      recalcular_penalidade_vigencia: {
        Args: { p_id_vigencia: number }
        Returns: undefined
      }
      regenerar_acesso_publico_filho: {
        Args: { p_id_filho: number }
        Returns: {
          ativo: boolean
          token: string
        }[]
      }
      registrar_nao_fez_com_penalidade: {
        Args: {
          p_created_at: string
          p_id_filho_tarefa: number
          p_id_ocorrencia?: number
          p_penalidade?: string
        }
        Returns: {
          novo_total: number
          penalidade: string
          penalizado: boolean
        }[]
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
