import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface V5GenerationResult {
  success: boolean;
  programmes: Array<{
    type: string;
    name: string;
    audienceSegments: number;
  }>;
  identity: {
    brand_essence: string;
    positioning: string;
    confidence: number;
  };
}

interface UseBrandProfileV5GenerationResult {
  generating: boolean;
  error: string | null;
  generate: (businessId: string, forceRegenerate?: boolean) => Promise<V5GenerationResult | null>;
}

/**
 * Hook for generating V5 brand profile (Layers 1-4)
 * TWO-STEP PROCESS:
 * 1. Calls menu-overview-summary Edge Function (generates cross-menu summary)
 * 2. Calls brand-profile-generator-v5 Edge Function (uses pre-generated summary)
 */
export function useBrandProfileV5Generation(): UseBrandProfileV5GenerationResult {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (
    businessId: string,
    forceRegenerate: boolean = true
  ): Promise<V5GenerationResult | null> => {
    if (!businessId) {
      setError('Business ID is required');
      return null;
    }

    try {
      setGenerating(true);
      setError(null);

      console.log('[V5 Generation] Starting V5 brand profile generation...');
      const startTime = Date.now();

      // ========================================================================
      // STEP 1: Generate Menu Overview Summary (NEW)
      // ========================================================================
      console.log('[V5 Generation] Step 1: Generating menu overview summary...');
      
      const { data: menuSummaryData, error: menuSummaryError } = await supabase.functions.invoke(
        'menu-overview-summary',
        {
          body: {
            businessId,
          },
        }
      );

      if (menuSummaryError) {
        console.warn('[V5 Generation] ⚠️ Menu summary generation failed:', menuSummaryError.message);
        console.warn('[V5 Generation] Continuing with brand profile generation...');
        // Don't throw - continue with brand profile generation
      } else {
        console.log('[V5 Generation] ✅ Menu overview summary generated');
        if (menuSummaryData?.menu_overview_summary) {
          console.log(`[V5 Generation]    • Total menus: ${menuSummaryData.menu_overview_summary.total_menus}`);
          console.log(`[V5 Generation]    • Total items: ${menuSummaryData.menu_overview_summary.total_items}`);
        }
      }

      // ========================================================================
      // STEP 2: Generate Brand Profile V5 (pass menu summary directly to avoid race condition)
      // ========================================================================
      console.log('[V5 Generation] Step 2: Generating brand profile V5...');
      
      const { data, error: invokeError } = await supabase.functions.invoke(
        'brand-profile-generator-v5',
        {
          body: {
            businessId,
            forceRegenerate,
            // Pass menu summary directly to avoid database race condition
            menuOverviewSummary: menuSummaryData?.menu_overview_summary || null,
          },
        }
      );

      const duration = Date.now() - startTime;

      if (invokeError) {
        const status = (invokeError as any)?.status ?? (invokeError as any)?.context?.status;
        throw new Error(`Edge function error (HTTP ${status}): ${invokeError.message}`);
      }

      if (!data?.success) {
        // Check if profile already exists
        if (data?.existing) {
          throw new Error(
            'V5 profile already exists. Set forceRegenerate to regenerate.'
          );
        }
        throw new Error(data?.error || 'Generation failed');
      }

      console.log(`[V5 Generation] ✅ Success in ${duration}ms`);
      console.log(`[V5 Generation] Generated ${data.programmes?.length || 0} programmes`);
      console.log(`[V5 Generation] Identity confidence: ${data.identity?.confidence || 0}`);

      return data as V5GenerationResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[V5 Generation] Error:', err);
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
