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
      asset_meta: {
        Row: {
          alt: string | null
          caption: string | null
          description: string | null
          label: string | null
          tags: string[]
          updated_at: string
          url: string
        }
        Insert: {
          alt?: string | null
          caption?: string | null
          description?: string | null
          label?: string | null
          tags?: string[]
          updated_at?: string
          url: string
        }
        Update: {
          alt?: string | null
          caption?: string | null
          description?: string | null
          label?: string | null
          tags?: string[]
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          archived: boolean
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          read_at: string | null
          source_path: string | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          read_at?: string | null
          source_path?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          read_at?: string | null
          source_path?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      galleries: {
        Row: {
          created_at: string
          id: string
          slug: string
          tagline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          tagline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          tagline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          alt: string | null
          created_at: string
          gallery_id: string
          id: string
          media_asset_id: string | null
          position: number
          src: string
          title: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          gallery_id: string
          id?: string
          media_asset_id?: string | null
          position?: number
          src: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          gallery_id?: string
          id?: string
          media_asset_id?: string | null
          position?: number
          src?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt: string | null
          bucket: string
          caption: string | null
          content_type: string | null
          created_at: string
          description: string | null
          duration: number | null
          filename: string
          folder: string | null
          height: number | null
          id: string
          kind: string
          label: string | null
          media_type: string | null
          mime_type: string | null
          object_key: string
          optimized_object_key: string | null
          optimized_url: string | null
          original_filename: string | null
          original_object_key: string | null
          original_url: string | null
          size: number | null
          storage_provider: string
          tags: string[]
          updated_at: string
          upload_date: string | null
          url: string
          used_on_site: boolean
          width: number | null
        }
        Insert: {
          alt?: string | null
          bucket?: string
          caption?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          filename: string
          folder?: string | null
          height?: number | null
          id?: string
          kind?: string
          label?: string | null
          media_type?: string | null
          mime_type?: string | null
          object_key: string
          optimized_object_key?: string | null
          optimized_url?: string | null
          original_filename?: string | null
          original_object_key?: string | null
          original_url?: string | null
          size?: number | null
          storage_provider?: string
          tags?: string[]
          updated_at?: string
          upload_date?: string | null
          url: string
          used_on_site?: boolean
          width?: number | null
        }
        Update: {
          alt?: string | null
          bucket?: string
          caption?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          filename?: string
          folder?: string | null
          height?: number | null
          id?: string
          kind?: string
          label?: string | null
          media_type?: string | null
          mime_type?: string | null
          object_key?: string
          optimized_object_key?: string | null
          optimized_url?: string | null
          original_filename?: string | null
          original_object_key?: string | null
          original_url?: string | null
          size?: number | null
          storage_provider?: string
          tags?: string[]
          updated_at?: string
          upload_date?: string | null
          url?: string
          used_on_site?: boolean
          width?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          label: string
          path: string
          position: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          path: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          path?: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      page_seo: {
        Row: {
          description: string | null
          keywords: string | null
          og_image: string | null
          path: string
          title: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          keywords?: string | null
          og_image?: string | null
          path: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          keywords?: string | null
          og_image?: string | null
          path?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          path: string
          referrer: string | null
          search_query: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          search_query?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          search_query?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          body: Json
          created_at: string
          id: string
          published: boolean
          seo_description: string | null
          seo_title: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          id?: string
          published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
