import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UsePostGeneratorResult {
  generating: boolean;
  error: string | null;
  generate: (businessId: string, numberOfPosts?: number) => Promise<boolean>;
}

export function usePostGenerator(): UsePostGeneratorResult {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (businessId: string, numberOfPosts: number = 3): Promise<boolean> => {
    if (!businessId) {
      setError('Business ID is required');
      return false;
    }

    try {
      setGenerating(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        'generate-post-ideas',
        {
          body: { 
            business_id: businessId,
            number_of_posts: numberOfPosts,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Generation failed');
      }

      if (!data.success) {
        throw new Error(data.error || data.suggestion || 'Generation failed');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Post generation error:', err);
      setError(errorMessage);
      return false;
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
