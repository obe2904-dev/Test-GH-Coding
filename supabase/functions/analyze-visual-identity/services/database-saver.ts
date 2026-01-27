/**
 * Database Saver Service
 * Saves visual identity to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface VisualIdentity {
  photography_style: any;
  platform_visuals: any;
  recognizable_interior_identity: string;
  signature_visual_elements: string[];
  primary_colors: any[];
}

export class DatabaseSaver {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * Save visual identity to database
   */
  async saveVisualIdentity(businessId: string, identity: VisualIdentity): Promise<void> {
    // Check if visual identity already exists
    const { data: existing } = await this.supabase
      .from('business_visual_identity')
      .select('business_id')
      .eq('business_id', businessId)
      .single();

    const dataToSave = {
      business_id: businessId,
      photography_style: identity.photography_style,
      platform_visuals: identity.platform_visuals,
      recognizable_interior_identity: identity.recognizable_interior_identity,
      signature_visual_elements: identity.signature_visual_elements,
      primary_colors: identity.primary_colors,
    };

    if (existing) {
      // Update existing
      const { error } = await this.supabase
        .from('business_visual_identity')
        .update(dataToSave)
        .eq('business_id', businessId);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await this.supabase
        .from('business_visual_identity')
        .insert(dataToSave);

      if (error) throw error;
    }
  }
}
