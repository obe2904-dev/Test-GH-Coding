import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface BrandProfile {
  brand_essence: string;
  brand_positioning: string;
  tone_of_voice: {
    primary_tone: string;
    attributes: string[];
    formality_level: string;
  };
  content_hooks: Array<{
    hook: string;
    usage: string;
  }>;
  banned_words: string[];
  target_audience: {
    primary: string;
    characteristics: string[];
  };
  competitive_positioning: {
    differentiators: string[];
    key_advantages: string[];
  };
}

interface GenerationResult {
  success: boolean;
  brand_profile?: BrandProfile;
  error?: string;
}

interface UseBrandProfileGenerationResult {
  generating: boolean;
  error: string | null;
  generate: (businessId: string) => Promise<BrandProfile | null>;
}

export function useBrandProfileGeneration(): UseBrandProfileGenerationResult {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (businessId: string): Promise<BrandProfile | null> => {
    if (!businessId) {
      setError('Business ID is required');
      return null;
    }

    try {
      setGenerating(true);
      setError(null);

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'brand-profile-generator-v5',
        {
          body: { business_id: businessId },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Generation failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      return data.brand_profile as BrandProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Brand profile generation error:', err);
      setError(errorMessage);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generating,
    error,
    generate,
  };
}
