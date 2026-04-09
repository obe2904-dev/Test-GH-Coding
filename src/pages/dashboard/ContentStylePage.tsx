'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

type BusinessVoice = 'formal' | 'professional' | 'friendly' | 'casual';

interface VoiceOption {
  id: BusinessVoice;
  label: string;
  description: string;
  bestFor: string;
  example: string;
  emojiStyle: string;
  emojiExamples: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'formal',
    label: 'Formal & Refined',
    description: 'Elegant, sophisticated language',
    bestFor: 'Fine dining, luxury establishments',
    example: 'Experience culinary artistry in an intimate setting',
    emojiStyle: 'Minimal/elegant',
    emojiExamples: '✨🌟🍷'
  },
  {
    id: 'professional',
    label: 'Professional & Welcoming',
    description: 'Polished yet approachable',
    bestFor: 'Upscale casual, bistros, wine bars',
    example: 'Join us for a carefully curated dining experience',
    emojiStyle: '1-2 practical',
    emojiExamples: '📍🕐☕'
  },
  {
    id: 'friendly',
    label: 'Friendly & Approachable',
    description: 'Warm, inviting, conversational',
    bestFor: 'Cafes, family restaurants, neighborhood spots',
    example: 'Kom forbi til kaffe og hjemmebagt ☕',
    emojiStyle: '2-3 strategic',
    emojiExamples: '☕🍰📍🕐'
  },
  {
    id: 'casual',
    label: 'Casual & Playful',
    description: 'Energetic, fun, relaxed',
    bestFor: 'Bars, nightlife, young crowd',
    example: 'Weekend vibes starter her 🎉',
    emojiStyle: '2-3 expressive',
    emojiExamples: '🎉🍹✨'
  }
];

export default function ContentStylePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<BusinessVoice>('friendly');
  const [suggestedVoice, setSuggestedVoice] = useState<BusinessVoice | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Get business
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!business) {
        console.error('No business found');
        return;
      }

      setBusinessId(business.id);

      // Load existing voice setting
      const { data: profile } = await supabase
        .from('business_brand_profile')
        .select('business_voice')
        .eq('business_id', business.id)
        .maybeSingle();

      if (profile?.business_voice) {
        setSelectedVoice(profile.business_voice as BusinessVoice);
      } else {
        // Auto-detect suggested voice
        const suggested = await detectBusinessVoice(business.id);
        setSuggestedVoice(suggested);
        setSelectedVoice(suggested);
      }

    } catch (error) {
      console.error('Error loading business data:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectBusinessVoice = async (businessId: string): Promise<BusinessVoice> => {
    try {
      // Load business operations data
      const { data: operations } = await supabase
        .from('business_operations')
        .select('price_level, establishment_type, average_check_per_person')
        .eq('business_id', businessId)
        .maybeSingle();

      if (!operations) return 'friendly';

      // Fine dining indicators
      if (
        operations.price_level === 'Fine Dining' ||
        (operations.average_check_per_person && operations.average_check_per_person > 400)
      ) {
        return 'formal';
      }

      // Casual/bar indicators
      if (
        operations.establishment_type?.toLowerCase().includes('bar') ||
        operations.establishment_type?.toLowerCase().includes('pub') ||
        operations.establishment_type?.toLowerCase().includes('nightclub')
      ) {
        return 'casual';
      }

      // Professional upscale
      if (
        operations.price_level === 'Premium' ||
        (operations.average_check_per_person && operations.average_check_per_person > 250)
      ) {
        return 'professional';
      }

      // Default: Friendly (cafes, family restaurants)
      return 'friendly';

    } catch (error) {
      console.error('Error detecting voice:', error);
      return 'friendly';
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    try {
      // Upsert to business_brand_profile
      const { error } = await supabase
        .from('business_brand_profile')
        .upsert({
          business_id: businessId,
          business_voice: selectedVoice,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        });

      if (error) {
        console.error('Error saving voice:', error);
        alert('Fejl ved lagring. Prøv igen.');
        return;
      }

      // Navigate to next step (or dashboard if this is being edited later)
      navigate('/dashboard');

    } catch (error) {
      console.error('Error:', error);
      alert('Uventet fejl. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Indlæser...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎨 Content Style
          </h1>
          <p className="text-gray-600">
            Vælg den tone der passer til din virksomhed. Dette styrer både sproget og emoji-brugen i dine posts.
          </p>
        </div>

        {suggestedVoice && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Forslag:</strong> Baseret på dine priser og type anbefaler vi "{VOICE_OPTIONS.find(v => v.id === suggestedVoice)?.label}"
            </p>
          </div>
        )}

        {/* Voice Options */}
        <div className="space-y-4 mb-8">
          {VOICE_OPTIONS.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
                selectedVoice === voice.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mt-1 flex items-center justify-center ${
                  selectedVoice === voice.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedVoice === voice.id && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {voice.label}
                    {suggestedVoice === voice.id && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Anbefalet
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{voice.description}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    <strong>Passer til:</strong> {voice.bestFor}
                  </p>
                  
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm italic text-gray-700">"{voice.example}"</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div>
                      <strong>Emoji style:</strong> {voice.emojiStyle}
                    </div>
                    <div>
                      <strong>Eksempler:</strong> {voice.emojiExamples}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Emoji Best Practices */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <h3 className="text-sm font-semibold text-yellow-900 mb-3">
            📱 Emoji Best Practices
          </h3>
          <ul className="text-sm text-yellow-800 space-y-2">
            <li>• <strong>1-3 emojis per post</strong> er sweet spot</li>
            <li>• Placer strategisk: før CTAs (👉 Book nu), ved nøgleinfo (📍🕐)</li>
            <li>• Facebook posts bruger automatisk færre emojis end Instagram</li>
            <li>• Hospitality toolkit: ☕🍰🍷📍🕐 (mad, sted, tid)</li>
            <li>• Emojis forbedrer tekst - erstatter aldrig vigtige ord</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Tilbage
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Gemmer...' : 'Gem og fortsæt'}
          </button>
        </div>
      </div>
    </div>
  );
}
