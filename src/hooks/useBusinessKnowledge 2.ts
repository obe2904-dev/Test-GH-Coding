/**
 * Hooks for Business Knowledge Tables
 * 
 * These hooks provide CRUD operations for the business knowledge system:
 * - Business Operations (hours, capacity, pricing)
 * - Location Intelligence (neighborhood, landmarks)
 * - Menu Metadata (item counts, certifications)
 * - Visual Identity (colors, photography style)
 * - Audience Profile (segments, competitors)
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { 
  BusinessOperations, 
  CreateBusinessOperations, 
  UpdateBusinessOperations,
  BusinessLocationIntelligence,
  CreateLocationIntelligence,
  UpdateLocationIntelligence,
  // BusinessMenuMetadata, // unused - table does not exist
  // CreateMenuMetadata, // unused - table does not exist
  // UpdateMenuMetadata, // unused - table does not exist
  // BusinessVisualIdentity, // unused - table does not exist
  // CreateVisualIdentity, // unused - table does not exist
  // UpdateVisualIdentity, // unused - table does not exist
  // BusinessAudienceProfile, // unused
  // CreateAudienceProfile, // unused
  // UpdateAudienceProfile // unused
} from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// BUSINESS OPERATIONS HOOK
// ============================================================================

export function useBusinessOperations(businessId: string | null) {
  const [data, setData] = useState<BusinessOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOperations = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: operations, error: fetchError } = await supabase
        .from('business_operations')
        .select('*')
        .eq('business_id', businessId)
        .single();

      if (fetchError) {
        // If no record exists, that's okay - return null
        if (fetchError.code === 'PGRST116') {
          setData(null);
          return;
        }
        throw fetchError;
      }

      setData(operations as BusinessOperations);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch operations'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  const create = async (operations: CreateBusinessOperations) => {
    try {
      const { data: newOperations, error: createError } = await supabase
        .from('business_operations')
        .insert(operations)
        .select()
        .single();

      if (createError) throw createError;

      setData(newOperations as BusinessOperations);
      return newOperations;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create operations');
      setError(error);
      throw error;
    }
  };

  const update = async (updates: UpdateBusinessOperations) => {
    if (!businessId) throw new Error('No business ID provided');

    try {
      const { data: updatedOperations, error: updateError } = await supabase
        .from('business_operations')
        .update(updates)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      setData(updatedOperations as BusinessOperations);
      return updatedOperations;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update operations');
      setError(error);
      throw error;
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchOperations,
    create,
    update,
  };
}

// ============================================================================
// LOCATION INTELLIGENCE HOOK
// ============================================================================

export function useLocationIntelligence(businessId: string | null) {
  const [data, setData] = useState<BusinessLocationIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLocation = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: location, error: fetchError } = await supabase
        .from('business_location_intelligence')
        .select('*')
        .eq('business_id', businessId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setData(null);
          return;
        }
        throw fetchError;
      }

      setData(location as BusinessLocationIntelligence);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch location intelligence'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const create = async (location: CreateLocationIntelligence) => {
    try {
      const { data: newLocation, error: createError } = await supabase
        .from('business_location_intelligence')
        .insert(location)
        .select()
        .single();

      if (createError) throw createError;

      setData(newLocation as BusinessLocationIntelligence);
      return newLocation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create location intelligence');
      setError(error);
      throw error;
    }
  };

  const update = async (updates: UpdateLocationIntelligence) => {
    if (!businessId) throw new Error('No business ID provided');

    try {
      const { data: updatedLocation, error: updateError } = await supabase
        .from('business_location_intelligence')
        .update(updates)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      setData(updatedLocation as BusinessLocationIntelligence);
      return updatedLocation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update location intelligence');
      setError(error);
      throw error;
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchLocation,
    create,
    update,
  };
}

// ============================================================================
// MENU METADATA HOOK — STUBBED
// ⚠️ The `business_menu_metadata` table was DROPPED April 2026 (migration 20260420000007).
// Menu data is now in `menu_results_v2` and `menu_items_normalized`.
// This hook is retained to avoid breaking its one caller (MenuMetadataCard, which has no
// active parent). Do NOT add new callsites. Do NOT query business_menu_metadata.
// ============================================================================

export function useMenuMetadata(_businessId: string | null) {
  return {
    data: null,
    loading: false,
    error: null,
    refetch: async () => {},
    create: async () => null,
    update: async () => null,
  };
}

// ============================================================================
// VISUAL IDENTITY HOOK
// ============================================================================

// ⚠️ The `business_visual_identity` table was DROPPED April 2026 (migration 20260420000007).
// Visual style data is now stored in business_brand_profile (visual_character, venue_scene).
// This hook is stubbed to avoid import errors. Do NOT add new callsites.
export function useVisualIdentity(_businessId: string | null) {
  return {
    data: null,
    loading: false,
    error: null,
    refetch: async () => {},
    create: async () => null,
    update: async () => null,
  };
}

// ============================================================================
// AUDIENCE PROFILE HOOK — STUBBED
// ⚠️ The `business_audience_profile` table was DROPPED April 2026 (migration 20260420000007).
// Table had 0 rows. Audience signals are in `business_brand_profile.target_audience`.
// This hook is retained to avoid import errors. Do NOT add new callsites.
// ============================================================================

export function useAudienceProfile(_businessId: string | null) {
  return {
    data: null,
    loading: false,
    error: null,
    refetch: async () => {},
    create: async () => null,
    update: async () => null,
  };
}
