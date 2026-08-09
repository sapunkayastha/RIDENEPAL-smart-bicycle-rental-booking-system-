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
      bikes: {
        Row: {
          available: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_per_day: number
          specs: Json
          type: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_per_day: number
          specs?: Json
          type?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_per_day?: number
          specs?: Json
          type?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          bike_id: string
          created_at: string
          end_date: string
          id: string
          pickup_location: string | null
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        Insert: {
          bike_id: string
          created_at?: string
          end_date: string
          id?: string
          pickup_location?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        Update: {
          bike_id?: string
          created_at?: string
          end_date?: string
          id?: string
          pickup_location?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          extension_id: string | null
          id: string
          provider: string
          raw_response: Json | null
          status: string
          transaction_uuid: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          extension_id?: string | null
          id?: string
          provider?: string
          raw_response?: Json | null
          status?: string
          transaction_uuid: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          extension_id?: string | null
          id?: string
          provider?: string
          raw_response?: Json | null
          status?: string
          transaction_uuid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "booking_extensions"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_path: string
          place: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path: string
          place?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path?: string
          place?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gallery_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "gallery_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "gallery_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_rent_requests: {
        Row: {
          bike_count: number
          contact_email: string
          created_at: string
          event_date: string | null
          id: string
          notes: string | null
          organization: string
          status: string
          user_id: string | null
        }
        Insert: {
          bike_count: number
          contact_email: string
          created_at?: string
          event_date?: string | null
          id?: string
          notes?: string | null
          organization: string
          status?: string
          user_id?: string | null
        }
        Update: {
          bike_count?: number
          contact_email?: string
          created_at?: string
          event_date?: string | null
          id?: string
          notes?: string | null
          organization?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      booking_extensions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          hours: number
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          hours: number
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          hours?: number
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_extensions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_catalog: {
        Row: {
          active: boolean
          created_at: string
          icon_key: string
          id: string
          name: string
          points_cost: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon_key?: string
          id?: string
          name: string
          points_cost: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          icon_key?: string
          id?: string
          name?: string
          points_cost?: number
          sort_order?: number
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          user_id: string
        }
        Insert: {
          id?: string
          points_spent: number
          redeemed_at?: string
          reward_id: string
          user_id: string
        }
        Update: {
          id?: string
          points_spent?: number
          redeemed_at?: string
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          otp_verified: boolean
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          otp_verified?: boolean
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          otp_verified?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      ride_locations: {
        Row: {
          accuracy: number | null
          booking_id: string
          id: number
          lat: number
          lng: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          booking_id: string
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          booking_id?: string
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_locations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "customer"
      booking_status: "pending" | "paid" | "active" | "completed" | "cancelled"
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
      app_role: ["super_admin", "admin", "customer"],
      booking_status: ["pending", "paid", "active", "completed", "cancelled"],
    },
  },
} as const
