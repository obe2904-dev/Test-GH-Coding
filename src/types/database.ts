// Database types for Supabase schema
// Updated with comprehensive business schema (migration 002)

import type { WeekSchedule } from './businessProfile'
import type { BusinessOfferingsProfile } from './businessOfferings'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          business_type: string | null
          onboarding_completed: boolean
          business_name: string | null
          address: string | null
          country: string
          phone: string | null
          business_email: string | null
          about_text: string | null
          business_category: string | null
          website_url: string | null
          opening_hours: WeekSchedule | null
          keywords: string[]
          has_booking_button: boolean
          profile_completed: boolean
          selected_platforms: string[] | null
          business_sector: string | null
          business_offerings: BusinessOfferingsProfile | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          business_type?: string | null
          onboarding_completed?: boolean
          business_name?: string | null
          address?: string | null
          country?: string
          phone?: string | null
          business_email?: string | null
          about_text?: string | null
          business_category?: string | null
          website_url?: string | null
          opening_hours?: WeekSchedule | null
          keywords?: string[]
          has_booking_button?: boolean
          profile_completed?: boolean
          selected_platforms?: string[] | null
          business_sector?: string | null
          business_offerings?: BusinessOfferingsProfile | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          business_type?: string | null
          onboarding_completed?: boolean
          business_name?: string | null
          address?: string | null
          country?: string
          phone?: string | null
          business_email?: string | null
          about_text?: string | null
          business_category?: string | null
          website_url?: string | null
          opening_hours?: WeekSchedule | null
          keywords?: string[]
          has_booking_button?: boolean
          profile_completed?: boolean
          selected_platforms?: string[] | null
          business_sector?: string | null
          business_offerings?: BusinessOfferingsProfile | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          vertical: string
          website_url: string | null
          normalized_url: string | null
          primary_language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          vertical: string
          website_url?: string | null
          normalized_url?: string | null
          primary_language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          vertical?: string
          website_url?: string | null
          normalized_url?: string | null
          primary_language?: string
          created_at?: string
          updated_at?: string
        }
      }
      business_team_members: {
        Row: {
          id: string
          business_id: string
          user_id: string
          role: string
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
      }
      business_profile: {
        Row: {
          business_id: string
          business_category: string | null
          short_description: string | null
          long_description: string | null
          price_level: 'low' | 'medium' | 'high' | null
          target_audience: string | null
          founded_year: number | null
          menu_description: string | null
          menu_structure: Json | null
          booking_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          business_category?: string | null
          short_description?: string | null
          long_description?: string | null
          price_level?: 'low' | 'medium' | 'high' | null
          target_audience?: string | null
          founded_year?: number | null
          menu_description?: string | null
          menu_structure?: Json | null
          booking_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          business_category?: string | null
          short_description?: string | null
          long_description?: string | null
          price_level?: 'low' | 'medium' | 'high' | null
          target_audience?: string | null
          founded_year?: number | null
          menu_description?: string | null
          menu_structure?: Json | null
          booking_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      business_brand_profile: {
        Row: {
          business_id: string
          tone_keywords: string[] | null
          tone_model: Json | null  // NEW: Structured tone model (primary_keywords, writing_rules, good_examples, avoid_examples, formality, emoji_level)
          voice_style: string | null
          values: string[] | null
          certifications: string[] | null
          do_not_say: Json | null
          // 9 Canonical Brand Voice Variables
          brand_essence: string | null
          tone_of_voice: string | null
          things_to_avoid: string | null
          target_audience: string | null
          core_offerings: string | null
          content_focus: string | null
          cta_style: string | null
          communication_goal: string | null
          image_preferences: string | null
          social_style: Json | null
          voice_examples: Json | null
          booking_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          tone_keywords?: string[] | null
          tone_model?: Json | null  // NEW: Structured tone model
          voice_style?: string | null
          values?: string[] | null
          certifications?: string[] | null
          do_not_say?: Json | null
          // 9 Canonical Brand Voice Variables
          brand_essence?: string | null
          tone_of_voice?: string | null
          things_to_avoid?: string | null
          target_audience?: string | null
          core_offerings?: string | null
          content_focus?: string | null
          cta_style?: string | null
          communication_goal?: string | null
          image_preferences?: string | null
          social_style?: Json | null
          voice_examples?: Json | null
          booking_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          tone_keywords?: string[] | null
          tone_model?: Json | null  // NEW: Structured tone model
          voice_style?: string | null
          values?: string[] | null
          certifications?: string[] | null
          do_not_say?: Json | null
          // 9 Canonical Brand Voice Variables
          brand_essence?: string | null
          tone_of_voice?: string | null
          things_to_avoid?: string | null
          target_audience?: string | null
          core_offerings?: string | null
          content_focus?: string | null
          cta_style?: string | null
          communication_goal?: string | null
          image_preferences?: string | null
          social_style?: Json | null
          voice_examples?: Json | null
          booking_link?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      business_locations: {
        Row: {
          id: string
          business_id: string
          label: string | null
          address_line1: string | null
          address_line2: string | null
          postal_code: string | null
          city: string | null
          country: string | null
          maps_url: string | null
          phone: string | null
          email: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          label?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          maps_url?: string | null
          phone?: string | null
          email?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          label?: string | null
          address_line1?: string | null
          address_line2?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          maps_url?: string | null
          phone?: string | null
          email?: string | null
          is_primary?: boolean
          created_at?: string
        }
      }
      opening_hours: {
        Row: {
          id: string
          business_id: string
          weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
          open_time: string | null
          close_time: string | null
          closed: boolean
          kind: 'normal' | 'kitchen' | 'holiday'
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
          open_time?: string | null
          close_time?: string | null
          closed?: boolean
          kind?: 'normal' | 'kitchen' | 'holiday'
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          weekday?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
          open_time?: string | null
          close_time?: string | null
          closed?: boolean
          kind?: 'normal' | 'kitchen' | 'holiday'
          created_at?: string
        }
      }
      menu_extractions: {
        Row: {
          id: string
          business_id: string
          menu_source_id: string | null
          menu_name: string
          menu_type: 'standard' | 'special'
          extracted_data: Json
          extracted_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          business_id: string
          menu_source_id?: string | null
          menu_name: string
          menu_type?: 'standard' | 'special'
          extracted_data: Json
          extracted_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          menu_source_id?: string | null
          menu_name?: string
          menu_type?: 'standard' | 'special'
          extracted_data?: Json
          extracted_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }

      menu_sources: {
        Row: {
          id: string
          business_id: string
          source_url: string
          source_type: 'url' | 'pdf'
          file_name: string | null
          menu_type: 'standard' | 'special'
          source_origin: 'ai_detected' | 'manual_added'
          status: 'pending' | 'extracting' | 'extracted' | 'ignored' | 'error'
          error_message: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          business_id: string
          source_url: string
          source_type: 'url' | 'pdf'
          file_name?: string | null
          menu_type?: 'standard' | 'special'
          source_origin: 'ai_detected' | 'manual_added'
          status?: 'pending' | 'extracting' | 'extracted' | 'ignored' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          source_url?: string
          source_type?: 'url' | 'pdf'
          file_name?: string | null
          menu_type?: 'standard' | 'special'
          source_origin?: 'ai_detected' | 'manual_added'
          status?: 'pending' | 'extracting' | 'extracted' | 'ignored' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }

      menu_results_v2: {
        Row: {
          id: string
          business_id: string
          source_kind: 'url' | 'storage'
          source_url: string | null
          source_content_type: string | null
          storage_bucket: string | null
          storage_path: string | null
          sha256: string | null
          status: 'queued' | 'processing' | 'done' | 'error'
          language_code: string | null
          attempts: number
          claimed_at: string | null
          completed_at: string | null
          extraction_method: string | null
          raw_text: string | null
          structured_data: Json | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          source_kind?: 'url' | 'storage'
          source_url?: string | null
          source_content_type?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          sha256?: string | null
          status?: 'queued' | 'processing' | 'done' | 'error'
          language_code?: string | null
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          extraction_method?: string | null
          raw_text?: string | null
          structured_data?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          source_kind?: 'url' | 'storage'
          source_url?: string | null
          source_content_type?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          sha256?: string | null
          status?: 'queued' | 'processing' | 'done' | 'error'
          language_code?: string | null
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          extraction_method?: string | null
          raw_text?: string | null
          structured_data?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      website_analysis_jobs: {
        Row: {
          id: string
          business_id: string
          website_url: string
          status: 'queued' | 'processing' | 'done' | 'error'
          result: Json | null
          error_message: string | null
          created_at: string
          claimed_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          website_url: string
          status: 'queued' | 'processing' | 'done' | 'error'
          result?: Json | null
          error_message?: string | null
          created_at?: string
          claimed_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          website_url?: string
          status?: 'queued' | 'processing' | 'done' | 'error'
          result?: Json | null
          error_message?: string | null
          created_at?: string
          claimed_at?: string | null
          completed_at?: string | null
        }
      }

      post_drafts: {
        Row: {
          id: string
          user_id: string
          selected_platforms: string[] | null
          post_content: Json | null
          photo_content: Json | null
          photo_idea: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          selected_platforms?: string[] | null
          post_content?: Json | null
          photo_content?: Json | null
          photo_idea?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          selected_platforms?: string[] | null
          post_content?: Json | null
          photo_content?: Json | null
          photo_idea?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      business_services: {
        Row: {
          id: string
          business_id: string
          category: string | null
          name: string
          description: string | null
          price: number | null
          price_to: number | null
          currency: string | null
          duration_minutes: number | null
          requires_booking: boolean | null
          available_online: boolean | null
          display_order: number | null
          is_featured: boolean | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          category?: string | null
          name: string
          description?: string | null
          price?: number | null
          price_to?: number | null
          currency?: string | null
          duration_minutes?: number | null
          requires_booking?: boolean | null
          available_online?: boolean | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          category?: string | null
          name?: string
          description?: string | null
          price?: number | null
          price_to?: number | null
          currency?: string | null
          duration_minutes?: number | null
          requires_booking?: boolean | null
          available_online?: boolean | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }

      business_staff: {
        Row: {
          id: string
          business_id: string
          name: string
          role: string | null
          bio: string | null
          specialties: string[] | null
          certifications: string[] | null
          years_experience: number | null
          photo_url: string | null
          accepts_bookings: boolean | null
          booking_url: string | null
          display_order: number | null
          is_featured: boolean | null
          is_active: boolean | null
          instagram_handle: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          role?: string | null
          bio?: string | null
          specialties?: string[] | null
          certifications?: string[] | null
          years_experience?: number | null
          photo_url?: string | null
          accepts_bookings?: boolean | null
          booking_url?: string | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          instagram_handle?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          role?: string | null
          bio?: string | null
          specialties?: string[] | null
          certifications?: string[] | null
          years_experience?: number | null
          photo_url?: string | null
          accepts_bookings?: boolean | null
          booking_url?: string | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          instagram_handle?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      business_products: {
        Row: {
          id: string
          business_id: string
          name: string
          brand: string | null
          category: string | null
          description: string | null
          price: number | null
          currency: string | null
          stock_status: string | null
          sku: string | null
          image_url: string | null
          display_order: number | null
          is_featured: boolean | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          brand?: string | null
          category?: string | null
          description?: string | null
          price?: number | null
          currency?: string | null
          stock_status?: string | null
          sku?: string | null
          image_url?: string | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          brand?: string | null
          category?: string | null
          description?: string | null
          price?: number | null
          currency?: string | null
          stock_status?: string | null
          sku?: string | null
          image_url?: string | null
          display_order?: number | null
          is_featured?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }

      business_classes: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          category: string | null
          day_of_week: number | null
          start_time: string
          duration_minutes: number
          max_capacity: number | null
          requires_booking: boolean | null
          instructor_id: string | null
          instructor_name: string | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          category?: string | null
          day_of_week?: number | null
          start_time: string
          duration_minutes: number
          max_capacity?: number | null
          requires_booking?: boolean | null
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          category?: string | null
          day_of_week?: number | null
          start_time?: string
          duration_minutes?: number
          max_capacity?: number | null
          requires_booking?: boolean | null
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      social_accounts: {
        Row: {
          id: string
          business_id: string
          platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'
          handle: string | null
          profile_url: string | null
          is_connected: boolean
          access_token_encrypted: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'
          handle?: string | null
          profile_url?: string | null
          is_connected?: boolean
          access_token_encrypted?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          platform?: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'
          handle?: string | null
          profile_url?: string | null
          is_connected?: boolean
          access_token_encrypted?: string | null
          created_at?: string
        }
      }
      media_assets: {
        Row: {
          id: string
          business_id: string
          url: string
          type: 'photo' | 'logo' | 'menu_pdf' | 'video' | null
          category_tags: string[] | null
          ai_labels: Json | null
          is_hero: boolean
          is_interior: boolean
          is_exterior: boolean
          is_team: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          url: string
          type?: 'photo' | 'logo' | 'menu_pdf' | 'video' | null
          category_tags?: string[] | null
          ai_labels?: Json | null
          is_hero?: boolean
          is_interior?: boolean
          is_exterior?: boolean
          is_team?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          url?: string
          type?: 'photo' | 'logo' | 'menu_pdf' | 'video' | null
          category_tags?: string[] | null
          ai_labels?: Json | null
          is_hero?: boolean
          is_interior?: boolean
          is_exterior?: boolean
          is_team?: boolean
          created_at?: string
        }
      }
      offerings: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          type: 'menu_item' | 'service' | 'product'
          category: string | null
          tags: string[] | null
          dietary_tags: string[] | null
          is_signature: boolean
          is_seasonal: boolean
          season_label: string | null
          price_min: number | null
          price_max: number | null
          active: boolean
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          type: 'menu_item' | 'service' | 'product'
          category?: string | null
          tags?: string[] | null
          dietary_tags?: string[] | null
          is_signature?: boolean
          is_seasonal?: boolean
          season_label?: string | null
          price_min?: number | null
          price_max?: number | null
          active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          type?: 'menu_item' | 'service' | 'product'
          category?: string | null
          tags?: string[] | null
          dietary_tags?: string[] | null
          is_signature?: boolean
          is_seasonal?: boolean
          season_label?: string | null
          price_min?: number | null
          price_max?: number | null
          active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      specials: {
        Row: {
          id: string
          business_id: string
          title: string
          description: string | null
          type: 'deal' | 'event' | 'seasonal_offer' | 'loyalty'
          start_date: string | null
          end_date: string | null
          recurrence_rule: string | null
          price_info: string | null
          link_url: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          description?: string | null
          type: 'deal' | 'event' | 'seasonal_offer' | 'loyalty'
          start_date?: string | null
          end_date?: string | null
          recurrence_rule?: string | null
          price_info?: string | null
          link_url?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          title?: string
          description?: string | null
          type?: 'deal' | 'event' | 'seasonal_offer' | 'loyalty'
          start_date?: string | null
          end_date?: string | null
          recurrence_rule?: string | null
          price_info?: string | null
          link_url?: string | null
          active?: boolean
          created_at?: string
        }
      }
      website_analyses: {
        Row: {
          id: string
          business_id: string
          source_url: string
          status: 'pending' | 'processing' | 'success' | 'error'
          last_run_at: string | null
          raw_result: Json | null
          raw_html: string | null
          cta_texts: string[] | null
          headers: string[] | null
          nav_items: string[] | null
          hero_texts: string[] | null
          error_message: string | null
          notes: string | null
          created_at: string
          homepage_content: string | null
          about_content: string | null
          detected_links: Json | null
          about_block: string | null
          keywords: string[] | null
          menu_structure: Json | null
        }
        Insert: {
          id?: string
          business_id: string
          source_url: string
          status?: 'pending' | 'processing' | 'success' | 'error'
          last_run_at?: string | null
          raw_result?: Json | null
          raw_html?: string | null
          cta_texts?: string[] | null
          headers?: string[] | null
          nav_items?: string[] | null
          hero_texts?: string[] | null
          error_message?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          source_url?: string
          status?: 'pending' | 'processing' | 'success' | 'error'
          last_run_at?: string | null
          raw_result?: Json | null
          raw_html?: string | null
          cta_texts?: string[] | null
          headers?: string[] | null
          nav_items?: string[] | null
          hero_texts?: string[] | null
          error_message?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      business_documents: {
        Row: {
          id: string
          business_id: string
          document_type: 'menu' | 'wine_list' | 'other'
          file_name: string
          storage_path: string
          public_url: string
          extracted_text: string | null
          extracted_json: Json | null
          file_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          document_type: 'menu' | 'wine_list' | 'other'
          file_name: string
          storage_path: string
          public_url: string
          extracted_text?: string | null
          extracted_json?: Json | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          document_type?: 'menu' | 'wine_list' | 'other'
          file_name?: string
          storage_path?: string
          public_url?: string
          extracted_text?: string | null
          extracted_json?: Json | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
