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
    PostgrestVersion: "13.0.5"
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
      business_brand_profile: {
        Row: {
          audience_breadth: string | null
          booking_link: string | null
          brand_profile_v5: Json | null
          brand_profile_v5_generated_at: string | null
          brand_profile_v5_version: string | null
          business_character: string | null
          business_id: string
          business_model_type: string | null
          certifications: string[] | null
          classification_rationale: string | null
          created_at: string | null
          cta_preference: string | null
          do_not_say: Json | null
          primary_copy_hook: string | null
          tone_keywords: string[] | null
          updated_at: string | null
          values: string[] | null
          voice_style: string | null
        }
        Insert: {
          audience_breadth?: string | null
          booking_link?: string | null
          brand_profile_v5?: Json | null
          brand_profile_v5_generated_at?: string | null
          brand_profile_v5_version?: string | null
          business_character?: string | null
          business_id: string
          business_model_type?: string | null
          certifications?: string[] | null
          classification_rationale?: string | null
          created_at?: string | null
          cta_preference?: string | null
          do_not_say?: Json | null
          primary_copy_hook?: string | null
          tone_keywords?: string[] | null
          updated_at?: string | null
          values?: string[] | null
          voice_style?: string | null
        }
        Update: {
          audience_breadth?: string | null
          booking_link?: string | null
          brand_profile_v5?: Json | null
          brand_profile_v5_generated_at?: string | null
          brand_profile_v5_version?: string | null
          business_character?: string | null
          business_id?: string
          business_model_type?: string | null
          certifications?: string[] | null
          classification_rationale?: string | null
          created_at?: string | null
          cta_preference?: string | null
          do_not_say?: Json | null
          primary_copy_hook?: string | null
          tone_keywords?: string[] | null
          updated_at?: string | null
          values?: string[] | null
          voice_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_brand_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_brand_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_documents: {
        Row: {
          business_id: string
          created_at: string | null
          document_type: string
          extracted_json: Json | null
          extracted_text: string | null
          file_name: string
          file_size: number | null
          id: string
          public_url: string
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          document_type: string
          extracted_json?: Json | null
          extracted_text?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          public_url: string
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          document_type?: string
          extracted_json?: Json | null
          extracted_text?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          public_url?: string
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_location_intelligence: {
        Row: {
          area_type: string | null
          business_id: string
          created_at: string | null
          has_view: boolean | null
          is_hidden_gem: boolean | null
          landmarks_nearby: Json | null
          last_updated_by_ai: string | null
          latitude: number | null
          location_marketing_hooks: string[] | null
          longitude: number | null
          neighborhood: string | null
          neighborhood_character: string | null
          outdoor_space_type: string | null
          public_transport: Json | null
          street_visibility: string | null
          updated_at: string | null
          user_confirmed_at: string | null
          view_type: string[] | null
        }
        Insert: {
          area_type?: string | null
          business_id: string
          created_at?: string | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          location_marketing_hooks?: string[] | null
          longitude?: number | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          public_transport?: Json | null
          street_visibility?: string | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
        }
        Update: {
          area_type?: string | null
          business_id?: string
          created_at?: string | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          location_marketing_hooks?: string[] | null
          longitude?: number | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          public_transport?: Json | null
          street_visibility?: string | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "business_location_intelligence_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_location_intelligence_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          label: string | null
          maps_url: string | null
          phone: string | null
          postal_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          maps_url?: string | null
          phone?: string | null
          postal_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          maps_url?: string | null
          phone?: string | null
          postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_operations: {
        Row: {
          accepts_walk_ins: boolean | null
          average_check_per_person: number | null
          business_id: string
          created_at: string | null
          currency: string | null
          has_delivery: boolean | null
          has_kids_menu: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_power_outlets: boolean | null
          has_table_service: boolean | null
          has_takeaway: boolean | null
          has_wifi: boolean | null
          kitchen_close_time: string | null
          opening_hours: Json | null
          price_level: string | null
          reservation_required: boolean | null
          seating_capacity_indoor: number | null
          seating_capacity_outdoor: number | null
          service_periods: Json | null
          typical_busy_periods: Json | null
          typical_slow_periods: Json | null
          updated_at: string | null
          weekly_programme: string | null
        }
        Insert: {
          accepts_walk_ins?: boolean | null
          average_check_per_person?: number | null
          business_id: string
          created_at?: string | null
          currency?: string | null
          has_delivery?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          opening_hours?: Json | null
          price_level?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
          service_periods?: Json | null
          typical_busy_periods?: Json | null
          typical_slow_periods?: Json | null
          updated_at?: string | null
          weekly_programme?: string | null
        }
        Update: {
          accepts_walk_ins?: boolean | null
          average_check_per_person?: number | null
          business_id?: string
          created_at?: string | null
          currency?: string | null
          has_delivery?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          opening_hours?: Json | null
          price_level?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
          service_periods?: Json | null
          typical_busy_periods?: Json | null
          typical_slow_periods?: Json | null
          updated_at?: string | null
          weekly_programme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_operations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_operations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          ai_brand_context: string | null
          ai_brand_context_approved: boolean | null
          ai_brand_context_generated_at: string | null
          booking_url: string | null
          business_id: string
          created_at: string | null
          detected_menu_urls: string[] | null
          founded_year: number | null
          key_offerings: string | null
          long_description: string | null
          menu_description: string | null
          menu_signal: Json | null
          menu_structure: Json | null
          price_level: string | null
          target_audience: string | null
          updated_at: string | null
        }
        Insert: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          booking_url?: string | null
          business_id: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          key_offerings?: string | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          price_level?: string | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          booking_url?: string | null
          business_id?: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          key_offerings?: string | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          price_level?: string | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_team_members: {
        Row: {
          accepted_at: string | null
          business_id: string
          id: string
          invited_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          id?: string
          invited_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          id?: string
          invited_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          ai_generations_this_month: number | null
          ai_generations_today: number | null
          country: string
          created_at: string | null
          id: string
          last_daily_reset: string | null
          last_monthly_reset: string | null
          last_quick_suggestions_reset: string | null
          logo_url: string | null
          name: string
          owner_id: string
          pdf_uploads_this_month: number | null
          pdf_uploads_today: number | null
          plan: string | null
          primary_language: string | null
          quick_suggestions_today: number
          scheduled_posts_this_month: number | null
          subpage_urls: Json | null
          updated_at: string | null
          vertical: string
          website_analysis_this_month: number | null
          website_analysis_today: number | null
          website_url: string | null
        }
        Insert: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          country?: string
          created_at?: string | null
          id?: string
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          last_quick_suggestions_reset?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          plan?: string | null
          primary_language?: string | null
          quick_suggestions_today?: number
          scheduled_posts_this_month?: number | null
          subpage_urls?: Json | null
          updated_at?: string | null
          vertical: string
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Update: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          country?: string
          created_at?: string | null
          id?: string
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          last_quick_suggestions_reset?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          plan?: string | null
          primary_language?: string | null
          quick_suggestions_today?: number
          scheduled_posts_this_month?: number | null
          subpage_urls?: Json | null
          updated_at?: string | null
          vertical?: string
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      daily_suggestions: {
        Row: {
          business_id: string
          caption_base: string | null
          content_type: string
          created_at: string
          cta_intent: string | null
          date: string
          first_text_generated_at: string | null
          generation_batch_id: string | null
          id: number
          is_active: boolean
          last_text_generated_at: string | null
          media_suggestion: Json | null
          menu_item_description: string | null
          menu_item_name: string | null
          photo_idea: string | null
          position: number
          rationale: string | null
          selected_at: string | null
          consumed_at: string | null
          published_at: string | null
          status: string
          suggested_time: string | null
          text_generated_count: number | null
          title: string
          weather_forecast: Json | null
          why_explanation: string | null
        }
        Insert: {
          business_id: string
          caption_base?: string | null
          content_type?: string
          created_at?: string
          cta_intent?: string | null
          date?: string
          first_text_generated_at?: string | null
          generation_batch_id?: string | null
          id?: number
          is_active?: boolean
          last_text_generated_at?: string | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_name?: string | null
          photo_idea?: string | null
          position: number
          rationale?: string | null
          selected_at?: string | null
          consumed_at?: string | null
          published_at?: string | null
          status?: string
          suggested_time?: string | null
          text_generated_count?: number | null
          title: string
          weather_forecast?: Json | null
          why_explanation?: string | null
        }
        Update: {
          business_id?: string
          caption_base?: string | null
          content_type?: string
          created_at?: string
          cta_intent?: string | null
          date?: string
          first_text_generated_at?: string | null
          generation_batch_id?: string | null
          id?: number
          is_active?: boolean
          last_text_generated_at?: string | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_name?: string | null
          photo_idea?: string | null
          position?: number
          rationale?: string | null
          selected_at?: string | null
          consumed_at?: string | null
          published_at?: string | null
          status?: string
          suggested_time?: string | null
          text_generated_count?: number | null
          title?: string
          weather_forecast?: Json | null
          why_explanation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_suggestions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "daily_suggestions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          ai_labels: Json | null
          business_id: string
          category_tags: string[] | null
          created_at: string | null
          id: string
          is_exterior: boolean | null
          is_hero: boolean | null
          is_interior: boolean | null
          is_team: boolean | null
          type: string | null
          url: string
        }
        Insert: {
          ai_labels?: Json | null
          business_id: string
          category_tags?: string[] | null
          created_at?: string | null
          id?: string
          is_exterior?: boolean | null
          is_hero?: boolean | null
          is_interior?: boolean | null
          is_team?: boolean | null
          type?: string | null
          url: string
        }
        Update: {
          ai_labels?: Json | null
          business_id?: string
          category_tags?: string[] | null
          created_at?: string | null
          id?: string
          is_exterior?: boolean | null
          is_hero?: boolean | null
          is_interior?: boolean | null
          is_team?: boolean | null
          type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "media_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_extractions: {
        Row: {
          business_id: string
          created_at: string | null
          created_by: string | null
          extracted_at: string | null
          extracted_data: Json
          id: string
          menu_name: string
          menu_source_id: string | null
          menu_type: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          created_by?: string | null
          extracted_at?: string | null
          extracted_data: Json
          id?: string
          menu_name: string
          menu_source_id?: string | null
          menu_type?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          extracted_at?: string | null
          extracted_data?: Json
          id?: string
          menu_name?: string
          menu_source_id?: string | null
          menu_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_extractions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "menu_extractions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_extractions_menu_source_id_fkey"
            columns: ["menu_source_id"]
            isOneToOne: false
            referencedRelation: "menu_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_results_v2: {
        Row: {
          attempts: number
          business_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          extraction_method: string | null
          id: string
          language_code: string | null
          raw_text: string | null
          sha256: string | null
          source_content_type: string | null
          source_id: string | null
          source_kind: string
          source_url: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          structured_data: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          business_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          language_code?: string | null
          raw_text?: string | null
          sha256?: string | null
          source_content_type?: string | null
          source_id?: string | null
          source_kind?: string
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          structured_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          business_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          language_code?: string | null
          raw_text?: string | null
          sha256?: string | null
          source_content_type?: string | null
          source_id?: string | null
          source_kind?: string
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          structured_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_results_v2_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "menu_results_v2_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_results_v2_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "menu_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sources: {
        Row: {
          business_id: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_name: string | null
          id: string
          label: string | null
          menu_type: string
          source_origin: string
          source_type: string
          source_url: string
          status: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          label?: string | null
          menu_type?: string
          source_origin: string
          source_type: string
          source_url: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          label?: string | null
          menu_type?: string
          source_origin?: string
          source_type?: string
          source_url?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_sources_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "menu_sources_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          business_id: string
          close_time: string | null
          closed: boolean | null
          created_at: string | null
          id: string
          kind: string | null
          open_time: string | null
          weekday: string
        }
        Insert: {
          business_id: string
          close_time?: string | null
          closed?: boolean | null
          created_at?: string | null
          id?: string
          kind?: string | null
          open_time?: string | null
          weekday: string
        }
        Update: {
          business_id?: string
          close_time?: string | null
          closed?: boolean | null
          created_at?: string | null
          id?: string
          kind?: string | null
          open_time?: string | null
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "opening_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_intelligence: {
        Row: {
          facebook_algorithm: Json | null
          google_my_business: Json | null
          id: number
          industry_benchmarks: Json | null
          instagram_algorithm: Json | null
          last_updated: string | null
          version: number | null
        }
        Insert: {
          facebook_algorithm?: Json | null
          google_my_business?: Json | null
          id?: number
          industry_benchmarks?: Json | null
          instagram_algorithm?: Json | null
          last_updated?: string | null
          version?: number | null
        }
        Update: {
          facebook_algorithm?: Json | null
          google_my_business?: Json | null
          id?: number
          industry_benchmarks?: Json | null
          instagram_algorithm?: Json | null
          last_updated?: string | null
          version?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about_text: string | null
          address: string | null
          ai_generations_this_month: number | null
          ai_generations_today: number | null
          business_category: string | null
          business_email: string | null
          business_name: string | null
          business_type: string | null
          country: string | null
          created_at: string | null
          email: string
          has_booking_button: boolean | null
          id: string
          keywords: string[] | null
          last_daily_reset: string | null
          last_monthly_reset: string | null
          onboarding_completed: boolean | null
          opening_hours: Json | null
          pdf_uploads_this_month: number | null
          pdf_uploads_today: number | null
          phone: string | null
          plan: string | null
          profile_completed: boolean | null
          scheduled_posts_this_month: number | null
          selected_platforms: Json | null
          social_platforms: string[] | null
          updated_at: string | null
          website_analysis_this_month: number | null
          website_analysis_today: number | null
          website_url: string | null
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          business_category?: string | null
          business_email?: string | null
          business_name?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          has_booking_button?: boolean | null
          id: string
          keywords?: string[] | null
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          onboarding_completed?: boolean | null
          opening_hours?: Json | null
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          phone?: string | null
          plan?: string | null
          profile_completed?: boolean | null
          scheduled_posts_this_month?: number | null
          selected_platforms?: Json | null
          social_platforms?: string[] | null
          updated_at?: string | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Update: {
          about_text?: string | null
          address?: string | null
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          business_category?: string | null
          business_email?: string | null
          business_name?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          has_booking_button?: boolean | null
          id?: string
          keywords?: string[] | null
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          onboarding_completed?: boolean | null
          opening_hours?: Json | null
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          phone?: string | null
          plan?: string | null
          profile_completed?: boolean | null
          scheduled_posts_this_month?: number | null
          selected_platforms?: Json | null
          social_platforms?: string[] | null
          updated_at?: string | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token_encrypted: string | null
          business_id: string
          created_at: string | null
          handle: string | null
          id: string
          is_connected: boolean | null
          platform: string
          profile_url: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          business_id: string
          created_at?: string | null
          handle?: string | null
          id?: string
          is_connected?: boolean | null
          platform: string
          profile_url?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          business_id?: string
          created_at?: string | null
          handle?: string | null
          id?: string
          is_connected?: boolean | null
          platform?: string
          profile_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "social_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      website_analyses: {
        Row: {
          business_id: string
          created_at: string | null
          error_message: string | null
          id: string
          last_run_at: string | null
          notes: string | null
          raw_result: Json | null
          source_url: string
          status: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          notes?: string | null
          raw_result?: Json | null
          source_url: string
          status?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          notes?: string | null
          raw_result?: Json | null
          source_url?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_analyses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "website_analyses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_knowledge_complete: {
        Row: {
          active_goals_count: number | null
          area_type: string | null
          business_id: string | null
          food_philosophy: string | null
          interior_style: string | null
          location_marketing_hooks: string[] | null
          market_position: Json | null
          neighborhood: string | null
          opening_hours: Json | null
          photography_style: Json | null
          price_level: string | null
          seating_capacity_indoor: number | null
          signature_items_count: number | null
          total_items_count: number | null
        }
        Relationships: []
      }
      v5_profile_summary: {
        Row: {
          brand_essence: string | null
          brand_profile_v5_generated_at: string | null
          business_id: string | null
          business_name: string | null
          completeness_status: string | null
          never_say_count: number | null
          programme_count: number | null
          tone_rules_count: number | null
          typical_openings_count: number | null
          v5_version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_brand_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_knowledge_complete"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_brand_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_ai_generation_quota: {
        Args: { user_id: string }
        Returns: {
          allowed: boolean
          current_daily: number
          current_monthly: number
          tier: string
        }[]
      }
      check_ai_generation_quota_business: {
        Args: { business_uuid: string }
        Returns: {
          allowed: boolean
          current_daily: number
          current_monthly: number
          tier: string
        }[]
      }
      claim_menu_result_v2: {
        Args: never
        Returns: {
          attempts: number
          business_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          extraction_method: string | null
          id: string
          language_code: string | null
          raw_text: string | null
          sha256: string | null
          source_content_type: string | null
          source_id: string | null
          source_kind: string
          source_url: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          structured_data: Json | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "menu_results_v2"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_old_daily_suggestions: { Args: never; Returns: undefined }
      create_business_onboarding: {
        Args: {
          p_user_id: string
          p_business_name: string
          p_selected_platforms: string[]
        }
        Returns: string
      }
      deactivate_old_suggestions: {
        Args: { p_business_id: string; p_date: string }
        Returns: undefined
      }
      delete_user_account: { Args: never; Returns: Json }
      exec_sql: { Args: { query: string }; Returns: undefined }
      get_daily_usage_stats: {
        Args: { p_business_id: string; p_date?: string }
        Returns: {
          regenerations_limit: number
          regenerations_used: number
          suggestions_count: number
          suggestions_selected: number
          texts_generated: number
          tier: string
        }[]
      }
      get_user_business_id: { Args: { user_id: string }; Returns: string }
      get_user_business_tier: { Args: { user_id: string }; Returns: string }
      has_business_access: { Args: { business_uuid: string }; Returns: boolean }
      increment_ai_generation: { Args: { user_id: string }; Returns: undefined }
      increment_ai_generation_business: {
        Args: { business_uuid: string }
        Returns: undefined
      }
      is_business_owner: { Args: { business_uuid: string }; Returns: boolean }
      is_team_member: { Args: { business_uuid: string }; Returns: boolean }
      record_text_generation: {
        Args: { p_suggestion_id: number }
        Returns: undefined
      }
      requeue_stale_menu_results_v2: {
        Args: { max_age_minutes?: number }
        Returns: number
      }
      reset_daily_quotas: { Args: never; Returns: undefined }
      reset_monthly_quotas: { Args: never; Returns: undefined }
      update_profile_onboarding:
        | {
            Args: {
              p_address: string
              p_business_category: string
              p_business_name: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_address: string
              p_business_category: string
              p_business_name: string
              p_selected_platforms?: Json
              p_user_id: string
            }
            Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
