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
      addresses: {
        Row: {
          cep: string
          city: string
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          neighborhood: string
          number: string
          recipient_name: string
          state: string
          street: string
          user_id: string
        }
        Insert: {
          cep: string
          city: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood: string
          number: string
          recipient_name: string
          state: string
          street: string
          user_id: string
        }
        Update: {
          cep?: string
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string
          number?: string
          recipient_name?: string
          state?: string
          street?: string
          user_id?: string
        }
        Relationships: []
      }
      card_prices: {
        Row: {
          card_name: string
          card_number: string
          collection: string
          created_at: string
          finish: string
          id: string
          language: string
          last_error: string | null
          price_cents: number | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          card_name: string
          card_number: string
          collection: string
          created_at?: string
          finish: string
          id?: string
          language: string
          last_error?: string | null
          price_cents?: number | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          card_name?: string
          card_number?: string
          collection?: string
          created_at?: string
          finish?: string
          id?: string
          language?: string
          last_error?: string | null
          price_cents?: number | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          base_price_cents: number | null
          card_number: string
          collection: string
          condition: Database["public"]["Enums"]["card_condition"]
          created_at: string
          finish: Database["public"]["Enums"]["card_finish"]
          id: string
          image: string
          language: Database["public"]["Enums"]["card_language"]
          name: string
          stock: number
          updated_at: string
        }
        Insert: {
          base_price_cents?: number | null
          card_number: string
          collection: string
          condition?: Database["public"]["Enums"]["card_condition"]
          created_at?: string
          finish: Database["public"]["Enums"]["card_finish"]
          id?: string
          image?: string
          language: Database["public"]["Enums"]["card_language"]
          name: string
          stock?: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number | null
          card_number?: string
          collection?: string
          condition?: Database["public"]["Enums"]["card_condition"]
          created_at?: string
          finish?: Database["public"]["Enums"]["card_finish"]
          id?: string
          image?: string
          language?: Database["public"]["Enums"]["card_language"]
          name?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          card_id: string
          card_image: string | null
          card_name: string
          card_number: string | null
          collection: string | null
          condition: string | null
          created_at: string
          finish: string | null
          id: string
          language: string | null
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          card_id: string
          card_image?: string | null
          card_name: string
          card_number?: string | null
          collection?: string | null
          condition?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          language?: string | null
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          card_id?: string
          card_image?: string | null
          card_name?: string
          card_number?: string | null
          collection?: string | null
          condition?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          language?: string | null
          order_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cep: string
          city: string
          complement: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          neighborhood: string
          notes: string | null
          number: string
          phone: string | null
          recipient_name: string
          shipping_cost_cents: number
          shipping_method: string
          state: string
          status: string
          street: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cep: string
          city: string
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          neighborhood: string
          notes?: string | null
          number: string
          phone?: string | null
          recipient_name: string
          shipping_cost_cents?: number
          shipping_method: string
          state: string
          status?: string
          street: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string
          city?: string
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          neighborhood?: string
          notes?: string | null
          number?: string
          phone?: string | null
          recipient_name?: string
          shipping_cost_cents?: number
          shipping_method?: string
          state?: string
          status?: string
          street?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_update_runs: {
        Row: {
          error_count: number
          finished_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: string
          total_variants: number
          trigger: string
          updated_count: number
        }
        Insert: {
          error_count?: number
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          total_variants?: number
          trigger?: string
          updated_count?: number
        }
        Update: {
          error_count?: number
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          total_variants?: number
          trigger?: string
          updated_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      card_condition: "M" | "NM" | "SP" | "MP" | "HP" | "D"
      card_finish:
        | "Normal"
        | "Foil"
        | "Reverse Foil"
        | "Pokebola"
        | "Energia"
        | "Promo"
      card_language: "Português" | "Inglês" | "Italiano" | "Espanhol"
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
    Enums: {
      app_role: ["admin", "user"],
      card_condition: ["M", "NM", "SP", "MP", "HP", "D"],
      card_finish: [
        "Normal",
        "Foil",
        "Reverse Foil",
        "Pokebola",
        "Energia",
        "Promo",
      ],
      card_language: ["Português", "Inglês", "Italiano", "Espanhol"],
    },
  },
} as const
