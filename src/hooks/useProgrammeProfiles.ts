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
  people_type: string;              // Updated from 'label' (June 28, 2026)
  people_type_id?: number;          // Derived ID for canonical people type
  timing_windows?: string[];        // Now optional (removed for occasion-based segments)
  content_angles: string[];
  segment_size: 'primary' | 'secondary' | 'niche';
  motivation: string;
  decision_timing: string;
  location_occasions?: string[];    // NEW: occasion-based (replaces time-slot thinking)
  concept_fit_reason?: string;      // Why this segment fits the business
  evidence: string[];
  // Removed fields (June 28, 2026): label, goal_contribution, situation, validation_failed
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

      if (fetchError) {
        console.error('[useProgrammeProfiles] Error fetching programmes:', fetchError);
        throw fetchError;
      }
      
      if (!data || data.length === 0) {
        setProgrammes([]);
        return;
      }

      // Parse JSONB fields
      const parsedProgrammes = (data || []).map((programme: any) => {
        // Parse baseline_goal_split
        let goalSplit = 
          typeof programme.baseline_goal_split === 'string'
            ? JSON.parse(programme.baseline_goal_split)
            : programme.baseline_goal_split || { drive_footfall: 0, strengthen_brand: 0 };
        
        // Migrate legacy 3-goal structure to 2-goal framework
        if ('retain_regulars' in goalSplit) {
          goalSplit = {
            drive_footfall: goalSplit.drive_footfall || 0,
            strengthen_brand: (goalSplit.strengthen_brand || 0) + (goalSplit.retain_regulars || 0)
          };
        }
        
        return {
          ...programme,
          time_windows: programme.time_windows || [],
          operating_days: programme.operating_days || [],
          menu_evidence: programme.menu_evidence || [],
          baseline_goal_split: goalSplit,
          content_type_affinity:
            typeof programme.content_type_affinity === 'string'
              ? JSON.parse(programme.content_type_affinity)
              : programme.content_type_affinity || {},
          audience_segments:
            typeof programme.audience_segments === 'string'
              ? JSON.parse(programme.audience_segments)
              : programme.audience_segments || [],
        };
      });

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
