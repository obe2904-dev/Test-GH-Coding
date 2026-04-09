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

interface UseBrandProfileGenerationResult {
  generating: boolean;
  error: string | null;
  generate: (businessId: string) => Promise<BrandProfile | null>;
}

// Poll the DB until updated_at changes, we hit the timeout, or abortFn() returns true.
// Returns the new profile row on success, null on timeout/abort.
async function pollForUpdatedProfile(
  businessId: string,
  updatedAtBefore: string | null,
  pollIntervalMs = 4000,
  timeoutMs = 165_000, // 2.75 minutes — Supabase wall-clock limit is 150s; stop polling 15s after that
  abortFn: () => boolean = () => false
): Promise<BrandProfile | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    // Stop early if the function definitively failed
    if (abortFn()) return null;

    const { data, error } = await supabase
      .from('business_brand_profile')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (error || !data) continue;

    const newUpdatedAt: string | null = data.updated_at ?? null;
    if (newUpdatedAt && newUpdatedAt !== updatedAtBefore) {
      return data as BrandProfile;
    }
  }

  return null; // timed out
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

      // Snapshot the current updated_at so we can detect when the DB row changes
      const { data: currentRow } = await supabase
        .from('business_brand_profile')
        .select('updated_at')
        .eq('business_id', businessId)
        .single();
      const updatedAtBefore: string | null = currentRow?.updated_at ?? null;

      // Fire the edge function — fire-and-forget: we don't need the response body
      // (the function writes directly to the DB), but we DO watch for definitive
      // failures (4xx / 5xx) so we can abort polling early.
      let functionFailed = false;
      let functionFailedReason = '';
      const invokeStartTime = Date.now();

      supabase.functions
        .invoke('brand-profile-generator', {
          body: { businessId, forceRegenerate: true },
        })
        .then(({ data, error }) => {
          if (error) {
            // FunctionsHttpError carries the HTTP status — 5xx means the function crashed
            const status = (error as any)?.status ?? (error as any)?.context?.status;
            if (status && status >= 400) {
              functionFailed = true;
              functionFailedReason = `Edge function error (HTTP ${status}): ${error.message}`;
              console.warn('[useBrandProfileGeneration] Edge function returned', status, error.message);
            }
          }
          // data.success === false with 200 means early exit (e.g. insufficient differentiators)
          // That still updates the DB, so polling will handle it.
        })
        .catch((err) => {
          // Network-level errors: Supabase JS client can throw even for 200 responses (internal
          // timeout, connection close after response). Only treat as real failure if it happened
          // very quickly (<8s), which means the function never ran. After 8s, assume the function
          // is still running server-side and may write to DB — let polling decide.
          const elapsed = Date.now() - invokeStartTime;
          if (elapsed < 8000) {
            functionFailed = true;
            functionFailedReason = `Edge function failed to start: ${err?.message ?? 'unknown'}`;
            console.warn('[useBrandProfileGeneration] Edge function quick-fail (<8s):', err?.message);
          } else {
            console.warn('[useBrandProfileGeneration] Edge function connection closed after', elapsed, 'ms — continuing poll');
          }
        });

      // Poll the DB every 4 seconds until updated_at changes
      console.log('[useBrandProfileGeneration] Polling DB for profile update...');
      const updatedProfile = await pollForUpdatedProfile(businessId, updatedAtBefore, 4000, 165_000, () => functionFailed);

      if (functionFailed) {
        throw new Error(functionFailedReason || 'Generation failed — please try again');
      }

      if (!updatedProfile) {
        throw new Error('Generation timed out — please try again');
      }

      console.log('[useBrandProfileGeneration] ✅ New profile detected via polling');
      return updatedProfile;
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
