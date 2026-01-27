import { supabase } from '../lib/supabase';
import type { LocationIntelligence, PopulateLocationRequest, PopulateLocationResponse } from '../types/locationIntelligence';

export const locationIntelligenceService = {
  /**
   * Fetch existing location intelligence from database
   */
  async fetchLocationIntelligence(businessId: string): Promise<LocationIntelligence | null> {
    try {
      const { data, error } = await supabase
        .from('business_location_intelligence' as any)
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location intelligence:', error);
        return null;
      }

      return data as LocationIntelligence | null;
    } catch (error) {
      console.error('Exception fetching location intelligence:', error);
      return null;
    }
  },

  /**
   * Trigger Edge Function to populate location intelligence from Google Maps
   */
  async populateLocationIntelligence(
    request: PopulateLocationRequest
  ): Promise<PopulateLocationResponse> {
    try {
      console.log('🚀 Invoking Edge Function with business_id:', request.business_id);
      
      const { data, error } = await supabase.functions.invoke(
        'populate-location-intelligence',
        {
          body: request
        }
      );

      if (error) {
        console.error('Edge Function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Try to extract the actual error message from the response
        if (data && typeof data === 'object' && 'error' in data) {
          console.error('Server error message:', data.error);
          return {
            success: false,
            error: data.error as string
          };
        }
        
        return {
          success: false,
          error: error.message || 'Failed to populate location intelligence'
        };
      }

      console.log('✅ Edge Function response:', data);
      return data as PopulateLocationResponse;
    } catch (error) {
      console.error('Exception calling populate-location-intelligence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
