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
          short_description: string | null
          long_description: string | null
          price_level: 'low' | 'medium' | 'high' | null
          target_audience: string | null
          founded_year: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          short_description?: string | null
          long_description?: string | null
          price_level?: 'low' | 'medium' | 'high' | null
          target_audience?: string | null
          founded_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          short_description?: string | null
          long_description?: string | null
          price_level?: 'low' | 'medium' | 'high' | null
          target_audience?: string | null
          founded_year?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      business_brand_profile: {
        Row: {
          business_id: string
          tone_keywords: string[] | null
          voice_style: string | null
          values: string[] | null
          certifications: string[] | null
          do_not_say: Json | null
          has_alcohol: boolean
          price_level: 'low' | 'medium' | 'high' | null
          dietary_options: string[]
          signature_items: string[]
          dominant_usage_mode: 'breakfast' | 'lunch' | 'dinner' | 'evening' | 'night' | 'allday' | null
          opens_early: boolean
          closes_late: boolean
          weekend_focused: boolean
          target_audiences: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          tone_keywords?: string[] | null
          voice_style?: string | null
          values?: string[] | null
          certifications?: string[] | null
          do_not_say?: Json | null
          has_alcohol?: boolean
          price_level?: 'low' | 'medium' | 'high' | null
          dietary_options?: string[]
          signature_items?: string[]
          dominant_usage_mode?: 'breakfast' | 'lunch' | 'dinner' | 'evening' | 'night' | 'allday' | null
          opens_early?: boolean
          closes_late?: boolean
          weekend_focused?: boolean
          target_audiences?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          tone_keywords?: string[] | null
          voice_style?: string | null
          values?: string[] | null
          certifications?: string[] | null
          do_not_say?: Json | null
          has_alcohol?: boolean
          price_level?: 'low' | 'medium' | 'high' | null
          dietary_options?: string[]
          signature_items?: string[]
          dominant_usage_mode?: 'breakfast' | 'lunch' | 'dinner' | 'evening' | 'night' | 'allday' | null
          opens_early?: boolean
          closes_late?: boolean
          weekend_focused?: boolean
          target_audiences?: string[]
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
          error_message: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          source_url: string
          status?: 'pending' | 'processing' | 'success' | 'error'
          last_run_at?: string | null
          raw_result?: Json | null
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
