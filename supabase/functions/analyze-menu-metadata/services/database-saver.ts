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
   * Save analyzed metadata to business_menu_metadata table
   */
  async saveMetadata(businessId: string, metadata: AnalyzedMetadata): Promise<void> {
    const { error } = await this.supabase
      .from('business_menu_metadata')
      .upsert({
        business_id: businessId,
        food_philosophy: metadata.food_philosophy,
        total_items_count: metadata.total_items_count,
        signature_items_count: metadata.signature_items_count,
        organic_certified: metadata.organic_certified,
        local_ingredients_pct: metadata.local_ingredients_pct,
        has_specialty_coffee: metadata.has_specialty_coffee,
        coffee_roaster: metadata.coffee_roaster,
        has_full_bar: metadata.has_full_bar,
        has_wine_list: metadata.has_wine_list,
        dietary_options: metadata.insights.dietary_patterns,
        cuisine_style: metadata.insights.cuisine_style,
        price_positioning: metadata.insights.price_positioning,
        unique_features: metadata.insights.unique_features,
        menu_language: metadata.menu_language,
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id'
      });

    if (error) {
      throw new Error(`Failed to save metadata: ${error.message}`);
    }
  }
}
