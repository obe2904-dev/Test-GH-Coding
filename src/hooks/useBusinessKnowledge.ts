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
  BusinessMenuMetadata,
  CreateMenuMetadata,
  UpdateMenuMetadata,
  BusinessVisualIdentity,
  CreateVisualIdentity,
  UpdateVisualIdentity,
  BusinessAudienceProfile,
  CreateAudienceProfile,
  UpdateAudienceProfile
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
// MENU METADATA HOOK
// ============================================================================

export function useMenuMetadata(businessId: string | null) {
  const [data, setData] = useState<BusinessMenuMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMenu = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: menu, error: fetchError } = await supabase
        .from('business_menu_metadata')
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

      setData(menu as BusinessMenuMetadata);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch menu metadata'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const create = async (menu: CreateMenuMetadata) => {
    try {
      const { data: newMenu, error: createError } = await supabase
        .from('business_menu_metadata')
        .insert(menu)
        .select()
        .single();

      if (createError) throw createError;

      setData(newMenu as BusinessMenuMetadata);
      return newMenu;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create menu metadata');
      setError(error);
      throw error;
    }
  };

  const update = async (updates: UpdateMenuMetadata) => {
    if (!businessId) throw new Error('No business ID provided');

    try {
      const { data: updatedMenu, error: updateError } = await supabase
        .from('business_menu_metadata')
        .update(updates)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      setData(updatedMenu as BusinessMenuMetadata);
      return updatedMenu;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update menu metadata');
      setError(error);
      throw error;
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchMenu,
    create,
    update,
  };
}

// ============================================================================
// VISUAL IDENTITY HOOK
// ============================================================================

export function useVisualIdentity(businessId: string | null) {
  const [data, setData] = useState<BusinessVisualIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVisual = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: visual, error: fetchError } = await supabase
        .from('business_visual_identity')
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

      setData(visual as BusinessVisualIdentity);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch visual identity'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchVisual();
  }, [fetchVisual]);

  const create = async (visual: CreateVisualIdentity) => {
    try {
      const { data: newVisual, error: createError } = await supabase
        .from('business_visual_identity')
        .insert(visual)
        .select()
        .single();

      if (createError) throw createError;

      setData(newVisual as BusinessVisualIdentity);
      return newVisual;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create visual identity');
      setError(error);
      throw error;
    }
  };

  const update = async (updates: UpdateVisualIdentity) => {
    if (!businessId) throw new Error('No business ID provided');

    try {
      const { data: updatedVisual, error: updateError } = await supabase
        .from('business_visual_identity')
        .update(updates)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      setData(updatedVisual as BusinessVisualIdentity);
      return updatedVisual;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update visual identity');
      setError(error);
      throw error;
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchVisual,
    create,
    update,
  };
}

// ============================================================================
// AUDIENCE PROFILE HOOK
// ============================================================================

export function useAudienceProfile(businessId: string | null) {
  const [data, setData] = useState<BusinessAudienceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAudience = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: audience, error: fetchError } = await supabase
        .from('business_audience_profile')
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

      setData(audience as BusinessAudienceProfile);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch audience profile'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchAudience();
  }, [fetchAudience]);

  const create = async (audience: CreateAudienceProfile) => {
    try {
      const { data: newAudience, error: createError } = await supabase
        .from('business_audience_profile')
        .insert(audience)
        .select()
        .single();

      if (createError) throw createError;

      setData(newAudience as BusinessAudienceProfile);
      return newAudience;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create audience profile');
      setError(error);
      throw error;
    }
  };

  const update = async (updates: UpdateAudienceProfile) => {
    if (!businessId) throw new Error('No business ID provided');

    try {
      const { data: updatedAudience, error: updateError } = await supabase
        .from('business_audience_profile')
        .update(updates)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      setData(updatedAudience as BusinessAudienceProfile);
      return updatedAudience;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update audience profile');
      setError(error);
      throw error;
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchAudience,
    create,
    update,
  };
}
