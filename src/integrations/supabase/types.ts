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
      t_filho: {
        Row: {
          celular: string | null
          created_at: string
          email: string | null
          id: number
          id_usuario_pai: number
          nome: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          email?: string | null
          id?: never
          id_usuario_pai?: number
          nome: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          email?: string | null
          id?: never
          id_usuario_pai?: number
          nome?: string
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
          cpf: string
          created_at: string
          email: string
          id: number
          nome: string
        }
        Insert: {
          auth_user_id?: string
          cpf: string
          created_at?: string
          email: string
          id?: never
          nome: string
        }
        Update: {
          auth_user_id?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: never
          nome?: string
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
          penalidade: string
          qtd_ocorrencia: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: never
          id_usuario_pai?: number
          penalidade: string
          qtd_ocorrencia?: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: never
          id_usuario_pai?: number
          penalidade?: string
          qtd_ocorrencia?: number
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
      current_pai_id: { Args: never; Returns: number }
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
