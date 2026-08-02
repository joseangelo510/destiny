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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_metrics: {
        Row: {
          audit_id: string
          content_gaps: number
          created_at: string
          critical_issues: number
          estimated_organic_traffic: number
          google_reviews: number
          lost_keywords: number
          new_keywords: number
          ranking_keywords: number
          raw_provider_payload: Json
          referring_domains: number
          warnings: number
        }
        Insert: {
          audit_id: string
          content_gaps?: number
          created_at?: string
          critical_issues?: number
          estimated_organic_traffic?: number
          google_reviews?: number
          lost_keywords?: number
          new_keywords?: number
          ranking_keywords?: number
          raw_provider_payload?: Json
          referring_domains?: number
          warnings?: number
        }
        Update: {
          audit_id?: string
          content_gaps?: number
          created_at?: string
          critical_issues?: number
          estimated_organic_traffic?: number
          google_reviews?: number
          lost_keywords?: number
          new_keywords?: number
          ranking_keywords?: number
          raw_provider_payload?: Json
          referring_domains?: number
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_metrics_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: true
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_message: string | null
          id: string
          logic_input_hash: string | null
          logic_rules_version: string | null
          progress: number
          provider: string
          requested_by: string
          started_at: string | null
          status: string
          updated_at: string
          website_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_message?: string | null
          id?: string
          logic_input_hash?: string | null
          logic_rules_version?: string | null
          progress?: number
          provider?: string
          requested_by: string
          started_at?: string | null
          status?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_message?: string | null
          id?: string
          logic_input_hash?: string | null
          logic_rules_version?: string | null
          progress?: number
          provider?: string
          requested_by?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          id: string
          name: string
          url: string | null
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          url?: string | null
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          url?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          credential_reference: string | null
          external_account_id: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          scopes: string[]
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          credential_reference?: string | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          scopes?: string[]
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          credential_reference?: string | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          scopes?: string[]
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          destination_path: string | null
          id: string
          kind: string
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          destination_path?: string | null
          id?: string
          kind: string
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          destination_path?: string | null
          id?: string
          kind?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          contact_email: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string
          created_at?: string
          first_name?: string
          id: string
          last_name?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quests: {
        Row: {
          action_path: string
          audit_id: string | null
          category: string
          completed_at: string | null
          created_at: string
          description: string
          due_at: string | null
          estimated_minutes: number
          external_url: string | null
          id: string
          min_plan_tier: number
          priority: number
          requires_approval: boolean
          status: string
          title: string
          task_type: string
          updated_at: string
          verification_method: string | null
          verification_status: string
          verified_at: string | null
          website_id: string
          week_number: number
          xp: number
        }
        Insert: {
          action_path?: string
          audit_id?: string | null
          category: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          estimated_minutes?: number
          external_url?: string | null
          id?: string
          min_plan_tier?: number
          priority?: number
          requires_approval?: boolean
          status?: string
          title: string
          task_type?: string
          updated_at?: string
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
          website_id: string
          week_number?: number
          xp?: number
        }
        Update: {
          action_path?: string
          audit_id?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          estimated_minutes?: number
          external_url?: string | null
          id?: string
          min_plan_tier?: number
          priority?: number
          requires_approval?: boolean
          status?: string
          title?: string
          task_type?: string
          updated_at?: string
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
          website_id?: string
          week_number?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          audience_challenges_goals: string
          business_name: string
          created_at: string
          differentiation: string
          id: string
          ideal_customer: string
          market: string
          normalized_domain: string
          onboarding_completed_at: string | null
          organization_id: string
          plan_selected_at: string | null
          plan_tier: string | null
          problem_solved: string
          products_services: string
          updated_at: string
          url: string
        }
        Insert: {
          audience_challenges_goals?: string
          business_name: string
          created_at?: string
          differentiation?: string
          id?: string
          ideal_customer?: string
          market?: string
          normalized_domain: string
          onboarding_completed_at?: string | null
          organization_id: string
          plan_selected_at?: string | null
          plan_tier?: string | null
          problem_solved?: string
          products_services?: string
          updated_at?: string
          url: string
        }
        Update: {
          audience_challenges_goals?: string
          business_name?: string
          created_at?: string
          differentiation?: string
          id?: string
          ideal_customer?: string
          market?: string
          normalized_domain?: string
          onboarding_completed_at?: string | null
          organization_id?: string
          plan_selected_at?: string | null
          plan_tier?: string | null
          problem_solved?: string
          products_services?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { organization_name: string }
        Returns: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
