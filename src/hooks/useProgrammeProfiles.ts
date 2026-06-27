import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ProgrammeProfile {
  business_id: string;
  programme_type: string;
  programme_name: string;
  time_windows: string[];
  operating_days: string[];
  menu_evidence: string[];
  confidence: number;
  baseline_goal_split: {
    drive_footfall: number;
    strengthen_brand: number;
    retain_regulars: number;
  };
  decision_timing: string;
  content_type_affinity: {
    product_menu: number;
    behind_scenes: number;
    atmosphere: number;
    community: number;
    educational: number;
  };
  commercial_reasoning: string;
  audience_segments: AudienceSegment[];
  segment_confidence: number;
  segment_reasoning: string;
}

export interface AudienceSegment {
  label: string;
  timing_windows: string[];
  content_angles: string[];
  segment_size: 'primary' | 'secondary' | 'niche';
  motivation: string;
  decision_timing: string;
  goal_contribution: string;
  evidence: string[];
}

export function useProgrammeProfiles(businessId: string | undefined) {
  const [programmes, setProgrammes] = useState<ProgrammeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgrammes = useCallback(async (bustCache = false) => {
    if (!businessId) {
      console.log('[useProgrammeProfiles] No businessId provided, skipping fetch');
      setLoading(false);
      return;
    }

    const timestamp = bustCache ? `?_t=${Date.now()}` : '';
    console.log('[useProgrammeProfiles] 🔍 Fetching programmes for business:', businessId, timestamp ? '(cache busted)' : '');

    try {
      setLoading(true);
      setError(null);

      // Add small delay if cache busting to ensure writes are committed
      if (bustCache) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const { data, error: fetchError } = await supabase
        .from('business_programme_profiles')
        .select('*')
        .eq('business_id', businessId)
        .order('programme_type');

      console.log('[useProgrammeProfiles] 📥 Raw response:', { 
        data, 
        error: fetchError, 
        count: data?.length,
        businessId,
        errorDetails: fetchError ? {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code
        } : null
      });

      if (fetchError) {
        throw fetchError;
      }

      // Parse JSONB fields
      const parsedProgrammes = (data || []).map((programme: any) => ({
        ...programme,
        time_windows: programme.time_windows || [],
        operating_days: programme.operating_days || [],
        menu_evidence: programme.menu_evidence || [],
        baseline_goal_split: 
          typeof programme.baseline_goal_split === 'string'
            ? JSON.parse(programme.baseline_goal_split)
            : programme.baseline_goal_split || { drive_footfall: 0, strengthen_brand: 0, retain_regulars: 0 },
        content_type_affinity:
          typeof programme.content_type_affinity === 'string'
            ? JSON.parse(programme.content_type_affinity)
            : programme.content_type_affinity || {},
        audience_segments:
          typeof programme.audience_segments === 'string'
            ? JSON.parse(programme.audience_segments)
            : programme.audience_segments || [],
      }));

      console.log('[useProgrammeProfiles] ✅ Parsed programmes:', parsedProgrammes.length, parsedProgrammes.map(p => p.programme_name));
      setProgrammes(parsedProgrammes);
    } catch (err) {
      console.error('[useProgrammeProfiles] ❌ Error fetching programme profiles:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch programme profiles'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchProgrammes();
  }, [fetchProgrammes]);

  return { programmes, loading, error, refetch: fetchProgrammes };
}
