import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PopulateLocationResult {
  success: boolean;
  error?: string;
}

interface UseLocationIntelligencePopulatorResult {
  populating: boolean;
  error: string | null;
  populate: (businessId: string, address: string, city?: string) => Promise<boolean>;
}

export function useLocationIntelligencePopulator(): UseLocationIntelligencePopulatorResult {
  const [populating, setPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const populate = async (
    businessId: string,
    address: string,
    city?: string
  ): Promise<boolean> => {
    if (!businessId || !address) {
      setError('Business ID and address are required');
      return false;
    }

    try {
      setPopulating(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        'populate-location-intelligence',
        {
          body: { 
            business_id: businessId,
            address,
            city,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Population failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Population failed');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Location intelligence population error:', err);
      setError(errorMessage);
      return false;
    } finally {
      setPopulating(false);
    }
  };

  return {
    populating,
    error,
    populate,
  };
}
