export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          lead_id: string
          meta: Json
          summary: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["activity_kind"]
          lead_id: string
          meta?: Json
          summary: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          lead_id?: string
          meta?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_information: {
        Row: {
          created_at: string
          info_text: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          info_text: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          info_text?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_information_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_information_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_information_images: {
        Row: {
          created_at: string
          file_url: string
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          lead_id: string
          title: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_information_images_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_information_images_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_template_progress: {
        Row: {
          last_order_used: number
          lead_id: string
          scenario: Database["public"]["Enums"]["call_outcome"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          last_order_used: number
          lead_id: string
          scenario: Database["public"]["Enums"]["call_outcome"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          last_order_used?: number
          lead_id?: string
          scenario?: Database["public"]["Enums"]["call_outcome"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_template_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_template_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          amount_paid: number
          bni_presentation_date: string | null
          call_count: number
          city: string | null
          company: string | null
          converted_at: string | null
          created_at: string
          deal_value: number
          email: string | null
          id: string
          last_call_at: string | null
          last_call_outcome: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at: string | null
          lost_reason: string | null
          name: string
          next_reminder_at: string | null
          notes: string | null
          owner_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          service: string | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          bni_presentation_date?: string | null
          call_count?: number
          city?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string
          deal_value?: number
          email?: string | null
          id?: string
          last_call_at?: string | null
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          name: string
          next_reminder_at?: string | null
          notes?: string | null
          owner_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          service?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          bni_presentation_date?: string | null
          call_count?: number
          city?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string
          deal_value?: number
          email?: string | null
          id?: string
          last_call_at?: string | null
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          name?: string
          next_reminder_at?: string | null
          notes?: string | null
          owner_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          service?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          created_at: string
          followup_order: number
          id: string
          is_active: boolean
          message: string
          name: string
          scenario: Database["public"]["Enums"]["call_outcome"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          followup_order?: number
          id?: string
          is_active?: boolean
          message: string
          name: string
          scenario: Database["public"]["Enums"]["call_outcome"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          followup_order?: number
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          scenario?: Database["public"]["Enums"]["call_outcome"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["payment_category"] | null
          created_at: string
          id: string
          lead_id: string
          method: string
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["payment_category"] | null
          created_at?: string
          id?: string
          lead_id: string
          method?: string
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["payment_category"] | null
          created_at?: string
          id?: string
          lead_id?: string
          method?: string
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          lead_id: string
          owner_id: string
          state: Database["public"]["Enums"]["reminder_state"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          lead_id: string
          owner_id?: string
          state?: Database["public"]["Enums"]["reminder_state"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          lead_id?: string
          owner_id?: string
          state?: Database["public"]["Enums"]["reminder_state"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          is_suspended: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      work_items: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["work_status"]
          type: Database["public"]["Enums"]["work_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["work_status"]
          type: Database["public"]["Enums"]["work_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["work_status"]
          type?: Database["public"]["Enums"]["work_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "designer_leads_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      designer_leads_view: {
        Row: {
          bni_presentation_date: string | null
          call_count: number | null
          city: string | null
          company: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          id: string | null
          last_call_at: string | null
          last_call_outcome: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at: string | null
          lost_reason: string | null
          name: string | null
          next_reminder_at: string | null
          notes: string | null
          owner_id: string | null
          service: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
        }
        Insert: {
          bni_presentation_date?: string | null
          call_count?: number | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_call_at?: string | null
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          name?: string | null
          next_reminder_at?: string | null
          notes?: string | null
          owner_id?: string | null
          service?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
        }
        Update: {
          bni_presentation_date?: string | null
          call_count?: number | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_call_at?: string | null
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          name?: string | null
          next_reminder_at?: string | null
          notes?: string | null
          owner_id?: string | null
          service?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_kind:
        | "lead_created"
        | "status_change"
        | "call"
        | "payment"
        | "note"
        | "reminder_set"
        | "reminder_done"
        | "reminder_snoozed"
        | "field_update"
        | "whatsapp"
      app_role: "admin" | "designer"
      call_outcome:
        | "connected"
        | "no_answer"
        | "busy"
        | "wrong_number"
        | "switched_off"
        | "callback_later"
      lead_status:
        | "take_info"
        | "info_taken"
        | "draft_sent"
        | "approved"
        | "advance_received"
        | "presentation_sent"
        | "converted"
        | "lost"
      payment_category: "advance" | "partial" | "full"
      payment_status: "unpaid" | "partial" | "paid"
      reminder_state: "pending" | "done" | "snoozed" | "cancelled"
      work_status: "pending" | "in_progress" | "completed"
      work_type: "draft" | "presentation"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_kind: [
        "lead_created",
        "status_change",
        "call",
        "payment",
        "note",
        "reminder_set",
        "reminder_done",
        "reminder_snoozed",
        "field_update",
        "whatsapp",
      ],
      app_role: ["admin", "designer"],
      call_outcome: [
        "connected",
        "no_answer",
        "busy",
        "wrong_number",
        "switched_off",
        "callback_later",
      ],
      lead_status: [
        "take_info",
        "info_taken",
        "draft_sent",
        "approved",
        "advance_received",
        "presentation_sent",
        "converted",
        "lost",
      ],
      payment_category: ["advance", "partial", "full"],
      payment_status: ["unpaid", "partial", "paid"],
      reminder_state: ["pending", "done", "snoozed", "cancelled"],
      work_status: ["pending", "in_progress", "completed"],
      work_type: ["draft", "presentation"],
    },
  },
} as const

