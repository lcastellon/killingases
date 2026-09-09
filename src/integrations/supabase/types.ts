export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      hand_cards: {
        Row: {
          cards: string[]
          hand_id: string
          id: string
          seat: number
          user_id: string
        }
        Insert: {
          cards: string[]
          hand_id: string
          id?: string
          seat: number
          user_id: string
        }
        Update: {
          cards?: string[]
          hand_id?: string
          id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hand_cards_hand_id_fkey"
            columns: ["hand_id"]
            isOneToOne: false
            referencedRelation: "hands"
            referencedColumns: ["id"]
          },
        ]
      }
      hand_secrets: {
        Row: {
          hand_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          hand_id: string
          state: Json
          updated_at?: string
        }
        Update: {
          hand_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hand_secrets_hand_id_fkey"
            columns: ["hand_id"]
            isOneToOne: true
            referencedRelation: "hands"
            referencedColumns: ["id"]
          },
        ]
      }
      hands: {
        Row: {
          created_at: string
          hand_no: number
          id: string
          public_state: Json
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hand_no: number
          id?: string
          public_state: Json
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hand_no?: number
          id?: string
          public_state?: Json
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hands_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      house_rake: {
        Row: {
          amount: number
          created_at: string
          hand_id: string
          hand_no: number
          id: string
          pot: number
          table_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          hand_id: string
          hand_no: number
          id?: string
          pot?: number
          table_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          hand_id?: string
          hand_no?: number
          id?: string
          pot?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_rake_hand_id_fkey"
            columns: ["hand_id"]
            isOneToOne: true
            referencedRelation: "hands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_rake_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_tables: {
        Row: {
          big_blind: number
          button_seat: number | null
          code: string
          created_at: string
          game_variant: string
          hand_no: number
          host_id: string
          id: string
          is_stable: boolean
          max_buyin: number
          min_buyin: number
          name: string
          small_blind: number
          special_rules: Json
          starting_chips: number
          status: string
          table_mode: string
          turn_seconds: number
          updated_at: string
        }
        Insert: {
          big_blind?: number
          button_seat?: number | null
          code: string
          created_at?: string
          game_variant?: string
          hand_no?: number
          host_id: string
          id?: string
          is_stable?: boolean
          max_buyin?: number
          min_buyin?: number
          name?: string
          small_blind?: number
          special_rules?: Json
          starting_chips?: number
          status?: string
          table_mode?: string
          turn_seconds?: number
          updated_at?: string
        }
        Update: {
          big_blind?: number
          button_seat?: number | null
          code?: string
          created_at?: string
          game_variant?: string
          hand_no?: number
          host_id?: string
          id?: string
          is_stable?: boolean
          max_buyin?: number
          min_buyin?: number
          name?: string
          small_blind?: number
          special_rules?: Json
          starting_chips?: number
          status?: string
          table_mode?: string
          turn_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          eliminated_at: string | null
          finish_position: number | null
          id: string
          paid_at: string | null
          prize_amount: number
          rebuys: number
          registered_at: string
          seat: number
          status: string
          total_paid: number
          tournament_id: string
          user_id: string
          display_name: string
        }
        Insert: {
          eliminated_at?: string | null
          finish_position?: number | null
          id?: string
          paid_at?: string | null
          prize_amount?: number
          rebuys?: number
          registered_at?: string
          seat: number
          status?: string
          total_paid?: number
          tournament_id: string
          user_id: string
          display_name: string
        }
        Update: {
          eliminated_at?: string | null
          finish_position?: number | null
          id?: string
          paid_at?: string | null
          prize_amount?: number
          rebuys?: number
          registered_at?: string
          seat?: number
          status?: string
          total_paid?: number
          tournament_id?: string
          user_id?: string
          display_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          allow_rebuys: boolean
          blind_interval_minutes: number
          blind_levels: Json
          buy_in: number
          completed_at: string | null
          created_at: string
          current_level: number
          entries_count: number
          format: string
          host_id: string
          house_fee_percent: number
          house_fee_total: number
          id: string
          max_players: number
          max_rebuys: number
          min_players: number
          prize_pool: number
          prize_structure: Json
          rebuy_until_level: number
          registration_closes_at: string | null
          registration_opens_at: string | null
          remaining_players: number
          started_at: string | null
          starting_stack: number
          status: string
          table_id: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          allow_rebuys?: boolean
          blind_interval_minutes?: number
          blind_levels: Json
          buy_in: number
          completed_at?: string | null
          created_at?: string
          current_level?: number
          entries_count?: number
          format: string
          host_id: string
          house_fee_percent?: number
          house_fee_total?: number
          id?: string
          max_players: number
          max_rebuys?: number
          min_players: number
          prize_pool?: number
          prize_structure: Json
          rebuy_until_level?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          remaining_players?: number
          started_at?: string | null
          starting_stack: number
          status?: string
          table_id: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          allow_rebuys?: boolean
          blind_interval_minutes?: number
          blind_levels?: Json
          buy_in?: number
          completed_at?: string | null
          created_at?: string
          current_level?: number
          entries_count?: number
          format?: string
          host_id?: string
          house_fee_percent?: number
          house_fee_total?: number
          id?: string
          max_players?: number
          max_rebuys?: number
          min_players?: number
          prize_pool?: number
          prize_structure?: Json
          rebuy_until_level?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          remaining_players?: number
          started_at?: string | null
          starting_stack?: number
          status?: string
          table_id?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: true
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bank_chips: number
          created_at: string
          display_name: string
          felt_theme: string
          id: string
        }
        Insert: {
          avatar_path?: string | null
          bank_chips?: number
          created_at?: string
          display_name?: string
          felt_theme?: string
          id: string
        }
        Update: {
          avatar_path?: string | null
          bank_chips?: number
          created_at?: string
          display_name?: string
          felt_theme?: string
          id?: string
        }
        Relationships: []
      }
      table_messages: {
        Row: {
          body: string
          created_at: string
          display_name: string
          id: string
          table_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          display_name: string
          id?: string
          table_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string
          id?: string
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_messages_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_players: {
        Row: {
          chips: number
          display_name: string
          id: string
          joined_at: string
          last_seen_at: string
          seat: number | null
          sitting_out: boolean
          table_id: string
          user_id: string
        }
        Insert: {
          chips?: number
          display_name: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          seat?: number | null
          sitting_out?: boolean
          table_id: string
          user_id: string
        }
        Update: {
          chips?: number
          display_name?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          seat?: number | null
          sitting_out?: boolean
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_reactions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          reaction: string
          seat: number
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          reaction: string
          seat: number
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          reaction?: string
          seat?: number
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_reactions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_tournament_if_registering: {
        Args: { _tournament_id: string }
        Returns: boolean
      }
      close_inactive_poker_tables: {
        Args: { idle_minutes?: number }
        Returns: number
      }
      complete_tournament_if_ready: {
        Args: { _tournament_id: string }
        Returns: boolean
      }
      decline_tournament_rebuy: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      rebuy_tournament_entry: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: Json
      }
      register_tournament_entry: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: Json
      }
      unregister_tournament_entry: {
        Args: { _tournament_id: string; _user_id: string }
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
