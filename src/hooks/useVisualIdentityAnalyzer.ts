import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseVisualIdentityAnalyzerResult {
  analyzing: boolean;
  error: string | null;
  analyze: (businessId: string, photoPaths: string[]) => Promise<boolean>;
}

export function useVisualIdentityAnalyzer(): UseVisualIdentityAnalyzerResult {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (businessId: string, photoPaths: string[]): Promise<boolean> => {
    if (!businessId || photoPaths.length === 0) {
      setError('Business ID and at least one photo are required');
      return false;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-visual-identity',
        {
          body: { 
            business_id: businessId,
            photo_paths: photoPaths,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Analysis failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Visual identity analysis error:', err);
      setError(errorMessage);
      return false;
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzing,
    error,
    analyze,
  };
}
