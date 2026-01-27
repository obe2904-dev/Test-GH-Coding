/**
 * Database Saver Service
 * Saves location intelligence to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class DatabaseSaver {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async saveLocationIntelligence(businessId: string, locationData: any): Promise<void> {
    // Remove poi_counts as it's not a database column (used for analysis only)
    const { poi_counts, ...dataToSave } = locationData;
    
    const { error } = await this.supabase
      .from('business_location_intelligence')
      .upsert({
        business_id: businessId,
        ...dataToSave,
        last_updated_by_ai: new Date().toISOString(),
      }, {
        onConflict: 'business_id'
      });

    if (error) {
      throw new Error(`Failed to save location intelligence: ${error.message}`);
    }
  }
}
