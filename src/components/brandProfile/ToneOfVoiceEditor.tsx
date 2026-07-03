/**
 * Tone of Voice Editor Component
 * 
 * Allows users to edit structured ToV fields in Brand Profile V5.1:
 * - Structural rules (enforceable constraints)
 * - Avoid patterns (brochure_language, superlatives, generic_marketing, compound_sentences)
 * - Length limits (platform-specific targets)
 * - Tone keywords, formality, humor
 * 
 * @version 1.0
 * @date May 13, 2026
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ToneOfVoiceEditorProps {
  businessId: string;
  currentProfile: {
    voice?: {
      tone_rules?: string[];
      structural_rules?: string[];
      style_rules?: string[];
      personality_traits?: string[];
      formality_level?: string;
      humor_style?: string;
    };
    guardrails?: {
      avoid_patterns?: {
        brochure_language?: string[];
        superlatives?: string[];
        generic_marketing?: string[];
        compound_sentences?: string[];
      };
      length_limits?: {
        instagram?: { sentences: string; characters: string };
        facebook?: { sentences: string; characters: string };
        google?: { sentences: string; characters: string };
        story?: { sentences: string; characters: string };
      };
    };
  };
  onSave?: () => void;
}

export function ToneOfVoiceEditor({ businessId, currentProfile, onSave }: ToneOfVoiceEditorProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Structural rules (enforceable)
  const [structuralRules, setStructuralRules] = useState<string[]>(
    currentProfile.voice?.structural_rules || []
  );
  
  // Avoid patterns
  const [brochureLanguage, setBrochureLanguage] = useState<string[]>(
    currentProfile.guardrails?.avoid_patterns?.brochure_language || []
  );
  const [superlatives, setSuperlatives] = useState<string[]>(
    currentProfile.guardrails?.avoid_patterns?.superlatives || []
  );
  const [genericMarketing, setGenericMarketing] = useState<string[]>(
    currentProfile.guardrails?.avoid_patterns?.generic_marketing || []
  );
  const [compoundSentences, setCompoundSentences] = useState<string[]>(
    currentProfile.guardrails?.avoid_patterns?.compound_sentences || []
  );
  
  // Length limits
  const [lengthLimits, setLengthLimits] = useState(
    currentProfile.guardrails?.length_limits || {
      instagram: { sentences: '3-6', characters: '300-450' },
      facebook: { sentences: '3-6', characters: '300-450' },
      google: { sentences: '2-4', characters: '180-300' },
      story: { sentences: '1', characters: '100-150' }
    }
  );
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // Fetch current brand_profile_v5 JSONB
      const { data: current, error: fetchError } = await supabase
        .from('business_brand_profile')
        .select('brand_profile_v5')
        .eq('business_id', businessId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentData = current as any;
      const updatedProfile = {
        ...(currentData?.brand_profile_v5 || {}),
        version: '5.1',
        voice: {
          ...(currentData?.brand_profile_v5?.voice || {}),
          structural_rules: structuralRules
        },
        guardrails: {
          ...(currentData?.brand_profile_v5?.guardrails || {}),
          avoid_patterns: {
            brochure_language: brochureLanguage,
            superlatives: superlatives,
            generic_marketing: genericMarketing,
            compound_sentences: compoundSentences
          },
          length_limits: lengthLimits
        }
      };
      
      const { error: updateError } = await supabase
        .from('business_brand_profile')
        .update({
          brand_profile_v5: updatedProfile,
          brand_profile_v5_version: '5.1',
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId);
      
      if (updateError) throw updateError;
      
      console.log('✅ Tone of Voice saved successfully');
      onSave?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      console.error('❌ Save failed:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <div className="border-b pb-4">
        <h2 className="text-xl font-semibold text-gray-900">Rediger Tone of Voice</h2>
        <p className="text-sm text-gray-600 mt-1">
          Strukturerede regler der håndhæves i AI-genereret tekst
        </p>
      </div>
      
      {/* Structural Rules */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">📐 Strukturelle Regler (Håndhæves)</h3>
        <p className="text-sm text-gray-600 mb-3">
          Konkrete regler der kan valideres (f.eks. sætningsstruktur, længdebegrænsninger)
        </p>
        <div className="space-y-2">
          {structuralRules.map((rule, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={rule}
                onChange={(e) => {
                  const updated = [...structuralRules];
                  updated[index] = e.target.value;
                  setStructuralRules(updated);
                }}
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <button
                onClick={() => setStructuralRules(structuralRules.filter((_, i) => i !== index))}
                className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm"
              >
                Fjern
              </button>
            </div>
          ))}
          <button
            onClick={() => setStructuralRules([...structuralRules, ''])}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
          >
            + Tilføj regel
          </button>
        </div>
      </div>
      
      {/* Avoid Patterns */}
      <div className="pt-6 border-t">
        <h3 className="font-medium text-gray-900 mb-4">🚫 Undgå Mønstre</h3>
        
        {/* Brochure Language */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Brochure-sprog</h4>
          <p className="text-xs text-gray-500 mb-2">Eksempler: "pirrer næsen", "fuldender oplevelsen"</p>
          <PatternList patterns={brochureLanguage} onChange={setBrochureLanguage} />
        </div>
        
        {/* Superlatives */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Superlativer</h4>
          <p className="text-xs text-gray-500 mb-2">Eksempler: "perfekt", "fantastisk", "unik"</p>
          <PatternList patterns={superlatives} onChange={setSuperlatives} />
        </div>
        
        {/* Generic Marketing */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Generisk Marketing</h4>
          <p className="text-xs text-gray-500 mb-2">Eksempler: "forkæl dig selv", "nyd det gode liv"</p>
          <PatternList patterns={genericMarketing} onChange={setGenericMarketing} />
        </div>
        
        {/* Compound Sentences */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Sammensat Sætninger (midt i sætning)</h4>
          <p className="text-xs text-gray-500 mb-2">Eksempler: "mens", "selvom", "fordi"</p>
          <PatternList patterns={compoundSentences} onChange={setCompoundSentences} />
        </div>
      </div>
      
      {/* Length Limits */}
      <div className="pt-6 border-t">
        <h3 className="font-medium text-gray-900 mb-4">📏 Længdebegrænsninger</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(lengthLimits).map(([platform, limits]) => (
            <div key={platform} className="border rounded p-3">
              <div className="font-medium text-sm capitalize mb-2">{platform}</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600">Sætninger</label>
                  <input
                    type="text"
                    value={limits.sentences}
                    onChange={(e) => setLengthLimits({
                      ...lengthLimits,
                      [platform]: { ...limits, sentences: e.target.value }
                    })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="3-6"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Tegn</label>
                  <input
                    type="text"
                    value={limits.characters}
                    onChange={(e) => setLengthLimits({
                      ...lengthLimits,
                      [platform]: { ...limits, characters: e.target.value }
                    })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="300-450"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Save Button */}
      <div className="pt-6 border-t flex items-center justify-between">
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Gemmer...' : 'Gem Ændringer'}
        </button>
      </div>
    </div>
  );
}

// Helper component for pattern lists
function PatternList({ patterns, onChange }: { patterns: string[], onChange: (patterns: string[]) => void }) {
  return (
    <div className="space-y-2">
      {patterns.map((pattern, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={pattern}
            onChange={(e) => {
              const updated = [...patterns];
              updated[index] = e.target.value;
              onChange(updated);
            }}
            className="flex-1 px-2 py-1 border rounded text-sm"
          />
          <button
            onClick={() => onChange(patterns.filter((_, i) => i !== index))}
            className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...patterns, ''])}
        className="px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 text-xs"
      >
        + Tilføj
      </button>
    </div>
  );
}
