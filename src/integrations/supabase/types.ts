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
      banners: {
        Row: {
          active: boolean
          alt: string | null
          created_at: string
          id: string
          image_url: string
          link_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          alt?: string | null
          created_at?: string
          id?: string
          image_url: string
          link_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          alt?: string | null
          created_at?: string
          id?: string
          image_url?: string
          link_url?: string | null
          sort_order?: number
          updated_at?: string
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
      card_stats: {
        Row: {
          card_key: string
          created_at: string
          last_viewed_at: string
          views: number
        }
        Insert: {
          card_key: string
          created_at?: string
          last_viewed_at?: string
          views?: number
        }
        Update: {
          card_key?: string
          created_at?: string
          last_viewed_at?: string
          views?: number
        }
        Relationships: []
      }
      cards: {
        Row: {
          base_price_cents: number | null
          card_number: string
          category: Database["public"]["Enums"]["card_category"]
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
          category?: Database["public"]["Enums"]["card_category"]
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
          category?: Database["public"]["Enums"]["card_category"]
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
          coupon_code: string | null
          cpf: string | null
          created_at: string
          discount_cents: number
          email: string
          id: string
          mercadopago_payment_id: string | null
          neighborhood: string
          notes: string | null
          number: string
          payment_method: string
          phone: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pre_cancel_status: string | null
          recipient_name: string
          shipping_cost_cents: number
          shipping_method: string
          state: string
          status: string
          stock_reservation_expires_at: string | null
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
          coupon_code?: string | null
          cpf?: string | null
          created_at?: string
          discount_cents?: number
          email: string
          id?: string
          mercadopago_payment_id?: string | null
          neighborhood: string
          notes?: string | null
          number: string
          payment_method?: string
          phone?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pre_cancel_status?: string | null
          recipient_name: string
          shipping_cost_cents?: number
          shipping_method: string
          state: string
          status?: string
          stock_reservation_expires_at?: string | null
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
          coupon_code?: string | null
          cpf?: string | null
          created_at?: string
          discount_cents?: number
          email?: string
          id?: string
          mercadopago_payment_id?: string | null
          neighborhood?: string
          notes?: string | null
          number?: string
          payment_method?: string
          phone?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pre_cancel_status?: string | null
          recipient_name?: string
          shipping_cost_cents?: number
          shipping_method?: string
          state?: string
          status?: string
          stock_reservation_expires_at?: string | null
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
      post_purchase_surveys: {
        Row: {
          comment: string | null
          created_at: string
          how_found_us: string | null
          id: string
          order_id: string
          satisfaction: number | null
          skipped: boolean
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          how_found_us?: string | null
          id?: string
          order_id: string
          satisfaction?: number | null
          skipped?: boolean
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          how_found_us?: string | null
          id?: string
          order_id?: string
          satisfaction?: number | null
          skipped?: boolean
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
          birth_date: string | null
          cpf: string | null
          created_at: string
          favorite_categories: string[]
          favorite_pokemons: string[]
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          favorite_categories?: string[]
          favorite_pokemons?: string[]
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          favorite_categories?: string[]
          favorite_pokemons?: string[]
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          card_id: string
          created_at: string
          expires_at: string
          id: string
          order_id: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          expires_at: string
          id?: string
          order_id?: string | null
          quantity: number
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      wishlist: {
        Row: {
          card_key: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_key: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_key?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_stock: { Args: { _card_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
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
      has_user_purchased: { Args: { _user_id: string }; Returns: boolean }
      increment_card_view: { Args: { _card_key: string }; Returns: undefined }
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
      card_category: "Pokémon" | "Treinador" | "Energia"
      card_condition: "M" | "NM" | "SP" | "MP" | "HP" | "D"
      card_finish:
        | "Normal"
        | "Foil"
        | "Reverse Foil"
        | "Pokebola"
        | "Energia"
        | "Promo"
        | "Ímã"
        | "Shattered Holo"
        | "Illustration Rare"
        | "Ultra Rara"
        | "Black Star Promo"
        | "Double Rare"
      card_language:
        | "Português"
        | "Inglês"
        | "Italiano"
        | "Espanhol"
        | "Japonês"
        | "Chinês"
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
      card_category: ["Pokémon", "Treinador", "Energia"],
      card_condition: ["M", "NM", "SP", "MP", "HP", "D"],
      card_finish: [
        "Normal",
        "Foil",
        "Reverse Foil",
        "Pokebola",
        "Energia",
        "Promo",
        "Ímã",
        "Shattered Holo",
        "Illustration Rare",
        "Ultra Rara",
        "Black Star Promo",
        "Double Rare",
      ],
      card_language: [
        "Português",
        "Inglês",
        "Italiano",
        "Espanhol",
        "Japonês",
        "Chinês",
      ],
    },
  },
} as const
