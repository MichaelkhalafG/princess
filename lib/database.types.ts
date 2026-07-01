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
      attribute_definitions: {
        Row: {
          category_id: string | null
          id: string
          input: Database["public"]["Enums"]["attribute_input"]
          key_ar: string
          key_en: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          id?: string
          input?: Database["public"]["Enums"]["attribute_input"]
          key_ar: string
          key_en: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          id?: string
          input?: Database["public"]["Enums"]["attribute_input"]
          key_ar?: string
          key_en?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "attribute_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_options: {
        Row: {
          attribute_id: string
          id: string
          slug: string
          sort_order: number
          value_ar: string
          value_en: string
        }
        Insert: {
          attribute_id: string
          id?: string
          slug: string
          sort_order?: number
          value_ar: string
          value_en: string
        }
        Update: {
          attribute_id?: string
          id?: string
          slug?: string
          sort_order?: number
          value_ar?: string
          value_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          kind: string
          name_ar: string
          name_en: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          kind: string
          name_ar: string
          name_en: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          kind?: string
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          commission_products: number
          commission_rentals: number
          commission_services: number
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_products?: number
          commission_rentals?: number
          commission_services?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_products?: number
          commission_rentals?: number
          commission_services?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      platform_upfront_fees: {
        Row: {
          amount_minor: number
          currency: Database["public"]["Enums"]["currency_code"]
          offering_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_minor: number
          currency: Database["public"]["Enums"]["currency_code"]
          offering_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_minor?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          offering_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_upfront_fees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_upfront_fees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          attribute_id: string
          id: string
          option_id: string
          product_id: string
        }
        Insert: {
          attribute_id: string
          id?: string
          option_id: string
          product_id: string
        }
        Update: {
          attribute_id?: string
          id?: string
          option_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          is_available: boolean
          market: Database["public"]["Enums"]["market"]
          price: number
          product_id: string
          rental_daily_price: number | null
          security_deposit: number | null
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_available?: boolean
          market: Database["public"]["Enums"]["market"]
          price: number
          product_id: string
          rental_daily_price?: number | null
          security_deposit?: number | null
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_available?: boolean
          market?: Database["public"]["Enums"]["market"]
          price?: number
          product_id?: string
          rental_daily_price?: number | null
          security_deposit?: number | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_stock: {
        Row: {
          id: string
          market: Database["public"]["Enums"]["market"]
          stock: number
          variant_id: string
        }
        Insert: {
          id?: string
          market: Database["public"]["Enums"]["market"]
          stock?: number
          variant_id: string
        }
        Update: {
          id?: string
          market?: Database["public"]["Enums"]["market"]
          stock?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          id: string
          product_id: string
          size: string | null
          sku: string | null
        }
        Insert: {
          color?: string | null
          id?: string
          product_id: string
          size?: string | null
          sku?: string | null
        }
        Update: {
          color?: string | null
          id?: string
          product_id?: string
          size?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_rating: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          images: Json
          is_rentable: boolean
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          total_reviews: number
          updated_at: string
        }
        Insert: {
          avg_rating?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_rentable?: boolean
          seller_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          total_reviews?: number
          updated_at?: string
        }
        Update: {
          avg_rating?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_rentable?: boolean
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          total_reviews?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_verified: boolean
          locale: string
          market: Database["public"]["Enums"]["market"] | null
          phone: string | null
          provider_type: Database["public"]["Enums"]["provider_type"] | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_verified?: boolean
          locale?: string
          market?: Database["public"]["Enums"]["market"] | null
          phone?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"] | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean
          locale?: string
          market?: Database["public"]["Enums"]["market"] | null
          phone?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"] | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      vendor_markets: {
        Row: {
          branch_address: Json | null
          branch_name: string | null
          created_at: string
          id: string
          is_approved: boolean
          market: Database["public"]["Enums"]["market"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          branch_address?: Json | null
          branch_name?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          market: Database["public"]["Enums"]["market"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          branch_address?: Json | null
          branch_name?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          market?: Database["public"]["Enums"]["market"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_markets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_markets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_profiles"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
    }
    Views: {
      public_vendor_profiles: {
        Row: {
          avatar_url: string | null
          cities: string[] | null
          display_name: string | null
          is_verified: boolean | null
          markets: Database["public"]["Enums"]["market"][] | null
          member_since: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attribute_input: "select" | "multiselect"
      currency_code: "SAR" | "EGP"
      listing_status: "draft" | "active" | "inactive" | "rejected"
      market: "EG" | "SA"
      profile_status: "pending" | "active" | "suspended" | "rejected"
      provider_type: "freelancer" | "center"
      user_role: "customer" | "seller" | "provider" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attribute_input: ["select", "multiselect"],
      currency_code: ["SAR", "EGP"],
      listing_status: ["draft", "active", "inactive", "rejected"],
      market: ["EG", "SA"],
      profile_status: ["pending", "active", "suspended", "rejected"],
      provider_type: ["freelancer", "center"],
      user_role: ["customer", "seller", "provider", "admin"],
    },
  },
} as const
