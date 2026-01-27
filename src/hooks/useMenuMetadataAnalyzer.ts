/**
 * Hook for Menu Metadata Analysis
 * Calls Edge Function to analyze menu with AI
 */

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AnalyzeResult {
  success: boolean;
  metadata?: any;
  items_analyzed?: number;
  detected_language?: string;
  error?: string;
}

export function useMenuMetadataAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (businessId: string): Promise<boolean> => {
    setAnalyzing(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-menu-metadata',
        {
          body: { business_id: businessId },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      const result = data as AnalyzeResult;

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze menu';
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
