import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';

export function SmartBrandProfileView() {
  const { t } = useTranslation(['brand', 'tier']);
  const { business } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!business?.id) return;

      const { data } = await supabase
        .from('business_brand_profile')
        .select('*')
        .eq('business_id', business.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    fetchProfile();
  }, [business?.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">Din brandprofil er ikke genereret endnu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Din Brandprofil</h1>
        <p className="text-gray-600">AI-genereret brandidentitet (læs-kun)</p>
      </div>

      {/* Brand Essence (Hero) */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 mb-6">
        <h2 className="text-sm font-medium text-blue-600 mb-2">BRAND ESSENCE</h2>
        <p className="text-3xl font-bold text-gray-900 mb-4">{profile.brand_essence}</p>
        <p className="text-lg text-gray-700">{profile.brand_positioning}</p>
      </div>

      {/* Tone of Voice */}
      {profile.tone_of_voice && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tone of Voice</h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Primær tone:</span>
              <p className="text-gray-900">{profile.tone_of_voice.primary_tone}</p>
            </div>
            {profile.tone_of_voice.attributes && (
              <div>
                <span className="text-sm font-medium text-gray-600">Attributter:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {profile.tone_of_voice.attributes.map((attr: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                      {attr}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Hooks (Top 3) */}
      {profile.content_hooks && profile.content_hooks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Hooks</h3>
          <div className="space-y-3">
            {profile.content_hooks.slice(0, 3).map((hook: any, i: number) => (
              <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="font-medium text-gray-900">"{hook.hook}"</p>
                <p className="text-sm text-gray-600 mt-1">→ {hook.usage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Want more control? */}
      <div className="mt-8">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-purple-900">Vil du redigere din brandprofil?</h4>
              <p className="text-sm text-purple-700">Opgrader til Pro for fuld kontrol</p>
            </div>
            <button className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 whitespace-nowrap">
              Opgrader til Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
