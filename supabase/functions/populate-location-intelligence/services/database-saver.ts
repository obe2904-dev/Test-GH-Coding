/**
 * Database Saver Service
 * Saves location intelligence to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class DatabaseSaver {
  private supabase: ReturnType<typeof createClient>;

  // Valid area_types from schema
  private readonly VALID_AREA_TYPES = [
    'city_centre',
    'residential',
    'office',
    'transport_hub',
    'waterfront',
    'shopping_district',
    'mixed_use',
    'destination',
    'nature_park'
  ];

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async saveLocationIntelligence(businessId: string, locationData: any, schemaVersion: number = 2): Promise<void> {
    // Remove poi_counts as it's not a database column (used for analysis only)
    const { poi_counts, _fallback_warning, ...dataToSave } = locationData;
    
    // Validate area_type against schema enum
    if (dataToSave.area_type && !this.VALID_AREA_TYPES.includes(dataToSave.area_type)) {
      console.warn(
        `⚠️ Invalid area_type="${dataToSave.area_type}" - defaulting to "mixed_use". ` +
        `Valid types: ${this.VALID_AREA_TYPES.join(', ')}`
      );
      dataToSave.area_type = 'mixed_use';
    }
    
    const { error } = await this.supabase
      .from('business_location_intelligence')
      .upsert({
        business_id: businessId,
        ...dataToSave,
        schema_version: schemaVersion,
        last_updated_by_ai: new Date().toISOString(),
      }, {
        onConflict: 'business_id'
      });

    if (error) {
      throw new Error(`Failed to save location intelligence: ${error.message}`);
    }
  }
}
