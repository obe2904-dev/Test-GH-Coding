/**
 * Data Gatherer Service
 * Collects all available business knowledge from database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { BusinessKnowledgeGathered } from '../types.ts';
import { BrandProfileGenerationError } from '../utils/error-handler.ts';

export async function gatherBusinessKnowledge(
  businessId: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<BusinessKnowledgeGathered> {
  try {
    // Fetch core business info
    const { data: business, error: businessError } = await supabaseClient
      .from('businesses')
      .select('id, name, vertical')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      throw new BrandProfileGenerationError(
        'Business not found',
        'data-gathering',
        false,
        businessError
      );
    }

    // Fetch business location (from business_locations table)
    const { data: businessLocation } = await supabaseClient
      .from('business_locations')
      .select('address_line1, city, country')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .single();

    // Fetch location intelligence (may not exist yet)
    const { data: location } = await supabaseClient
      .from('business_location_intelligence')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // Fetch operations (may not exist yet)
    const { data: operations } = await supabaseClient
      .from('business_operations')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // Fetch menu items (from existing menu_extractions system)
    const { data: menuItems } = await supabaseClient
      .from('menu_items')
      .select('name, description, is_signature')
      .eq('business_id', businessId)
      .limit(20); // Top 20 items

    // Fetch menu metadata (may not exist yet)
    const { data: menuMetadata } = await supabaseClient
      .from('business_menu_metadata')
      .select('*')
      .eq('business_id', businessId)
      .single();

    return {
      business: {
        id: business.id,
        name: business.name,
        type: business.vertical,
        address: businessLocation?.address_line1 || 'Not specified',
        city: businessLocation?.city || 'Not specified',
      },
      location: location || undefined,
      operations: operations || undefined,
      menu_items: menuItems || undefined,
      menu_metadata: menuMetadata || undefined,
    };
  } catch (error) {
    if (error instanceof BrandProfileGenerationError) {
      throw error;
    }
    throw new BrandProfileGenerationError(
      'Failed to gather business knowledge',
      'data-gathering',
      false,
      error
    );
  }
}
