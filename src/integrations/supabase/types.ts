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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_financial_entries: {
        Row: {
          account_code: string
          client_id: string
          month: number
          updated_at: string
          updated_by: string | null
          value: number
          year: number
        }
        Insert: {
          account_code: string
          client_id: string
          month: number
          updated_at?: string
          updated_by?: string | null
          value?: number
          year: number
        }
        Update: {
          account_code?: string
          client_id?: string
          month?: number
          updated_at?: string
          updated_by?: string | null
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_financial_entries_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["code"]
          },
        ]
      }
      client_financial_imports: {
        Row: {
          client_id: string
          created_at: string
          entries: Json
          file_name: string
          id: string
          imported_by: string | null
          slot: string
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          entries?: Json
          file_name: string
          id?: string
          imported_by?: string | null
          slot: string
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          entries?: Json
          file_name?: string
          id?: string
          imported_by?: string | null
          slot?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_financial_imports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_financial_settings: {
        Row: {
          client_id: string
          corporate_tax_rate: number
          derrama_rate: number
          irc_coef: number
          irc_regime: string
          irs_deducoes_colecta: number
          irs_retencoes: number
          iva_monthly: Json | null
          iva_q1: number | null
          iva_q2: number | null
          iva_q3: number | null
          iva_q4: number | null
          iva_regime: string
          mapa_q1_data: string | null
          mapa_q1_enviado: boolean
          mapa_q2_data: string | null
          mapa_q2_enviado: boolean
          mapa_q3_data: string | null
          mapa_q3_enviado: boolean
          mapa_q4_data: string | null
          mapa_q4_enviado: boolean
          outras_despesas_label: string
          outras_despesas_valor: number
          ss_q1: number
          ss_q2: number
          ss_q3: number
          ss_q4: number
          ta_base_ajudas_custo: number
          ta_base_representacao: number
          ta_kms: number
          ta_nao_doc: number
          ta_representacao: number
          tco: boolean
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          corporate_tax_rate?: number
          derrama_rate?: number
          irc_coef?: number
          irc_regime?: string
          irs_deducoes_colecta?: number
          irs_retencoes?: number
          iva_monthly?: Json | null
          iva_q1?: number | null
          iva_q2?: number | null
          iva_q3?: number | null
          iva_q4?: number | null
          iva_regime?: string
          mapa_q1_data?: string | null
          mapa_q1_enviado?: boolean
          mapa_q2_data?: string | null
          mapa_q2_enviado?: boolean
          mapa_q3_data?: string | null
          mapa_q3_enviado?: boolean
          mapa_q4_data?: string | null
          mapa_q4_enviado?: boolean
          outras_despesas_label?: string
          outras_despesas_valor?: number
          ss_q1?: number
          ss_q2?: number
          ss_q3?: number
          ss_q4?: number
          ta_base_ajudas_custo?: number
          ta_base_representacao?: number
          ta_kms?: number
          ta_nao_doc?: number
          ta_representacao?: number
          tco?: boolean
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          corporate_tax_rate?: number
          derrama_rate?: number
          irc_coef?: number
          irc_regime?: string
          irs_deducoes_colecta?: number
          irs_retencoes?: number
          iva_monthly?: Json | null
          iva_q1?: number | null
          iva_q2?: number | null
          iva_q3?: number | null
          iva_q4?: number | null
          iva_regime?: string
          mapa_q1_data?: string | null
          mapa_q1_enviado?: boolean
          mapa_q2_data?: string | null
          mapa_q2_enviado?: boolean
          mapa_q3_data?: string | null
          mapa_q3_enviado?: boolean
          mapa_q4_data?: string | null
          mapa_q4_enviado?: boolean
          outras_despesas_label?: string
          outras_despesas_valor?: number
          ss_q1?: number
          ss_q2?: number
          ss_q3?: number
          ss_q4?: number
          ta_base_ajudas_custo?: number
          ta_base_representacao?: number
          ta_kms?: number
          ta_nao_doc?: number
          ta_representacao?: number
          tco?: boolean
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          email: string | null
          faturacao: string | null
          faturacao_frequencia: string | null
          fiscal_regime: Database["public"]["Enums"]["fiscal_regime"]
          id: string
          inicio_contrato: string | null
          irs_coeficiente: number
          iva: string | null
          iva_oss: string | null
          mensalidade: number | null
          name: string
          nif: string | null
          niss: string | null
          notas_internas: string | null
          notes: string | null
          pag_seguranca_social: string | null
          phone: string | null
          programa_faturacao: string | null
          recapitulativa: string | null
          responsavel_id: string | null
          saft: string | null
          salarios: string | null
          seguranca_social: string | null
          seguranca_social_isencao_fim: string | null
          senha_at: string | null
          senha_faturacao: string | null
          senha_ss: string | null
          status: string
          tipo_contabilidade: string | null
          updated_at: string
          utilizador_faturacao: string | null
          via_ctt: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          faturacao?: string | null
          faturacao_frequencia?: string | null
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
          id?: string
          inicio_contrato?: string | null
          irs_coeficiente?: number
          iva?: string | null
          iva_oss?: string | null
          mensalidade?: number | null
          name: string
          nif?: string | null
          niss?: string | null
          notas_internas?: string | null
          notes?: string | null
          pag_seguranca_social?: string | null
          phone?: string | null
          programa_faturacao?: string | null
          recapitulativa?: string | null
          responsavel_id?: string | null
          saft?: string | null
          salarios?: string | null
          seguranca_social?: string | null
          seguranca_social_isencao_fim?: string | null
          senha_at?: string | null
          senha_faturacao?: string | null
          senha_ss?: string | null
          status?: string
          tipo_contabilidade?: string | null
          updated_at?: string
          utilizador_faturacao?: string | null
          via_ctt?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          faturacao?: string | null
          faturacao_frequencia?: string | null
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"]
          id?: string
          inicio_contrato?: string | null
          irs_coeficiente?: number
          iva?: string | null
          iva_oss?: string | null
          mensalidade?: number | null
          name?: string
          nif?: string | null
          niss?: string | null
          notas_internas?: string | null
          notes?: string | null
          pag_seguranca_social?: string | null
          phone?: string | null
          programa_faturacao?: string | null
          recapitulativa?: string | null
          responsavel_id?: string | null
          saft?: string | null
          salarios?: string | null
          seguranca_social?: string | null
          seguranca_social_isencao_fim?: string | null
          senha_at?: string | null
          senha_faturacao?: string | null
          senha_ss?: string | null
          status?: string
          tipo_contabilidade?: string | null
          updated_at?: string
          utilizador_faturacao?: string | null
          via_ctt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_secrets: {
        Row: {
          access_code: string | null
          collaborator_id: string
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          collaborator_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          collaborator_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      collaborators: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          role: string
          specialty: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comercial_script_groups: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      comercial_scripts: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          position: number
          script_group: string | null
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          id?: string
          position?: number
          script_group?: string | null
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          position?: number
          script_group?: string | null
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          code: string
          created_at: string
          display_order: number
          name: string
          parent_code: string | null
          section: string
          sign: number
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          name: string
          parent_code?: string | null
          section: string
          sign?: number
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          name?: string
          parent_code?: string | null
          section?: string
          sign?: number
        }
        Relationships: []
      }
      fiscal_deadlines: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          day_of_month: number
          description: string | null
          fiscal_regime: Database["public"]["Enums"]["fiscal_regime"] | null
          id: string
          month: number | null
          recurrent: boolean
          title: string
        }
        Insert: {
          category: Database["public"]["Enums"]["task_category"]
          created_at?: string
          day_of_month: number
          description?: string | null
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"] | null
          id?: string
          month?: number | null
          recurrent?: boolean
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          day_of_month?: number
          description?: string | null
          fiscal_regime?: Database["public"]["Enums"]["fiscal_regime"] | null
          id?: string
          month?: number | null
          recurrent?: boolean
          title?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          business_area: string | null
          business_type: string | null
          created_at: string
          email: string | null
          estimated_value: number | null
          given_by: string | null
          id: string
          iva_framework: string | null
          loss_reason: string | null
          meeting: boolean
          meeting_date: string | null
          name: string
          next_followup: string | null
          nif: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          proposal_sent_at: string | null
          segment: string
          source: string | null
          stage: string
          suggested_product: string | null
          updated_at: string
        }
        Insert: {
          business_area?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          given_by?: string | null
          id?: string
          iva_framework?: string | null
          loss_reason?: string | null
          meeting?: boolean
          meeting_date?: string | null
          name: string
          next_followup?: string | null
          nif?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          proposal_sent_at?: string | null
          segment?: string
          source?: string | null
          stage?: string
          suggested_product?: string | null
          updated_at?: string
        }
        Update: {
          business_area?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          given_by?: string | null
          id?: string
          iva_framework?: string | null
          loss_reason?: string | null
          meeting?: boolean
          meeting_date?: string | null
          name?: string
          next_followup?: string | null
          nif?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          proposal_sent_at?: string | null
          segment?: string
          source?: string | null
          stage?: string
          suggested_product?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_obligations: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          extra_done: boolean | null
          id: string
          notes: string | null
          obligation_type: string
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          extra_done?: boolean | null
          id?: string
          notes?: string | null
          obligation_type: string
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          extra_done?: boolean | null
          id?: string
          notes?: string | null
          obligation_type?: string
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_obligations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          client_id: string | null
          collaborator_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["task_category"]
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      fiscal_regime: "simplificado" | "organizado" | "isento" | "misto"
      task_category:
        | "IRS"
        | "IRC"
        | "IVA"
        | "SS"
        | "contabilidade"
        | "fiscal"
        | "outro"
        | "SAFT"
        | "salarios"
        | "DMR"
        | "SS_TI"
        | "retencao_fonte"
        | "emissao_faturas"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status: "pendente" | "em_progresso" | "concluida" | "cancelada"
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
    Enums: {
      app_role: ["admin", "user"],
      fiscal_regime: ["simplificado", "organizado", "isento", "misto"],
      task_category: [
        "IRS",
        "IRC",
        "IVA",
        "SS",
        "contabilidade",
        "fiscal",
        "outro",
        "SAFT",
        "salarios",
        "DMR",
        "SS_TI",
        "retencao_fonte",
        "emissao_faturas",
      ],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: ["pendente", "em_progresso", "concluida", "cancelada"],
    },
  },
} as const
