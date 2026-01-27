import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { BrandProfileGenerator } from '@/components/brandProfile/BrandProfileGenerator';
import { BrandProfileDisplay } from '@/components/brandProfile/BrandProfileDisplay';
import { GenerationProgress } from '@/components/brandProfile/GenerationProgress';

// Transform database profile to display format
function transformProfile(dbProfile: any) {
  if (!dbProfile) return null;

  // Parse JSON fields that might be stored as strings
  const parseField = (field: any) => {
    if (!field) return field;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  };

  return {
    brand_essence: dbProfile.brand_essence || '',
    brand_positioning: dbProfile.core_offerings || '',
    tone_of_voice: parseField(dbProfile.tone_of_voice) || { 
      primary_tone: '', 
      attributes: [], 
      formality_level: 'casual' 
    },
    content_hooks: parseField(dbProfile.content_focus) || [],
    banned_words: parseField(dbProfile.things_to_avoid) || [],
    target_audience: parseField(dbProfile.target_audience) || { 
      primary: '', 
      characteristics: [] 
    },
    competitive_positioning: parseField(dbProfile.communication_goal) || { 
      differentiators: [], 
      key_advantages: [] 
    },
  };
}

// Simple hook to fetch brand profile from database
function useBrandProfile(businessId: string | undefined) {
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProfile = React.useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('business_brand_profile')
        .select('*')
        .eq('business_id', businessId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No profile exists yet
          setProfile(null);
        } else {
          throw fetchError;
        }
      } else {
        // Transform database format to display format
        setProfile(transformProfile(data));
      }
    } catch (err) {
      console.error('Error fetching brand profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

export function BrandProfilePageV5() {
  const { user } = useAuthStore();
  const [businessId, setBusinessId] = React.useState<string | null>(null);
  const { profile, loading, error, refetch } = useBrandProfile(businessId || undefined);

  // Fetch business ID from database
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!user) return;

      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (business) {
        setBusinessId(business.id);
      }
    };

    fetchBusiness();
  }, [user]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <GenerationProgress message="Henter brandprofil..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Fejl</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Brandprofil</h1>
        <p className="text-lg text-gray-600">
          Din AI-genererede brandidentitet og kommunikationsguide
        </p>
      </div>

      {/* Content */}
      {profile ? (
        <BrandProfileDisplay 
          profile={profile} 
          onRegenerate={refetch}
        />
      ) : businessId ? (
        <BrandProfileGenerator 
          businessId={businessId} 
          onSuccess={refetch}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600">Ingen forretning fundet. Kontakt support hvis problemet fortsætter.</p>
        </div>
      )}
    </div>
  );
}

export default BrandProfilePageV5;
