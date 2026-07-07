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
      approved_testers: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: []
      }
      brand_profile_sources_state: {
        Row: {
          business_id: string
          business_snapshot_changed_at: string | null
          business_snapshot_hash: string | null
          created_at: string | null
          images_changed_at: string | null
          images_hash: string | null
          location_changed_at: string | null
          location_hash: string | null
          menu_changed_at: string | null
          menu_hash: string | null
          profile_changed_at: string | null
          profile_hash: string | null
          updated_at: string | null
          version_hash: string
          website_changed_at: string | null
          website_hash: string | null
        }
        Insert: {
          business_id: string
          business_snapshot_changed_at?: string | null
          business_snapshot_hash?: string | null
          created_at?: string | null
          images_changed_at?: string | null
          images_hash?: string | null
          location_changed_at?: string | null
          location_hash?: string | null
          menu_changed_at?: string | null
          menu_hash?: string | null
          profile_changed_at?: string | null
          profile_hash?: string | null
          updated_at?: string | null
          version_hash: string
          website_changed_at?: string | null
          website_hash?: string | null
        }
        Update: {
          business_id?: string
          business_snapshot_changed_at?: string | null
          business_snapshot_hash?: string | null
          created_at?: string | null
          images_changed_at?: string | null
          images_hash?: string | null
          location_changed_at?: string | null
          location_hash?: string | null
          menu_changed_at?: string | null
          menu_hash?: string | null
          profile_changed_at?: string | null
          profile_hash?: string | null
          updated_at?: string | null
          version_hash?: string
          website_changed_at?: string | null
          website_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profile_sources_state_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_brand_profile: {
        Row: {
          audience_framework: Json | null
          audience_segments: Json | null
          booking_link: string | null
          brand_essence: string | null
          brand_profile_v5: Json | null
          brand_profile_v5_generated_at: string | null
          brand_profile_v5_version: string | null
          business_archetype:
            | Database["public"]["Enums"]["business_archetype_enum"]
            | null
          business_character: string | null
          business_id: string
          business_identity_persona: string | null
          busy_pattern: Json | null
          certifications: string[] | null
          commercial_baseline_mode: string | null
          communication_goal: string | null
          content_focus: string | null
          content_pillars: string | null
          content_strategy: Json | null
          core_offerings: string[] | null
          core_offerings_jsonb: Json | null
          core_values: string[] | null
          created_at: string | null
          cta_preference: string | null
          data_sources_used: Json | null
          do_not_say: Json | null
          enhanced_avoid_examples: Json | null
          enhanced_social_examples: Json | null
          execution_profile: Json | null
          gastronomic_profile: string | null
          generation_errors: Json | null
          generation_status: Json | null
          identity_confidence: number | null
          identity_keywords: string | null
          identity_reasoning: string | null
          image_preferences: string | null
          image_preferences_jsonb: Json | null
          last_edited_at: string | null
          last_edited_by: string | null
          location_intelligence: Json | null
          location_strategy: Json | null
          marketing_manager_brief: string | null
          menu_overview_summary: Json | null
          positioning: string | null
          posting_occasions: Json | null
          posting_occasions_hash: string | null
          posting_strategy: Json | null
          primary_copy_hook: string | null
          recognizable_interior_identity: string | null
          revenue_drivers: Json | null
          signature_themes: string[] | null
          social_style: Json | null
          social_writing_examples: Json | null
          strategic_audience_segments: Json | null
          strategic_coverage: Json | null
          target_audience: string | null
          target_type_mix: Json | null
          things_to_avoid: string | null
          things_to_avoid_jsonb: Json | null
          tone_keywords: string[] | null
          tone_model: Json | null
          tone_of_voice: string | null
          trigger_configuration: Json | null
          trigger_updated_at: string | null
          trigger_updated_by: string | null
          typical_openings: string[] | null
          updated_at: string | null
          version_hash: string | null
          voice_constraints: string | null
          voice_examples: Json | null
          voice_guardrails: Json | null
          voice_rationale: string | null
          voice_system: Json | null
          what_makes_us_different: string | null
        }
        Insert: {
          audience_framework?: Json | null
          audience_segments?: Json | null
          booking_link?: string | null
          brand_essence?: string | null
          brand_profile_v5?: Json | null
          brand_profile_v5_generated_at?: string | null
          brand_profile_v5_version?: string | null
          business_archetype?:
            | Database["public"]["Enums"]["business_archetype_enum"]
            | null
          business_character?: string | null
          business_id: string
          business_identity_persona?: string | null
          busy_pattern?: Json | null
          certifications?: string[] | null
          commercial_baseline_mode?: string | null
          communication_goal?: string | null
          content_focus?: string | null
          content_pillars?: string | null
          content_strategy?: Json | null
          core_offerings?: string[] | null
          core_offerings_jsonb?: Json | null
          core_values?: string[] | null
          created_at?: string | null
          cta_preference?: string | null
          data_sources_used?: Json | null
          do_not_say?: Json | null
          enhanced_avoid_examples?: Json | null
          enhanced_social_examples?: Json | null
          execution_profile?: Json | null
          gastronomic_profile?: string | null
          generation_errors?: Json | null
          generation_status?: Json | null
          identity_confidence?: number | null
          identity_keywords?: string | null
          identity_reasoning?: string | null
          image_preferences?: string | null
          image_preferences_jsonb?: Json | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          location_intelligence?: Json | null
          location_strategy?: Json | null
          marketing_manager_brief?: string | null
          menu_overview_summary?: Json | null
          positioning?: string | null
          posting_occasions?: Json | null
          posting_occasions_hash?: string | null
          posting_strategy?: Json | null
          primary_copy_hook?: string | null
          recognizable_interior_identity?: string | null
          revenue_drivers?: Json | null
          signature_themes?: string[] | null
          social_style?: Json | null
          social_writing_examples?: Json | null
          strategic_audience_segments?: Json | null
          strategic_coverage?: Json | null
          target_audience?: string | null
          target_type_mix?: Json | null
          things_to_avoid?: string | null
          things_to_avoid_jsonb?: Json | null
          tone_keywords?: string[] | null
          tone_model?: Json | null
          tone_of_voice?: string | null
          trigger_configuration?: Json | null
          trigger_updated_at?: string | null
          trigger_updated_by?: string | null
          typical_openings?: string[] | null
          updated_at?: string | null
          version_hash?: string | null
          voice_constraints?: string | null
          voice_examples?: Json | null
          voice_guardrails?: Json | null
          voice_rationale?: string | null
          voice_system?: Json | null
          what_makes_us_different?: string | null
        }
        Update: {
          audience_framework?: Json | null
          audience_segments?: Json | null
          booking_link?: string | null
          brand_essence?: string | null
          brand_profile_v5?: Json | null
          brand_profile_v5_generated_at?: string | null
          brand_profile_v5_version?: string | null
          business_archetype?:
            | Database["public"]["Enums"]["business_archetype_enum"]
            | null
          business_character?: string | null
          business_id?: string
          business_identity_persona?: string | null
          busy_pattern?: Json | null
          certifications?: string[] | null
          commercial_baseline_mode?: string | null
          communication_goal?: string | null
          content_focus?: string | null
          content_pillars?: string | null
          content_strategy?: Json | null
          core_offerings?: string[] | null
          core_offerings_jsonb?: Json | null
          core_values?: string[] | null
          created_at?: string | null
          cta_preference?: string | null
          data_sources_used?: Json | null
          do_not_say?: Json | null
          enhanced_avoid_examples?: Json | null
          enhanced_social_examples?: Json | null
          execution_profile?: Json | null
          gastronomic_profile?: string | null
          generation_errors?: Json | null
          generation_status?: Json | null
          identity_confidence?: number | null
          identity_keywords?: string | null
          identity_reasoning?: string | null
          image_preferences?: string | null
          image_preferences_jsonb?: Json | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          location_intelligence?: Json | null
          location_strategy?: Json | null
          marketing_manager_brief?: string | null
          menu_overview_summary?: Json | null
          positioning?: string | null
          posting_occasions?: Json | null
          posting_occasions_hash?: string | null
          posting_strategy?: Json | null
          primary_copy_hook?: string | null
          recognizable_interior_identity?: string | null
          revenue_drivers?: Json | null
          signature_themes?: string[] | null
          social_style?: Json | null
          social_writing_examples?: Json | null
          strategic_audience_segments?: Json | null
          strategic_coverage?: Json | null
          target_audience?: string | null
          target_type_mix?: Json | null
          things_to_avoid?: string | null
          things_to_avoid_jsonb?: Json | null
          tone_keywords?: string[] | null
          tone_model?: Json | null
          tone_of_voice?: string | null
          trigger_configuration?: Json | null
          trigger_updated_at?: string | null
          trigger_updated_by?: string | null
          typical_openings?: string[] | null
          updated_at?: string | null
          version_hash?: string | null
          voice_constraints?: string | null
          voice_examples?: Json | null
          voice_guardrails?: Json | null
          voice_rationale?: string | null
          voice_system?: Json | null
          what_makes_us_different?: string | null
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
          category_modifiers: Json | null
          category_scores: Json | null
          concept_fit_analyzed_at: string | null
          concept_fit_by_category: Json | null
          created_at: string | null
          demographic_proximity: Json | null
          has_view: boolean | null
          is_hidden_gem: boolean | null
          landmarks_nearby: Json | null
          last_updated_by_ai: string | null
          latitude: number | null
          local_location_reference: string | null
          location_architecture_version: number | null
          location_marketing_hooks: string[] | null
          location_type_matches: Json | null
          longitude: number | null
          nearby_hospitality: Json | null
          neighborhood: string | null
          neighborhood_character: string | null
          outdoor_space_type: string | null
          physical_context: Json | null
          public_transport: Json | null
          raw_competitive_venues: Json | null
          schema_version: number | null
          street_visibility: string | null
          traffic_rhythm: Json | null
          updated_at: string | null
          user_confirmed_at: string | null
          view_type: string[] | null
          when_analysis: Json | null
          when_analysis_internal: Json | null
          who: Json | null
          who_analysis: Json | null
          who_analysis_internal: Json | null
          why_analysis: Json | null
          why_analysis_internal: Json | null
        }
        Insert: {
          area_type?: string | null
          business_id: string
          category_modifiers?: Json | null
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          demographic_proximity?: Json | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          local_location_reference?: string | null
          location_architecture_version?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          physical_context?: Json | null
          public_transport?: Json | null
          raw_competitive_venues?: Json | null
          schema_version?: number | null
          street_visibility?: string | null
          traffic_rhythm?: Json | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who?: Json | null
          who_analysis?: Json | null
          who_analysis_internal?: Json | null
          why_analysis?: Json | null
          why_analysis_internal?: Json | null
        }
        Update: {
          area_type?: string | null
          business_id?: string
          category_modifiers?: Json | null
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          demographic_proximity?: Json | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          local_location_reference?: string | null
          location_architecture_version?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          physical_context?: Json | null
          public_transport?: Json | null
          raw_competitive_venues?: Json | null
          schema_version?: number | null
          street_visibility?: string | null
          traffic_rhythm?: Json | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who?: Json | null
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
      business_location_intelligence_backup_20260701: {
        Row: {
          area_type: string | null
          business_id: string | null
          category_modifiers: Json | null
          category_scores: Json | null
          concept_fit_analyzed_at: string | null
          concept_fit_by_category: Json | null
          created_at: string | null
          demographic_proximity: Json | null
          has_view: boolean | null
          is_hidden_gem: boolean | null
          landmarks_nearby: Json | null
          last_updated_by_ai: string | null
          latitude: number | null
          local_location_reference: string | null
          location_architecture_version: number | null
          location_marketing_hooks: string[] | null
          location_type_matches: Json | null
          longitude: number | null
          nearby_hospitality: Json | null
          neighborhood: string | null
          neighborhood_character: string | null
          outdoor_space_type: string | null
          physical_context: Json | null
          public_transport: Json | null
          raw_competitive_venues: Json | null
          schema_version: number | null
          street_visibility: string | null
          traffic_rhythm: Json | null
          updated_at: string | null
          user_confirmed_at: string | null
          view_type: string[] | null
          when_analysis: Json | null
          when_analysis_internal: Json | null
          who: Json | null
          who_analysis: Json | null
          who_analysis_internal: Json | null
          why_analysis: Json | null
          why_analysis_internal: Json | null
        }
        Insert: {
          area_type?: string | null
          business_id?: string | null
          category_modifiers?: Json | null
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          demographic_proximity?: Json | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          local_location_reference?: string | null
          location_architecture_version?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          physical_context?: Json | null
          public_transport?: Json | null
          raw_competitive_venues?: Json | null
          schema_version?: number | null
          street_visibility?: string | null
          traffic_rhythm?: Json | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who?: Json | null
          who_analysis?: Json | null
          who_analysis_internal?: Json | null
          why_analysis?: Json | null
          why_analysis_internal?: Json | null
        }
        Update: {
          area_type?: string | null
          business_id?: string | null
          category_modifiers?: Json | null
          category_scores?: Json | null
          concept_fit_analyzed_at?: string | null
          concept_fit_by_category?: Json | null
          created_at?: string | null
          demographic_proximity?: Json | null
          has_view?: boolean | null
          is_hidden_gem?: boolean | null
          landmarks_nearby?: Json | null
          last_updated_by_ai?: string | null
          latitude?: number | null
          local_location_reference?: string | null
          location_architecture_version?: number | null
          location_marketing_hooks?: string[] | null
          location_type_matches?: Json | null
          longitude?: number | null
          nearby_hospitality?: Json | null
          neighborhood?: string | null
          neighborhood_character?: string | null
          outdoor_space_type?: string | null
          physical_context?: Json | null
          public_transport?: Json | null
          raw_competitive_venues?: Json | null
          schema_version?: number | null
          street_visibility?: string | null
          traffic_rhythm?: Json | null
          updated_at?: string | null
          user_confirmed_at?: string | null
          view_type?: string[] | null
          when_analysis?: Json | null
          when_analysis_internal?: Json | null
          who?: Json | null
          who_analysis?: Json | null
          who_analysis_internal?: Json | null
          why_analysis?: Json | null
          why_analysis_internal?: Json | null
        }
        Relationships: []
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
          average_check_per_person: number | null
          business_id: string
          created_at: string | null
          currency: string | null
          enabled_menu_languages: string[] | null
          establishment_type: string | null
          has_delivery: boolean | null
          has_kids_menu: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_power_outlets: boolean | null
          has_table_service: boolean | null
          has_takeaway: boolean | null
          has_wifi: boolean | null
          kitchen_close_time: string | null
          price_level: string | null
          reservation_required: boolean | null
          seating_capacity_indoor: number | null
          seating_capacity_outdoor: number | null
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
          enabled_menu_languages?: string[] | null
          establishment_type?: string | null
          has_delivery?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          price_level?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
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
          enabled_menu_languages?: string[] | null
          establishment_type?: string | null
          has_delivery?: boolean | null
          has_kids_menu?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_power_outlets?: boolean | null
          has_table_service?: boolean | null
          has_takeaway?: boolean | null
          has_wifi?: boolean | null
          kitchen_close_time?: string | null
          price_level?: string | null
          reservation_required?: boolean | null
          seating_capacity_indoor?: number | null
          seating_capacity_outdoor?: number | null
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
          ai_place_synopsis: string | null
          booking_url: string | null
          business_id: string
          created_at: string | null
          detected_menu_urls: string[] | null
          founded_year: number | null
          key_offerings: string | null
          keywords: string[] | null
          long_description: string | null
          menu_description: string | null
          menu_signal: Json | null
          menu_structure: Json | null
          price_level: string | null
          target_audience: string | null
          updated_at: string | null
          user_about_text: string | null
        }
        Insert: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          ai_place_synopsis?: string | null
          booking_url?: string | null
          business_id: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          key_offerings?: string | null
          keywords?: string[] | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          price_level?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_about_text?: string | null
        }
        Update: {
          ai_brand_context?: string | null
          ai_brand_context_approved?: boolean | null
          ai_brand_context_generated_at?: string | null
          ai_place_synopsis?: string | null
          booking_url?: string | null
          business_id?: string
          created_at?: string | null
          detected_menu_urls?: string[] | null
          founded_year?: number | null
          key_offerings?: string | null
          keywords?: string[] | null
          long_description?: string | null
          menu_description?: string | null
          menu_signal?: Json | null
          menu_structure?: Json | null
          price_level?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_about_text?: string | null
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
      business_programme_profiles: {
        Row: {
          accepts_reservations: boolean | null
          audience_segments: Json | null
          baseline_goal_split: Json | null
          business_id: string
          commercial_reasoning: string | null
          confidence: number | null
          content_type_affinity: Json | null
          created_at: string
          day_pattern: string | null
          decision_timing: string | null
          draw_type: string | null
          generation_errors: Json | null
          id: string
          is_active: boolean | null
          meal_periods: string[] | null
          menu_evidence: string[]
          menu_results_v2_id: string | null
          operating_days: string[]
          permitted_who_types: Json | null
          price_positioning: Json | null
          programme_name: string
          programme_type: string
          reachable_guest_profile: string | null
          segment_confidence: number | null
          segment_reasoning: string | null
          time_windows: string[]
          updated_at: string
          version_hash: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          audience_segments?: Json | null
          baseline_goal_split?: Json | null
          business_id: string
          commercial_reasoning?: string | null
          confidence?: number | null
          content_type_affinity?: Json | null
          created_at?: string
          day_pattern?: string | null
          decision_timing?: string | null
          draw_type?: string | null
          generation_errors?: Json | null
          id?: string
          is_active?: boolean | null
          meal_periods?: string[] | null
          menu_evidence?: string[]
          menu_results_v2_id?: string | null
          operating_days?: string[]
          permitted_who_types?: Json | null
          price_positioning?: Json | null
          programme_name: string
          programme_type: string
          reachable_guest_profile?: string | null
          segment_confidence?: number | null
          segment_reasoning?: string | null
          time_windows?: string[]
          updated_at?: string
          version_hash?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          audience_segments?: Json | null
          baseline_goal_split?: Json | null
          business_id?: string
          commercial_reasoning?: string | null
          confidence?: number | null
          content_type_affinity?: Json | null
          created_at?: string
          day_pattern?: string | null
          decision_timing?: string | null
          draw_type?: string | null
          generation_errors?: Json | null
          id?: string
          is_active?: boolean | null
          meal_periods?: string[] | null
          menu_evidence?: string[]
          menu_results_v2_id?: string | null
          operating_days?: string[]
          permitted_who_types?: Json | null
          price_positioning?: Json | null
          programme_name?: string
          programme_type?: string
          reachable_guest_profile?: string | null
          segment_confidence?: number | null
          segment_reasoning?: string | null
          time_windows?: string[]
          updated_at?: string
          version_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_programme_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_programme_profiles_menu_results_v2_id_fkey"
            columns: ["menu_results_v2_id"]
            isOneToOne: false
            referencedRelation: "menu_results_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      business_staff: {
        Row: {
          accepts_bookings: boolean | null
          bio: string | null
          booking_url: string | null
          business_id: string
          certifications: string[] | null
          created_at: string | null
          display_order: number | null
          id: string
          instagram_handle: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          photo_url: string | null
          role: string | null
          specialties: string[] | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          accepts_bookings?: boolean | null
          bio?: string | null
          booking_url?: string | null
          business_id: string
          certifications?: string[] | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          photo_url?: string | null
          role?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          accepts_bookings?: boolean | null
          bio?: string | null
          booking_url?: string | null
          business_id?: string
          certifications?: string[] | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          photo_url?: string | null
          role?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          ai_generations_this_month: number | null
          ai_generations_today: number | null
          business_type_hybrid: Json | null
          country: string
          created_at: string | null
          id: string
          last_daily_reset: string | null
          last_monthly_reset: string | null
          last_quick_suggestions_reset: string | null
          local_location_reference: string | null
          logo_url: string | null
          name: string
          owner_id: string
          pdf_uploads_this_month: number | null
          pdf_uploads_today: number | null
          plan: string | null
          postal_code: string | null
          primary_language: string | null
          quick_suggestions_today: number
          scheduled_posts_this_month: number | null
          subpage_urls: Json | null
          updated_at: string | null
          website_analysis_this_month: number | null
          website_analysis_today: number | null
          website_url: string | null
        }
        Insert: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          business_type_hybrid?: Json | null
          country?: string
          created_at?: string | null
          id?: string
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          last_quick_suggestions_reset?: string | null
          local_location_reference?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          plan?: string | null
          postal_code?: string | null
          primary_language?: string | null
          quick_suggestions_today?: number
          scheduled_posts_this_month?: number | null
          subpage_urls?: Json | null
          updated_at?: string | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Update: {
          ai_generations_this_month?: number | null
          ai_generations_today?: number | null
          business_type_hybrid?: Json | null
          country?: string
          created_at?: string | null
          id?: string
          last_daily_reset?: string | null
          last_monthly_reset?: string | null
          last_quick_suggestions_reset?: string | null
          local_location_reference?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          pdf_uploads_this_month?: number | null
          pdf_uploads_today?: number | null
          plan?: string | null
          postal_code?: string | null
          primary_language?: string | null
          quick_suggestions_today?: number
          scheduled_posts_this_month?: number | null
          subpage_urls?: Json | null
          updated_at?: string | null
          website_analysis_this_month?: number | null
          website_analysis_today?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      city_context_cache: {
        Row: {
          ai_generated: boolean | null
          cached_at: string | null
          cached_until: string
          characteristics: Json | null
          city: string
          city_size: string
          country: string
          cultural_context: string
          generation_model: string | null
          id: string
          population: number | null
          postal_code: string | null
          tone: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          cached_at?: string | null
          cached_until: string
          characteristics?: Json | null
          city: string
          city_size: string
          country?: string
          cultural_context: string
          generation_model?: string | null
          id?: string
          population?: number | null
          postal_code?: string | null
          tone?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          cached_at?: string | null
          cached_until?: string
          characteristics?: Json | null
          city?: string
          city_size?: string
          country?: string
          cultural_context?: string
          generation_model?: string | null
          id?: string
          population?: number | null
          postal_code?: string | null
          tone?: string | null
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
          alternative_timings: Json | null
          business_id: string
          caption_base: string | null
          consumed_at: string | null
          content_angle: string | null
          content_type: string
          context_reasoning: string | null
          created_at: string
          cta_intent: string | null
          date: string
          first_text_generated_at: string | null
          generated_at: string | null
          generated_hashtags: Json | null
          generated_platform_content: Json | null
          generated_text: string | null
          generation_batch_id: string | null
          id: number
          inferred_content_type: string | null
          is_active: boolean
          last_text_generated_at: string | null
          media_items: Json | null
          media_suggestion: Json | null
          menu_item_description: string | null
          menu_item_id: string | null
          menu_item_name: string | null
          occasion_context: string | null
          photo_analysis: Json | null
          photo_idea: string | null
          planner_rationale: string | null
          platforms_generated: string[] | null
          position: number
          published_at: string | null
          rationale: string | null
          selected: boolean | null
          selected_at: string | null
          service_period: string | null
          source: string
          status: string
          suggested_time: string | null
          text_generated_count: number | null
          text_generation_version: number | null
          title: string
          uploaded_photo_url: string | null
          validation_result: Json | null
          weather_forecast: Json | null
          why_explanation: string | null
        }
        Insert: {
          alternative_timings?: Json | null
          business_id: string
          caption_base?: string | null
          consumed_at?: string | null
          content_angle?: string | null
          content_type?: string
          context_reasoning?: string | null
          created_at?: string
          cta_intent?: string | null
          date?: string
          first_text_generated_at?: string | null
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          generation_batch_id?: string | null
          id?: number
          inferred_content_type?: string | null
          is_active?: boolean
          last_text_generated_at?: string | null
          media_items?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_id?: string | null
          menu_item_name?: string | null
          occasion_context?: string | null
          photo_analysis?: Json | null
          photo_idea?: string | null
          planner_rationale?: string | null
          platforms_generated?: string[] | null
          position: number
          published_at?: string | null
          rationale?: string | null
          selected?: boolean | null
          selected_at?: string | null
          service_period?: string | null
          source?: string
          status?: string
          suggested_time?: string | null
          text_generated_count?: number | null
          text_generation_version?: number | null
          title: string
          uploaded_photo_url?: string | null
          validation_result?: Json | null
          weather_forecast?: Json | null
          why_explanation?: string | null
        }
        Update: {
          alternative_timings?: Json | null
          business_id?: string
          caption_base?: string | null
          consumed_at?: string | null
          content_angle?: string | null
          content_type?: string
          context_reasoning?: string | null
          created_at?: string
          cta_intent?: string | null
          date?: string
          first_text_generated_at?: string | null
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          generation_batch_id?: string | null
          id?: number
          inferred_content_type?: string | null
          is_active?: boolean
          last_text_generated_at?: string | null
          media_items?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_id?: string | null
          menu_item_name?: string | null
          occasion_context?: string | null
          photo_analysis?: Json | null
          photo_idea?: string | null
          planner_rationale?: string | null
          platforms_generated?: string[] | null
          position?: number
          published_at?: string | null
          rationale?: string | null
          selected?: boolean | null
          selected_at?: string | null
          service_period?: string | null
          source?: string
          status?: string
          suggested_time?: string | null
          text_generated_count?: number | null
          text_generation_version?: number | null
          title?: string
          uploaded_photo_url?: string | null
          validation_result?: Json | null
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
      dashboard_tips: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          requires_verification: boolean | null
          tip_da: string
          tip_en: string
          updated_at: string | null
          verification_notes: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          requires_verification?: boolean | null
          tip_da: string
          tip_en: string
          updated_at?: string | null
          verification_notes?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          requires_verification?: boolean | null
          tip_da?: string
          tip_en?: string
          updated_at?: string | null
          verification_notes?: string | null
        }
        Relationships: []
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          alt_text: string | null
          aspect_ratio: number | null
          business_id: string
          created_at: string
          deleted_at: string | null
          dish_name: string | null
          duration: number | null
          file_size: number
          filename: string
          height: number | null
          id: string
          last_used_date: string | null
          media_type: string
          menu_item_id: string | null
          mime_type: string
          original_filename: string
          post_type: string | null
          storage_bucket: string
          storage_path: string
          tags: string[] | null
          thumbnail_path: string | null
          updated_at: string
          upload_date: string
          usage_count: number
          user_id: string
          video_thumbnail_path: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          aspect_ratio?: number | null
          business_id: string
          created_at?: string
          deleted_at?: string | null
          dish_name?: string | null
          duration?: number | null
          file_size: number
          filename: string
          height?: number | null
          id?: string
          last_used_date?: string | null
          media_type: string
          menu_item_id?: string | null
          mime_type: string
          original_filename: string
          post_type?: string | null
          storage_bucket?: string
          storage_path: string
          tags?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string
          upload_date?: string
          usage_count?: number
          user_id: string
          video_thumbnail_path?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          aspect_ratio?: number | null
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          dish_name?: string | null
          duration?: number | null
          file_size?: number
          filename?: string
          height?: number | null
          id?: string
          last_used_date?: string | null
          media_type?: string
          menu_item_id?: string | null
          mime_type?: string
          original_filename?: string
          post_type?: string | null
          storage_bucket?: string
          storage_path?: string
          tags?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string
          upload_date?: string
          usage_count?: number
          user_id?: string
          video_thumbnail_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_normalized"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items_normalized: {
        Row: {
          avg_engagement_rate: number | null
          business_id: string
          category_name: string
          category_type: string
          created_at: string | null
          dish_temp_category: string | null
          id: string
          is_active: boolean
          is_limited_time: boolean | null
          is_seasonal: boolean | null
          is_signature: boolean | null
          item_description: string | null
          item_name: string
          item_price: string | null
          last_posted_date: string | null
          location_tags: string[] | null
          media_category: string | null
          menu_language: string | null
          menu_result_id: string
          menu_title: string | null
          menu_url: string | null
          seasonal_ingredients: string[] | null
          service_period_name: string | null
          service_periods: string[]
          source_sha256: string | null
          synced_at: string | null
          total_times_posted: number | null
          updated_at: string | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          business_id: string
          category_name: string
          category_type: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_active?: boolean
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_description?: string | null
          item_name: string
          item_price?: string | null
          last_posted_date?: string | null
          location_tags?: string[] | null
          media_category?: string | null
          menu_language?: string | null
          menu_result_id: string
          menu_title?: string | null
          menu_url?: string | null
          seasonal_ingredients?: string[] | null
          service_period_name?: string | null
          service_periods?: string[]
          source_sha256?: string | null
          synced_at?: string | null
          total_times_posted?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_engagement_rate?: number | null
          business_id?: string
          category_name?: string
          category_type?: string
          created_at?: string | null
          dish_temp_category?: string | null
          id?: string
          is_active?: boolean
          is_limited_time?: boolean | null
          is_seasonal?: boolean | null
          is_signature?: boolean | null
          item_description?: string | null
          item_name?: string
          item_price?: string | null
          last_posted_date?: string | null
          location_tags?: string[] | null
          media_category?: string | null
          menu_language?: string | null
          menu_result_id?: string
          menu_title?: string | null
          menu_url?: string | null
          seasonal_ingredients?: string[] | null
          service_period_name?: string | null
          service_periods?: string[]
          source_sha256?: string | null
          synced_at?: string | null
          total_times_posted?: number | null
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
          error_message: string | null
          extraction_method: string | null
          id: string
          is_signature: boolean | null
          language_code: string | null
          menu_type: string | null
          raw_text: string | null
          representative_dishes: Json | null
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
          time_confirmed: boolean | null
          time_end: string | null
          time_source: string | null
          time_start: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          attempts?: number
          business_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          is_signature?: boolean | null
          language_code?: string | null
          menu_type?: string | null
          raw_text?: string | null
          representative_dishes?: Json | null
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
          time_confirmed?: boolean | null
          time_end?: string | null
          time_source?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          attempts?: number
          business_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          extraction_method?: string | null
          id?: string
          is_signature?: boolean | null
          language_code?: string | null
          menu_type?: string | null
          raw_text?: string | null
          representative_dishes?: Json | null
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
          time_confirmed?: boolean | null
          time_end?: string | null
          time_source?: string | null
          time_start?: string | null
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
      posts: {
        Row: {
          business_id: string
          caption_base: string | null
          caption_data: Json | null
          consumed_at: string | null
          content_angle: string | null
          content_json: Json | null
          content_style: string | null
          content_type: string | null
          created_at: string
          cta_intent: string | null
          date: string | null
          first_text_generated_at: string | null
          generated_at: string | null
          generated_hashtags: Json | null
          generated_platform_content: Json | null
          generated_text: string | null
          generation_batch_id: string | null
          id: string
          idea_data: Json | null
          idea_index: number | null
          idea_source: string
          is_active: boolean | null
          last_text_generated_at: string | null
          media_analysis: Json | null
          media_items: Json | null
          media_metadata: Json | null
          media_suggestion: Json | null
          menu_item_description: string | null
          menu_item_id: string | null
          menu_item_name: string | null
          occasion_context: string | null
          phase: string | null
          photo_analysis: Json | null
          photo_idea: string | null
          photo_url: string | null
          planner_rationale: string | null
          platform: string | null
          platforms: string[] | null
          platforms_generated: string[] | null
          position: number | null
          post_text: string | null
          posted_at: string | null
          posting_error: string | null
          published_at: string | null
          rationale: string | null
          scheduled_for: string | null
          selected: boolean | null
          selected_at: string | null
          service_period: string | null
          source: string | null
          status: string
          strategy_id: string | null
          suggested_post_datetime: string | null
          suggested_time: string | null
          suggestion_id: number | null
          text_generated_count: number | null
          text_generation_version: number | null
          title: string | null
          updated_at: string
          uploaded_photo_url: string | null
          user_id: string | null
          validation_result: Json | null
          weather_forecast: Json | null
          weekly_plan_id: string | null
          weekly_plan_idea_id: number | null
          weekly_plan_slot_date: string | null
          weekly_plan_slot_index: number | null
          why_explanation: string | null
        }
        Insert: {
          business_id: string
          caption_base?: string | null
          caption_data?: Json | null
          consumed_at?: string | null
          content_angle?: string | null
          content_json?: Json | null
          content_style?: string | null
          content_type?: string | null
          created_at?: string
          cta_intent?: string | null
          date?: string | null
          first_text_generated_at?: string | null
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          generation_batch_id?: string | null
          id?: string
          idea_data?: Json | null
          idea_index?: number | null
          idea_source?: string
          is_active?: boolean | null
          last_text_generated_at?: string | null
          media_analysis?: Json | null
          media_items?: Json | null
          media_metadata?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_id?: string | null
          menu_item_name?: string | null
          occasion_context?: string | null
          phase?: string | null
          photo_analysis?: Json | null
          photo_idea?: string | null
          photo_url?: string | null
          planner_rationale?: string | null
          platform?: string | null
          platforms?: string[] | null
          platforms_generated?: string[] | null
          position?: number | null
          post_text?: string | null
          posted_at?: string | null
          posting_error?: string | null
          published_at?: string | null
          rationale?: string | null
          scheduled_for?: string | null
          selected?: boolean | null
          selected_at?: string | null
          service_period?: string | null
          source?: string | null
          status?: string
          strategy_id?: string | null
          suggested_post_datetime?: string | null
          suggested_time?: string | null
          suggestion_id?: number | null
          text_generated_count?: number | null
          text_generation_version?: number | null
          title?: string | null
          updated_at?: string
          uploaded_photo_url?: string | null
          user_id?: string | null
          validation_result?: Json | null
          weather_forecast?: Json | null
          weekly_plan_id?: string | null
          weekly_plan_idea_id?: number | null
          weekly_plan_slot_date?: string | null
          weekly_plan_slot_index?: number | null
          why_explanation?: string | null
        }
        Update: {
          business_id?: string
          caption_base?: string | null
          caption_data?: Json | null
          consumed_at?: string | null
          content_angle?: string | null
          content_json?: Json | null
          content_style?: string | null
          content_type?: string | null
          created_at?: string
          cta_intent?: string | null
          date?: string | null
          first_text_generated_at?: string | null
          generated_at?: string | null
          generated_hashtags?: Json | null
          generated_platform_content?: Json | null
          generated_text?: string | null
          generation_batch_id?: string | null
          id?: string
          idea_data?: Json | null
          idea_index?: number | null
          idea_source?: string
          is_active?: boolean | null
          last_text_generated_at?: string | null
          media_analysis?: Json | null
          media_items?: Json | null
          media_metadata?: Json | null
          media_suggestion?: Json | null
          menu_item_description?: string | null
          menu_item_id?: string | null
          menu_item_name?: string | null
          occasion_context?: string | null
          phase?: string | null
          photo_analysis?: Json | null
          photo_idea?: string | null
          photo_url?: string | null
          planner_rationale?: string | null
          platform?: string | null
          platforms?: string[] | null
          platforms_generated?: string[] | null
          position?: number | null
          post_text?: string | null
          posted_at?: string | null
          posting_error?: string | null
          published_at?: string | null
          rationale?: string | null
          scheduled_for?: string | null
          selected?: boolean | null
          selected_at?: string | null
          service_period?: string | null
          source?: string | null
          status?: string
          strategy_id?: string | null
          suggested_post_datetime?: string | null
          suggested_time?: string | null
          suggestion_id?: number | null
          text_generated_count?: number | null
          text_generation_version?: number | null
          title?: string | null
          updated_at?: string
          uploaded_photo_url?: string | null
          user_id?: string | null
          validation_result?: Json | null
          weather_forecast?: Json | null
          weekly_plan_id?: string | null
          weekly_plan_idea_id?: number | null
          weekly_plan_slot_date?: string | null
          weekly_plan_slot_index?: number | null
          why_explanation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "weekly_content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "daily_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_content_plans"
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
          business_type: string | null
          country: string | null
          created_at: string | null
          email: string
          has_booking_button: boolean | null
          id: string
          keywords: string[] | null
          last_daily_reset: string | null
          last_monthly_reset: string | null
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_posts: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string
          idea_source: string | null
          platform: string
          post_content: string
          published_at: string | null
          scheduled_at: string | null
          slot_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          idea_source?: string | null
          platform: string
          post_content: string
          published_at?: string | null
          scheduled_at?: string | null
          slot_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          idea_source?: string | null
          platform?: string
          post_content?: string
          published_at?: string | null
          scheduled_at?: string | null
          slot_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_evidence: {
        Row: {
          business_id: string
          created_at: string | null
          fetched_at: string | null
          google_maps_data: Json | null
          id: string
          instagram_data: Json | null
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          fetched_at?: string | null
          google_maps_data?: Json | null
          id?: string
          instagram_data?: Json | null
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          fetched_at?: string | null
          google_maps_data?: Json | null
          id?: string
          instagram_data?: Json | null
          source_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "third_party_evidence_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shown_tips: {
        Row: {
          id: string
          shown_at: string | null
          tip_id: string
          user_id: string
        }
        Insert: {
          id?: string
          shown_at?: string | null
          tip_id: string
          user_id: string
        }
        Update: {
          id?: string
          shown_at?: string | null
          tip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shown_tips_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: false
            referencedRelation: "dashboard_tips"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          city: string
          expires_at: string
          fetched_at: string | null
          forecast: Json
        }
        Insert: {
          city: string
          expires_at: string
          fetched_at?: string | null
          forecast: Json
        }
        Update: {
          city?: string
          expires_at?: string
          fetched_at?: string | null
          forecast?: Json
        }
        Relationships: []
      }
      website_analyses: {
        Row: {
          about_block: string | null
          about_content: string | null
          business_id: string
          created_at: string | null
          cta_texts: string[] | null
          detected_links: Json | null
          error_message: string | null
          headers: string[] | null
          hero_texts: string[] | null
          homepage_content: string | null
          id: string
          keywords: string[] | null
          last_run_at: string | null
          menu_structure: Json | null
          nav_items: string[] | null
          notes: string | null
          raw_html: string | null
          raw_result: Json | null
          source_url: string
          status: string | null
        }
        Insert: {
          about_block?: string | null
          about_content?: string | null
          business_id: string
          created_at?: string | null
          cta_texts?: string[] | null
          detected_links?: Json | null
          error_message?: string | null
          headers?: string[] | null
          hero_texts?: string[] | null
          homepage_content?: string | null
          id?: string
          keywords?: string[] | null
          last_run_at?: string | null
          menu_structure?: Json | null
          nav_items?: string[] | null
          notes?: string | null
          raw_html?: string | null
          raw_result?: Json | null
          source_url: string
          status?: string | null
        }
        Update: {
          about_block?: string | null
          about_content?: string | null
          business_id?: string
          created_at?: string | null
          cta_texts?: string[] | null
          detected_links?: Json | null
          error_message?: string | null
          headers?: string[] | null
          hero_texts?: string[] | null
          homepage_content?: string | null
          id?: string
          keywords?: string[] | null
          last_run_at?: string | null
          menu_structure?: Json | null
          nav_items?: string[] | null
          notes?: string | null
          raw_html?: string | null
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
      write_drafts: {
        Row: {
          business_id: string
          content: Json | null
          created_at: string
          id: string
          photo_content: Json | null
          selected_platforms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          content?: Json | null
          created_at?: string
          id?: string
          photo_content?: Json | null
          selected_platforms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          content?: Json | null
          created_at?: string
          id?: string
          photo_content?: Json | null
          selected_platforms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "write_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      brand_examples_with_fallback: {
        Row: {
          business_id: string | null
          business_name: string | null
          effective_avoid_examples: Json | null
          effective_social_examples: Json | null
          enhanced_count: number | null
          example_tier: string | null
          simple_count: number | null
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
      media_library_with_category: {
        Row: {
          alt_text: string | null
          aspect_ratio: number | null
          business_id: string | null
          created_at: string | null
          deleted_at: string | null
          dish_name: string | null
          duration: number | null
          file_size: number | null
          filename: string | null
          height: number | null
          id: string | null
          last_used_date: string | null
          media_type: string | null
          menu_item_id: string | null
          menu_item_name: string | null
          menu_media_category: string | null
          mime_type: string | null
          original_filename: string | null
          post_type: string | null
          resolved_category: string | null
          storage_bucket: string | null
          storage_path: string | null
          tags: string[] | null
          thumbnail_path: string | null
          updated_at: string | null
          upload_date: string | null
          usage_count: number | null
          user_id: string | null
          video_thumbnail_path: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_normalized"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items_normalized_stats: {
        Row: {
          brunch_items: number | null
          business_id: string | null
          dessert_items: number | null
          dinner_items: number | null
          kids_items: number | null
          last_sync: string | null
          lunch_items: number | null
          main_items: number | null
          signature_items: number | null
          total_items: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_normalized_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_normalization_stats: {
        Row: {
          avg_items_per_menu: number | null
          business_id: string | null
          completed_menus: number | null
          last_sync: string | null
          normalized_menus: number | null
          total_menus: number | null
          total_normalized_items: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_results_v2_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      backfill_menu_normalization: {
        Args: { p_limit?: number }
        Returns: {
          business_id: string
          items_normalized: number
          menu_result_id: string
          status: string
        }[]
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
          error_message: string | null
          extraction_method: string | null
          id: string
          is_signature: boolean | null
          language_code: string | null
          menu_type: string | null
          raw_text: string | null
          representative_dishes: Json | null
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
          time_confirmed: boolean | null
          time_end: string | null
          time_source: string | null
          time_start: string | null
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
      classify_media_category: {
        Args: {
          category_name: string
          item_description: string
          item_name: string
        }
        Returns: string
      }
      cleanup_expired_weather_cache: { Args: never; Returns: undefined }
      cleanup_old_archived_posts: {
        Args: { days_old?: number }
        Returns: number
      }
      cleanup_old_daily_suggestions: { Args: never; Returns: undefined }
      create_business_onboarding: {
        Args: {
          p_business_name: string
          p_selected_platforms: string[]
          p_user_id: string
        }
        Returns: string
      }
      deactivate_old_suggestions: {
        Args: { p_business_id: string; p_date: string }
        Returns: undefined
      }
      deduplicate_menu_items: {
        Args: { p_business_id: string }
        Returns: {
          canonical_id: string
          item_name: string
          old_ids: string[]
          posts_updated: number
          suggestions_updated: number
        }[]
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
      increment_media_usage: { Args: { media_id: string }; Returns: undefined }
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
      sync_menu_items_normalized: {
        Args: { p_business_id?: string; p_menu_result_id?: string }
        Returns: {
          business_count: number
          deleted_count: number
          synced_count: number
        }[]
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
      business_archetype_enum:
        | "fine_dining"
        | "casual_dining"
        | "cafe_bistro"
        | "cafe_bar"
        | "restaurant_bar"
        | "wine_bar"
        | "coffee_shop"
        | "quick_service"
        | "bakery"
        | "morning_cafe"
        | "brunch_cafe"
        | "all_day_cafe"
        | "lunch_restaurant"
        | "dinner_restaurant"
        | "full_service_restaurant"
        | "evening_bar"
        | "late_night_bar"
        | "nightlife_bar"
        | "brunch_specialist"
        | "fast_casual"
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
      business_archetype_enum: [
        "fine_dining",
        "casual_dining",
        "cafe_bistro",
        "cafe_bar",
        "restaurant_bar",
        "wine_bar",
        "coffee_shop",
        "quick_service",
        "bakery",
        "morning_cafe",
        "brunch_cafe",
        "all_day_cafe",
        "lunch_restaurant",
        "dinner_restaurant",
        "full_service_restaurant",
        "evening_bar",
        "late_night_bar",
        "nightlife_bar",
        "brunch_specialist",
        "fast_casual",
      ],
    },
  },
} as const
