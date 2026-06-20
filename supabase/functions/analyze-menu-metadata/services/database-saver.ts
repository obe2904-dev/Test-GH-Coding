/**
 * Database Saver Service
 * Saves analyzed menu metadata to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalyzedMetadata {
  food_philosophy: string;
  organic_certified: boolean;
  local_ingredients_pct: number;
  has_specialty_coffee: boolean;
  coffee_roaster: string | null;
  has_full_bar: boolean;
  has_wine_list: boolean;
  signature_items_count: number;
  total_items_count: number;
  menu_language: string;
  insights: {
    dietary_patterns: string[];
    cuisine_style: string;
    price_positioning: string;
    unique_features: string[];
  };
}

export class DatabaseSaver {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Save analyzed metadata to business_menu_metadata table.
   * ⚠️ business_menu_metadata was DROPPED April 2026 (migration 20260420000007).
   * This method is now a no-op — metadata is returned in the response body only.
   */
  async saveMetadata(_businessId: string, _metadata: AnalyzedMetadata): Promise<void> {
    console.warn('[MenuMetadata] business_menu_metadata table dropped — skipping database save.');
  }
}
