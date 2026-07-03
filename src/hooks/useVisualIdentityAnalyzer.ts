import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseVisualIdentityAnalyzerResult {
  analyzing: boolean;
  checkingStorage: boolean;
  error: string | null;
  recognizableInteriorIdentity: string | null;
  visualCharacter: string | null;
  venueScene: string | null;
  analyze: (businessId: string, photoPaths: string[]) => Promise<boolean>;
  checkAndAutoAnalyze: (businessId: string) => Promise<string[]>;
}

export function useVisualIdentityAnalyzer(): UseVisualIdentityAnalyzerResult {
  const [analyzing, setAnalyzing] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognizableInteriorIdentity, setRecognizableInteriorIdentity] = useState<string | null>(null);
  const [visualCharacter, setVisualCharacter] = useState<string | null>(null);
  const [venueScene, setVenueScene] = useState<string | null>(null);

  // Lists photos from the visual-identity storage bucket for a given business.
  // Returns the array of storage paths (e.g. "{businessId}/photo.jpg").
  const checkAndAutoAnalyze = async (businessId: string): Promise<string[]> => {
    if (!businessId) return [];
    try {
      setCheckingStorage(true);
      const { data: files, error: listError } = await supabase.storage
        .from('visual-identity')
        .list(businessId, { limit: 20 });
      if (listError || !files || files.length === 0) return [];
      const paths = files
        .filter((f) => f.name && !f.name.startsWith('.'))
        .map((f) => `${businessId}/${f.name}`);
      if (paths.length > 0) {
        await analyze(businessId, paths);
      }
      return paths;
    } catch {
      return [];
    } finally {
      setCheckingStorage(false);
    }
  };

  const analyze = async (businessId: string, photoPaths: string[]): Promise<boolean> => {
    if (!businessId || photoPaths.length === 0) {
      setError('Business ID and at least one photo are required');
      return false;
    }

    try {
      setAnalyzing(true);
      setError(null);
      setRecognizableInteriorIdentity(null);
      setVisualCharacter(null);
      setVenueScene(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-visual-identity',
        {
          body: { 
            business_id: businessId,
            photo_paths: photoPaths,
            locale: navigator.language?.split('-')[0] || 'da',
          },
        }
      );

      if (functionError) {
        // The Supabase SDK wraps the real error. For non-2xx responses the body
        // is in functionError.context (a Response object) rather than data.
        let actualError = functionError.message || 'Analysis failed';
        try {
          const body = await (functionError as any).context?.json?.();
          if (body?.error) actualError = body.error;
        } catch {
          // body not JSON or context not available — keep SDK message
        }
        throw new Error(actualError);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Analysis failed');
      }

      const interiorText: string = data.visual_identity?.recognizable_interior_identity ?? '';
      setRecognizableInteriorIdentity(interiorText);
      setVisualCharacter(data.visual_identity?.venue_character ?? null);
      setVenueScene(data.visual_identity?.venue_scene ?? null);

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
    checkingStorage,
    error,
    recognizableInteriorIdentity,
    visualCharacter,
    venueScene,
    analyze,
    checkAndAutoAnalyze,
  };
}
