/**
 * Saver Service
 * Saves validated brand profile to database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { BrandProfileGenerated } from '../types.ts';
import { BrandProfileGenerationError } from '../utils/error-handler.ts';

export async function saveBrandProfile(
  businessId: string,
  profile: BrandProfileGenerated,
  supabaseClient: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Check if brand profile already exists
    const { data: existing } = await supabaseClient
      .from('business_brand_profile')
      .select('business_id')
      .eq('business_id', businessId)
      .single();

    const dataToSave = {
      business_id: businessId,
      brand_essence: profile.brand_essence,
      tone_of_voice: profile.tone_of_voice,
      things_to_avoid: profile.banned_words, // Map banned_words to things_to_avoid
      target_audience: profile.target_audience,
      core_offerings: profile.brand_positioning, // Map brand_positioning to core_offerings
      content_focus: profile.content_hooks, // Map content_hooks to content_focus
      communication_goal: profile.competitive_positioning, // Map competitive_positioning to communication_goal
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing
      const { error } = await supabaseClient
        .from('business_brand_profile')
        .update(dataToSave)
        .eq('business_id', businessId);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabaseClient
        .from('business_brand_profile')
        .insert(dataToSave);

      if (error) throw error;
    }
  } catch (error) {
    throw new BrandProfileGenerationError(
      'Failed to save brand profile to database',
      'saving',
      false,
      error
    );
  }
}
