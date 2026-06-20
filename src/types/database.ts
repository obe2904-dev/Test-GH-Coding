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
      brand_profile_generation_locks: {
        Row: {
          business_id: string
          request_id: string
          started_at: string
        }
        Insert: {
          business_id: string
          request_id: string
          started_at?: string
        }
        Update: {
          business_id?: string
          request_id?: string
          started_at?: string
        }
        Relationships: []
      }
      brand_profile_sources_state: {
        Row: {
          business_id: string
          business_snapshot_hash: string | null
          images_hash: string | null
          location_hash: string | null
          menu_hash: string | null
          profile_hash: string | null
          updated_at: string
          version_hash: string | null
          website_hash: string | null
        }
        Insert: {
          business_id: string
          business_snapshot_hash?: string | null
          images_hash?: string | null
          location_hash?: string | null
          menu_hash?: string | null
          profile_hash?: string | null
          updated_at?: string
          version_hash?: string | null
          website_hash?: string | null
        }
        Update: {
          business_id?: string
          business_snapshot_hash?: string | null
          images_hash?: string | null
          location_hash?: string | null
          menu_hash?: string | null
          profile_hash?: string | null
          updated_at?: string
          version_hash?: string | null
          website_hash?: string | null
        }
        Relationships: []
      }
      business_brand_profile: {
        Row: {
          atmosphere_confidence_level: string
          audience_breadth: string | null
          audience_segments: Json | null
          booking_link: string | null
          brand_context: Json | null
          brand_essence: string | null
          brand_essence_elaboration: string | null
          brand_origin_story: string | null
          business_archetype: string | null
          business_character: string | null
          business_id: string
          business_model_type: string | null
          business_voice: string | null
          certifications: string[] | null
          classification_rationale: string | null
          communication_goal: string | null
          content_exclusions: string | null
          content_focus: string | null
          content_pillars: string | null
          content_strategy: Json | null
          content_strategy_confirmed: boolean | null
          core_offerings: string | null
          core_offerings_jsonb: Json | null
          created_at: string | null
          cta_preference: string | null
          do_not_say: Json | null
          emoji_style: string | null
          emotional_promise: string | null
          formality: string | null
          founded_year: number | null
          generation_errors: Json | null
          guest_situation_type: string | null
          humor_level: string | null
          identity_keywords: string[] | null
          image_preferences: string | null
          image_preferences_jsonb: Json | null
          last_edited_at: string | null
          last_edited_by: string | null
          location_intelligence: Json | null
          never_say: string[] | null
          offerings_full: Json | null
          owner_document: Json | null
          owner_perspective: string | null
          posting_occasions: Json | null
          posting_occasions_hash: string | null
          post_length_guidelines: Json | null
          primary_copy_hook: string | null
          programme_revenue_weights: Json | null
          punctuation_style: string | null
          quality_status: string | null
          recognizable_interior_identity: string | null
          signature_approach: string | null
          signature_phrases: string[] | null
          social_style: Json | null
          storytelling_style: string | null
          target_audience: Json | null
          things_to_avoid: string | null
          things_to_avoid_jsonb: Json | null
          tone_keywords: string[] | null
          tone_model: Json | null
          tone_of_voice: string | null
          typical_closings: string[] | null
          typical_openings: string[] | null
          updated_at: string | null
          values: string[] | null
          venue_data_source: string | null
          venue_energy: string | null
          venue_scene: string | null
          version_hash: string | null
          visual_character: string | null
          voice_archetype: string | null
          voice_confidence_score: number | null
          voice_constraints: string | null
          voice_examples: Json | null
          voice_extracted_at: string | null
          voice_extraction_source: string | null
          voice_options: Json | null
          voice_rationale: string | null
        }
        Insert: {
          atmosphere_confidence_level?: string
          audience_breadth?: string | null
          audience_segments?: Json | null
          booking_link?: string | null
          brand_context?: Json | null
          brand_essence?: string | null
          brand_essence_elaboration?: string | null
          brand_origin_story?: string | null
          business_archetype?: string | null
          business_character?: string | null
          business_id: string
          business_model_type?: string | null
          business_voice?: string | null
          certifications?: string[] | null
          classification_rationale?: string | null
          communication_goal?: string | null
          content_exclusions?: string | null
          content_focus?: string | null
          content_pillars?: string | null
          content_strategy?: Json | null
          content_strategy_confirmed?: boolean | null
          core_offerings?: string | null
          core_offerings_jsonb?: Json | null
          created_at?: string | null
          cta_preference?: string | null
          do_not_say?: Json | null
          emoji_style?: string | null
          emotional_promise?: string | null
          formality?: string | null
          founded_year?: number | null
          generation_errors?: Json | null
          guest_situation_type?: string | null
          humor_level?: string | null
          identity_keywords?: string[] | null
          image_preferences?: string | null
          image_preferences_jsonb?: Json | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          location_intelligence?: Json | null
          never_say?: string[] | null
          offerings_full?: Json | null
          owner_document?: Json | null
          owner_perspective?: string | null
          posting_occasions?: Json | null
          posting_occasions_hash?: string | null
          post_length_guidelines?: Json | null
          primary_copy_hook?: string | null
          programme_revenue_weights?: Json | null
          punctuation_style?: string | null
          quality_status?: string | null
          recognizable_interior_identity?: string | null
          signature_approach?: string | null
          signature_phrases?: string[] | null
          social_style?: Json | null
          storytelling_style?: string | null
          target_audience?: Json | null
          things_to_avoid?: string | null
          things_to_avoid_jsonb?: Json | null
          tone_keywords?: string[] | null
          tone_model?: Json | null
          tone_of_voice?: string | null
          typical_closings?: string[] | null
          typical_openings?: string[] | null
          updated_at?: string | null
          values?: string[] | null
          venue_data_source?: string | null
          venue_energy?: string | null
          venue_scene?: string | null
          version_hash?: string | null
          visual_character?: string | null
          voice_archetype?: string | null
          voice_confidence_score?: number | null
          voice_constraints?: string | null
          voice_examples?: Json | null
          voice_extracted_at?: string | null
          voice_extraction_source?: string | null
          voice_options?: Json | null
          voice_rationale?: string | null
        }
        Update: {
          atmosphere_confidence_level?: string
          audience_breadth?: string | null
          audience_segments?: Json | null
          booking_link?: string | null
          brand_context?: Json | null
          brand_essence?: string | null
          brand_essence_elaboration?: string | null
          brand_origin_story?: string | null
          business_character?: string | null
          business_id?: string
          business_model_type?: string | null
          business_voice?: string | null
          certifications?: string[] | null
          classification_rationale?: string | null
          communication_goal?: string | null
          content_exclusions?: string | null
          content_focus?: string | null
          content_pillars?: string | null
          content_strategy?: Json | null
          content_strategy_confirmed?: boolean | null
          core_offerings?: string | null
          core_offerings_jsonb?: Json | null
          created_at?: string | null
          cta_preference?: string | null
          do_not_say?: Json | null
          emoji_style?: string | null
          emotional_promise?: string | null
          formality?: string | null
          founded_year?: number | null
          generation_errors?: Json | null
          guest_situation_type?: string | null
          humor_level?: string | null
          identity_keywords?: string[] | null
          image_preferences?: string | null
          image_preferences_jsonb?: Json | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          location_intelligence?: Json | null
          never_say?: string[] | null
          offerings_full?: Json | null
          owner_document?: Json | null
          owner_perspective?: string | null
          posting_occasions?: Json | null
          posting_occasions_hash?: string | null
          post_length_guidelines?: Json | null
          primary_copy_hook?: string | null
          programme_revenue_weights?: Json | null
          punctuation_style?: string | null
          quality_status?: string | null
          recognizable_interior_identity?: string | null
          signature_approach?: string | null
          signature_phrases?: string[] | null
          social_style?: Json | null
          storytelling_style?: string | null
          target_audience?: Json | null
          things_to_avoid?: string | null
          things_to_avoid_jsonb?: Json | null
          tone_keywords?: string[] | null
          tone_model?: Json | null
          tone_of_voice?: string | null
          typical_closings?: string[] | null
          typical_openings?: string[] | null
          updated_at?: string | null
          values?: string[] | null
          venue_data_source?: string | null
          venue_energy?: string | null
          venue_scene?: string | null
          version_hash?: string | null
          visual_character?: string | null
          voice_archetype?: string | null
          voice_confidence_score?: number | null
          voice_constraints?: string | null
          voice_examples?: Json | null
          voice_extracted_at?: string | null
          voice_extraction_source?: string | null
          voice_options?: Json | null
          voice_rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_brand_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_classes: {
        Row: {
          category: string | null
          business_id: string
          created_at: string | null
          day_of_week: number | null
          description: string | null
          duration_minutes: number
          id: string
          instructor_id: string | null
          instructor_name: string | null
          is_active: boolean | null
          max_capacity: number | null
          name: string
          requires_booking: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          duration_minutes: number
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          max_capacity?: number | null
          name: string
          requires_booking?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          max_capacity?: number | null
          name?: string
          requires_booking?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_classes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_products: {
        Row: {
          brand: string | null
          business_id: string
          category: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number | null
          sku: string | null
          stock_status: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          brand?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price?: number | null
          sku?: string | null
          stock_status?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          brand?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number | null
          sku?: string | null
          stock_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_services: {
        Row: {
          business_id: string
          available_online: boolean | null
          category: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          is_active: boolean | null
          is_featured: boolean | null
          display_order: number | null
          duration_minutes: number | null
          id: string
          name: string
          price: number | null
          price_to: number | null
          requires_booking: boolean | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          available_online?: boolean | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          display_order?: number | null
          duration_minutes?: number | null
          id?: string
          name: string
          price?: number | null
          price_to?: number | null
          requires_booking?: boolean | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          available_online?: boolean | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          display_order?: number | null
          duration_minutes?: number | null
          id?: string
          name?: string
          price?: number | null
          price_to?: number | null
          requires_booking?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_concept_fit: {
        Row: {
          analyzed_at: string | null
          analyzed_for_location_type: string | null
          avoid: Json | null
          business_id: string
          customer_fit: string | null
          emphasis: Json | null
          fit_reasons: Json | null
          mismatch_reasons: Json | null
          motivation_fit: string | null
          overall_fit_confidence: number | null
          overall_fit_level: string
          overall_fit_score: number | null
          pace_fit: string | null
          price_fit: string | null
          strategy_approach: string
          strengths: Json | null
          updated_at: string | null
          weaknesses: Json | null
          winning_angles_fit: string | null
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_for_location_type?: string | null
          avoid?: Json | null
          business_id: string
          customer_fit?: string | null
          emphasis?: Json | null
          fit_reasons?: Json | null
          mismatch_reasons?: Json | null
          motivation_fit?: string | null
          overall_fit_confidence?: number | null
          overall_fit_level: string
          overall_fit_score?: number | null
          pace_fit?: string | null
          price_fit?: string | null
          strategy_approach: string
          strengths?: Json | null
          updated_at?: string | null
          weaknesses?: Json | null
          winning_angles_fit?: string | null
        }
        Update: {
          analyzed_at?: string | null
          analyzed_for_location_type?: string | null
          avoid?: Json | null
          business_id?: string
          customer_fit?: string | null
          emphasis?: Json | null
          fit_reasons?: Json | null
          mismatch_reasons?: Json | null
          motivation_fit?: string | null
          overall_fit_confidence?: number | null
          overall_fit_level?: string
          overall_fit_score?: number | null
          pace_fit?: string | null
          price_fit?: string | null
          strategy_approach?: string
          strengths?: Json | null
          updated_at?: string | null
          weaknesses?: Json | null
          winning_angles_fit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_concept_fit_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_concept_fit_business_id_fkey1"
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_location_intelligence: {
        Row: {
          area_type: string | null
          business_id: string
          category_scores: Json | null
          concept_fit_analyzed_at: string | null
          concept_fit_by_category: Json | null
          created_at: string | null
          has_view: boolean | null
          is_hidden_gem: boolean | null
          landmarks_nearby: Json | null
          last_updated_by_ai: string | null
          latitude: number | null
          location_marketing_hooks: string[] | null
          location_type_matches: Json | null
          longitude: number | null
          nearby_hospitality: Json | null
          neighborhood: string | null
          neighborhood_character: string | null
          outdoor_space_type: string | null
          public_transport: Json | null
          street_visibility: string | null
          updated_at: string | null
          user_confirmed_at: string | null
          view_type: string[] | null
          when_analysis: Json | null
          when_analysis_internal: Json | null
          who_analysis: Json | null
          who_analysis_internal: Json | null
          why_analysis: Json | null
          why_analysis_internal: Json | null
        }
        Insert: {
          area_type?: string | null
          business_id: string
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          public_transport?: Json | null
          street_visibility?: string | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who_analysis?: Json | null
          who_analysis_internal?: Json | null
          why_analysis?: Json | null
          why_analysis_internal?: Json | null
        }
        Update: {
          area_type?: string | null
          business_id?: string
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          public_transport?: Json | null
          street_visibility?: string | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who_analysis?: Json | null
          who_analysis_internal?: Json | null
          why_analysis?: Json | null
          why_analysis_internal?: Json | null
        }
        Relationships: [
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
          enrichment: Json | null
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
          enrichment?: Json | null
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
          enrichment?: Json | null
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_operations: {
        Row: {
          accepts_walk_ins: boolean | null
          business_id: string
          created_at: string | null
          establishment_type: string | null
          has_delivery: boolean | null
          has_english_menu: boolean | null
          has_kids_menu: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_power_outlets: boolean | null
          has_table_service: boolean | null
          has_takeaway: boolean | null
          has_wifi: boolean | null
          kitchen_close_time: string | null
          opening_hours: Json | null
          preferred_posts_per_week: number | null
          price_level: string | null
          primary_service_period: string | null
          reservation_required: boolean | null
          seating_capacity_indoor: number | null
          seating_capacity_outdoor: number | null
          updated_at: string | null
          weekly_programme: string | null
        }
        Insert: {
          accepts_walk_ins?: boolean | null
          business_id: string
          created_at?: string | null
          establishment_type?: string | null
          has_delivery?: boolean | null
          has_english_menu?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          opening_hours?: Json | null
          preferred_posts_per_week?: number | null
          price_level?: string | null
          primary_service_period?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
          updated_at?: string | null
          weekly_programme?: string | null
        }
        Update: {
          accepts_walk_ins?: boolean | null
          business_id?: string
          created_at?: string | null
          establishment_type?: string | null
          has_delivery?: boolean | null
          has_english_menu?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          opening_hours?: Json | null
          preferred_posts_per_week?: number | null
          price_level?: string | null
          primary_service_period?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
          updated_at?: string | null
          weekly_programme?: string | null
        }
        Relationships: [
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
          business_id: string
          created_at: string | null
          detected_menu_urls: string[] | null
          founded_year: number | null
          long_description: string | null
          menu_description: string | null
          menu_signal: Json | null
          menu_structure: Json | null
          short_description: string | null
          updated_at: string | null
        }
        Insert: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          business_id: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          short_description?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          business_id?: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          short_description?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_type_defaults: {
        Row: {
          behind_scenes_ratio: number | null
          business_type: string
          caption_length: string | null
          created_at: string | null
          default_tone: string | null
          emoji_frequency: string | null
          engagement_ratio: number | null
          event_promotion_ratio: number | null
          facebook_weight: number | null
          ideal_posts_per_week: number
          instagram_weight: number | null
          location_story_ratio: number | null
          max_posts_per_week: number
          menu_highlight_ratio: number | null
          min_posts_per_week: number
          updated_at: string | null
        }
        Insert: {
          behind_scenes_ratio?: number | null
          business_type: string
          caption_length?: string | null
          created_at?: string | null
          default_tone?: string | null
          emoji_frequency?: string | null
          engagement_ratio?: number | null
          event_promotion_ratio?: number | null
          facebook_weight?: number | null
          ideal_posts_per_week: number
          instagram_weight?: number | null
          location_story_ratio?: number | null
          max_posts_per_week: number
          menu_highlight_ratio?: number | null
          min_posts_per_week: number
          updated_at?: string | null
        }
        Update: {
          behind_scenes_ratio?: number | null
          business_type?: string
          caption_length?: string | null
          created_at?: string | null
          default_tone?: string | null
          emoji_frequency?: string | null
          engagement_ratio?: number | null
          event_promotion_ratio?: number | null
          facebook_weight?: number | null
          ideal_posts_per_week?: number
          instagram_weight?: number | null
          location_story_ratio?: number | null
          max_posts_per_week?: number
          menu_highlight_ratio?: number | null
          min_posts_per_week?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      businesses: {
        Row: {
          ai_generations_this_month: number | null
          ai_generations_today: number | null
          category: string | null
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
          quick_suggestions_today: number | null
          scheduled_posts_this_month: number | null
          selected_platforms: Json | null
          subpage_urls: Json | null
          subscription_tier: string | null
          updated_at: string | null
          vertical: string
          video_uploads_this_week: number | null
          website_analysis_this_month: number | null
          website_analysis_today: number | null
          website_url: string | null
        }
        Insert: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          category?: string | null
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
          quick_suggestions_today?: number | null
          scheduled_posts_this_month?: number | null
          selected_platforms?: Json | null
          subpage_urls?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
          vertical: string
          video_uploads_this_week?: number | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Update: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          category?: string | null
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
          quick_suggestions_today?: number | null
          scheduled_posts_this_month?: number | null
          selected_platforms?: Json | null
          subpage_urls?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
          vertical?: string
          video_uploads_this_week?: number | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      content_distribution_rules: {
        Row: {
          baseline_percentage: number
          business_type: string
          content_type_id: string
          created_at: string | null
          examples: string[] | null
          id: string
          min_days_between: number | null
          posts_per_week: number | null
          priority: number | null
          rationale: string | null
        }
        Insert: {
          baseline_percentage: number
          business_type: string
          content_type_id: string
          created_at?: string | null
          examples?: string[] | null
          id?: string
          min_days_between?: number | null
          posts_per_week?: number | null
          priority?: number | null
          rationale?: string | null
        }
        Update: {
          baseline_percentage?: number
          business_type?: string
          content_type_id?: string
          created_at?: string | null
          examples?: string[] | null
          id?: string
          min_days_between?: number | null
          posts_per_week?: number | null
          priority?: number | null
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_distribution_rules_business_type_fkey"
            columns: ["business_type"]
            isOneToOne: false
            referencedRelation: "business_type_defaults"
            referencedColumns: ["business_type"]
          },
          {
            foreignKeyName: "content_distribution_rules_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          facebook_priority: number | null
          id: string
          instagram_priority: number | null
          is_promotional: boolean | null
          is_time_sensitive: boolean | null
          max_frequency_per_week: number | null
          requires_high_quality_photo: boolean | null
          requires_user_permission: boolean | null
          typical_photo_style: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          facebook_priority?: number | null
          id: string
          instagram_priority?: number | null
          is_promotional?: boolean | null
          is_time_sensitive?: boolean | null
          max_frequency_per_week?: number | null
          requires_high_quality_photo?: boolean | null
          requires_user_permission?: boolean | null
          typical_photo_style?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          facebook_priority?: number | null
          id?: string
          instagram_priority?: number | null
          is_promotional?: boolean | null
          is_time_sensitive?: boolean | null
          max_frequency_per_week?: number | null
          requires_high_quality_photo?: boolean | null
          requires_user_permission?: boolean | null
          typical_photo_style?: string | null
        }
        Relationships: []
      }
      contextual_calendar: {
        Row: {
          commercial_weight: number
          content_angle: string | null
          country: string
          created_at: string | null
          date_end: string | null
          date_start: string
          event_name: string
          event_type: string
          id: string
          lead_days: number
          marketing_hook: string | null
          recurrence: string | null
          recurrence_rule: string | null
          region: string | null
          relevance_tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          commercial_weight?: number
          content_angle?: string | null
          country: string
          created_at?: string | null
          date_end?: string | null
          date_start: string
          event_name: string
          event_type: string
          id?: string
          lead_days?: number
          marketing_hook?: string | null
          recurrence?: string | null
          recurrence_rule?: string | null
          region?: string | null
          relevance_tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          commercial_weight?: number
          content_angle?: string | null
          country?: string
          created_at?: string | null
          date_end?: string | null
          date_start?: string
          event_name?: string
          event_type?: string
          id?: string
          lead_days?: number
          marketing_hook?: string | null
          recurrence?: string | null
          recurrence_rule?: string | null
          region?: string | null
          relevance_tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_suggestions: {
        Row: {
          business_id: string
          caption_base: string
          content_type: string
          cover_url: string | null
          created_at: string | null
          cta_intent: string
          date: string
          generated_at: string | null
          generated_hashtags: Json | null
          generated_platform_content: Json | null
          generated_text: string | null
          id: number
          is_active: boolean | null
          media_items: Json | null
          media_suggestion: Json | null
          menu_item_description: string
          menu_item_name: string
          photo_analysis: Json | null
          photo_idea: string | null
          platforms_generated: string[] | null
          position: number
          rationale: string
          selected: boolean | null
          selected_at: string | null
          consumed_at: string | null
          published_at: string | null
          status: string
          suggested_time: string | null
          text_generation_version: number
          thumbs_up: boolean | null
          title: string
          updated_at: string | null
          uploaded_photo_url: string | null
          weather_forecast: Json | null
          why_explanation: string | null
        }
        Insert: {
          business_id: string
          caption_base?: string
          content_type: string
          cover_url?: string | null
          created_at?: string | null
          cta_intent?: string
          date?: string
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          id?: number
          is_active?: boolean | null
          media_items?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string
          menu_item_name?: string
          photo_analysis?: Json | null
          photo_idea?: string | null
          platforms_generated?: string[] | null
          position: number
          rationale: string
          selected?: boolean | null
          selected_at?: string | null
          consumed_at?: string | null
          published_at?: string | null
          status?: string
          suggested_time?: string | null
          text_generation_version?: number
          thumbs_up?: boolean | null
          title: string
          updated_at?: string | null
          uploaded_photo_url?: string | null
          weather_forecast?: Json | null
          why_explanation?: string | null
        }
        Update: {
          business_id?: string
          caption_base?: string
          content_type?: string
          cover_url?: string | null
          created_at?: string | null
          cta_intent?: string
          date?: string
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          id?: number
          is_active?: boolean | null
          media_items?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string
          menu_item_name?: string
          photo_analysis?: Json | null
          photo_idea?: string | null
          platforms_generated?: string[] | null
          position?: number
          rationale?: string
          selected?: boolean | null
          selected_at?: string | null
          consumed_at?: string | null
          published_at?: string | null
          status?: string
          suggested_time?: string | null
          text_generation_version?: number
          thumbs_up?: boolean | null
          title?: string
          updated_at?: string | null
          uploaded_photo_url?: string | null
          weather_forecast?: Json | null
          why_explanation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_suggestions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_metadata: {
        Row: {
          avg_engagement_rate: number | null
          business_id: string
          created_at: string | null
          dish_temp_category: string | null
          id: string
          is_limited_time: boolean | null
          is_seasonal: boolean | null
          is_signature: boolean | null
          item_added_date: string | null
          item_available_from: string | null
          item_available_to: string | null
          item_category: string | null
          item_name: string
          item_section: string | null
          last_engagement_rate: number | null
          last_posted_date: string | null
          location_tags: string[] | null
          seasonal_ingredients: Json | null
          total_times_posted: number | null
          updated_at: string | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          business_id: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_added_date?: string | null
          item_available_from?: string | null
          item_available_to?: string | null
          item_category?: string | null
          item_name: string
          item_section?: string | null
          last_engagement_rate?: number | null
          last_posted_date?: string | null
          location_tags?: string[] | null
          seasonal_ingredients?: Json | null
          total_times_posted?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_engagement_rate?: number | null
          business_id?: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_added_date?: string | null
          item_available_from?: string | null
          item_available_to?: string | null
          item_category?: string | null
          item_name?: string
          item_section?: string | null
          last_engagement_rate?: number | null
          last_posted_date?: string | null
          location_tags?: string[] | null
          seasonal_ingredients?: Json | null
          total_times_posted?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_metadata_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items_normalized: {
        Row: {
          business_id: string
          category_name: string
          category_type: string
          created_at: string | null
          dish_temp_category: string | null
          id: string
          is_limited_time: boolean | null
          is_seasonal: boolean | null
          is_signature: boolean | null
          item_description: string | null
          item_name: string
          item_price: string | null
          location_tags: string[] | null
          menu_result_id: string
          menu_title: string | null
          menu_url: string | null
          media_category: string | null
          seasonal_ingredients: string[] | null
          service_period_name: string | null
          service_periods: string[]
          source_sha256: string | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          category_name: string
          category_type: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_description?: string | null
          item_name: string
          item_price?: string | null
          location_tags?: string[] | null
          menu_result_id: string
          menu_title?: string | null
          menu_url?: string | null
          media_category?: string | null
          seasonal_ingredients?: string[] | null
          service_period_name?: string | null
          service_periods?: string[]
          source_sha256?: string | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          category_name?: string
          category_type?: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_description?: string | null
          item_name?: string
          item_price?: string | null
          location_tags?: string[] | null
          menu_result_id?: string
          menu_title?: string | null
          menu_url?: string | null
          media_category?: string | null
          seasonal_ingredients?: string[] | null
          service_period_name?: string | null
          service_periods?: string[]
          source_sha256?: string | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_normalized_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_normalized_menu_result_id_fkey"
            columns: ["menu_result_id"]
            isOneToOne: false
            referencedRelation: "menu_results_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_results_v2: {
        Row: {
          ai_summary: string | null
          attempts: number
          business_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          dish_temp_category: string | null
          error_message: string | null
          extraction_method: string | null
          id: string
          is_signature: boolean | null
          language_code: string | null
          raw_text: string | null
          service_period_name: string | null
          service_periods: string[] | null
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
          ai_summary?: string | null
          attempts?: number
          business_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          dish_temp_category?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          is_signature?: boolean | null
          language_code?: string | null
          raw_text?: string | null
          service_period_name?: string | null
          service_periods?: string[] | null
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
          ai_summary?: string | null
          attempts?: number
          business_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          dish_temp_category?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          is_signature?: boolean | null
          language_code?: string | null
          raw_text?: string | null
          service_period_name?: string | null
          service_periods?: string[] | null
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
          is_social_lead: boolean | null
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
          is_social_lead?: boolean | null
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
          is_social_lead?: boolean | null
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_atmosphere_log: {
        Row: {
          business_id: string
          content_type: string
          created_at: string
          id: string
          photo_url_hash: string
          venue_scene: string
          visual_character: string | null
        }
        Insert: {
          business_id: string
          content_type: string
          created_at?: string
          id?: string
          photo_url_hash: string
          venue_scene: string
          visual_character?: string | null
        }
        Update: {
          business_id?: string
          content_type?: string
          created_at?: string
          id?: string
          photo_url_hash?: string
          venue_scene?: string
          visual_character?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_atmosphere_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_assignment_rules: {
        Row: {
          content_type_id: string
          created_at: string | null
          id: string
          primary_platform: string
          rule_description: string
          secondary_platform: string | null
          why: string | null
        }
        Insert: {
          content_type_id: string
          created_at?: string | null
          id?: string
          primary_platform: string
          rule_description: string
          secondary_platform?: string | null
          why?: string | null
        }
        Update: {
          content_type_id?: string
          created_at?: string | null
          id?: string
          primary_platform?: string
          rule_description?: string
          secondary_platform?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_assignment_rules_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: true
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
        ]
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
          business_offerings: Json | null
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
          business_offerings?: Json | null
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
          business_offerings?: Json | null
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
      seasonal_ingredients: {
        Row: {
          bonus_points: number | null
          country_code: string | null
          created_at: string | null
          id: string
          ingredient_name: string
          peak_months: number[]
          season: string
        }
        Insert: {
          bonus_points?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ingredient_name: string
          peak_months: number[]
          season: string
        }
        Update: {
          bonus_points?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ingredient_name?: string
          peak_months?: number[]
          season?: string
        }
        Relationships: []
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_content_plans: {
        Row: {
          business_id: string
          created_at: string | null
          generated_at: string | null
          id: string
          learning_data: Json | null
          posts: Json
          strategy_id: string | null
          summary: Json | null
          updated_at: string | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          learning_data?: Json | null
          posts?: Json
          strategy_id?: string | null
          summary?: Json | null
          updated_at?: string | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          learning_data?: Json | null
          posts?: Json
          strategy_id?: string | null
          summary?: Json | null
          updated_at?: string | null
          user_id?: string
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_content_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_content_plans_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "weekly_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_strategies: {
        Row: {
          business_id: string
          business_type: string
          content_strategy_snapshot: Json | null
          country: string | null
          generated_at: string | null
          id: string
          is_current_week: boolean | null
          narrative: Json
          platforms: string[] | null
          post_ideas: Json
          selected_idea_ids: number[] | null
          status: string | null
          strategic_brief: Json | null
          strategic_brief_raw: string | null
          strategic_priorities: Json
          strategy_rationale: string | null
          strategy_version: string | null
          subscription_tier: string | null
          target_post_count: number | null
          week_context_snapshot: Json | null
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          business_id: string
          business_type: string
          content_strategy_snapshot?: Json | null
          country?: string | null
          generated_at?: string | null
          id?: string
          is_current_week?: boolean | null
          narrative: Json
          platforms?: string[] | null
          post_ideas: Json
          selected_idea_ids?: number[] | null
          status?: string | null
          strategic_brief?: Json | null
          strategic_brief_raw?: string | null
          strategic_priorities: Json
          strategy_rationale?: string | null
          strategy_version?: string | null
          subscription_tier?: string | null
          target_post_count?: number | null
          week_context_snapshot?: Json | null
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          business_id?: string
          business_type?: string
          content_strategy_snapshot?: Json | null
          country?: string | null
          generated_at?: string | null
          id?: string
          is_current_week?: boolean | null
          narrative?: Json
          platforms?: string[] | null
          post_ideas?: Json
          selected_idea_ids?: number[] | null
          status?: string | null
          strategic_brief?: Json | null
          strategic_brief_raw?: string | null
          strategic_priorities?: Json
          strategy_rationale?: string | null
          strategy_version?: string | null
          subscription_tier?: string | null
          target_post_count?: number | null
          week_context_snapshot?: Json | null
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_strategies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_content_baselines: {
        Args: { p_business_id: string }
        Returns: Json
      }
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
          ai_summary: string | null
          attempts: number
          business_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          dish_temp_category: string | null
          error_message: string | null
          extraction_method: string | null
          id: string
          is_signature: boolean | null
          language_code: string | null
          raw_text: string | null
          service_period_name: string | null
          service_periods: string[] | null
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
      classify_category_type: {
        Args: { category_name: string }
        Returns: string
      }
      create_business_onboarding:
        | {
            Args: {
              p_business_name: string
              p_business_vertical: string
              p_city: string
              p_country: string
              p_postal_code: string
              p_selected_platforms: string[]
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_business_name: string
              p_business_vertical: string
              p_city: string
              p_country: string
              p_postal_code: string
              p_selected_platforms: string[]
              p_user_id: string
              p_website_url?: string
            }
            Returns: string
          }
      deactivate_old_suggestions: {
        Args: { p_business_id: string; p_date: string }
        Returns: undefined
      }
      delete_user_account: { Args: never; Returns: Json }
      derive_service_periods: {
        Args: { business_id_param: string }
        Returns: {
          posting_windows: Json
          primary_period: string
          service_periods: string[]
        }[]
      }
      generate_weekly_post_slots: {
        Args: { p_business_type: string }
        Returns: {
          content_type: string
          display_name: string
          rationale: string
          slot_number: number
          suggested_platform: string
        }[]
      }
      get_content_distribution: {
        Args: { p_business_type: string }
        Returns: {
          baseline_percentage: number
          content_type: string
          display_name: string
          examples: string[]
          posts_per_week: number
          primary_platform: string
          priority: number
          rationale: string
        }[]
      }
      get_contextual_events: {
        Args: {
          p_country: string
          p_end_date: string
          p_start_date: string
          p_tags?: string[]
        }
        Returns: {
          commercial_weight: number
          content_angle: string
          date_end: string
          date_start: string
          event_name: string
          event_type: string
          lead_days: number
          marketing_hook: string
          relevance_tags: string[]
        }[]
      }
      get_performance_adjusted_distribution: {
        Args: { p_business_id: string; p_business_type: string }
        Returns: {
          adjusted_percentage: number
          adjustment_reason: string
          baseline_percentage: number
          content_type: string
          priority: number
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
      log_post_performance: {
        Args: {
          p_business_id: string
          p_clicks?: number
          p_comments?: number
          p_content_type: string
          p_engagement: number
          p_likes?: number
          p_platform: string
          p_post_idea_id: string
          p_posted_at: string
          p_reach: number
          p_saves?: number
          p_shares?: number
        }
        Returns: string
      }
      requeue_stale_menu_results_v2: {
        Args: { max_age_minutes?: number }
        Returns: number
      }
      reset_daily_quotas: { Args: never; Returns: undefined }
      reset_monthly_quotas: { Args: never; Returns: undefined }
      reset_weekly_video_quota: { Args: never; Returns: undefined }
      track_opportunity_trigger: {
        Args: {
          p_business_id: string
          p_context?: Json
          p_opportunity_subtype?: string
          p_opportunity_type: string
        }
        Returns: undefined
      }
      update_menu_item_posted: {
        Args: {
          p_business_id: string
          p_engagement_rate?: number
          p_item_name: string
        }
        Returns: undefined
      }
      update_post_performance: {
        Args: {
          p_clicks?: number
          p_engagement: number
          p_post_idea_id: string
          p_reach: number
        }
        Returns: undefined
      }
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
