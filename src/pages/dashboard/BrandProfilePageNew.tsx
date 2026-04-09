/**
 * Brand Profile Page - New Strategy-Based Implementation
 * 
 * Auto-generates brand strategy from menu, hours, and location data.
 * Uses the locked four-layer strategy model.
 */

import { useEffect, useState } from 'react';
import { AnalyzeIcon } from './BusinessProfileIcons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BrandStrategy, CommunicationGoalType } from '../../lib/brandStrategy/types';
import { generateBrandStrategy, saveBrandStrategy } from '../../lib/brandStrategy/generator';
import { BrandStrategyDisplay } from '../../components/brandStrategy/BrandStrategyDisplay';
import { PhotoUploader } from '../../components/visualIdentity/PhotoUploader';
import { useVisualIdentityAnalyzer } from '../../hooks/useVisualIdentityAnalyzer';

export default function BrandProfilePageNew() {
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interiorPhotoPaths, setInteriorPhotoPaths] = useState<string[]>([]);
  const [atmosphereText, setAtmosphereText] = useState('');
  const [isSavingAtmosphere, setIsSavingAtmosphere] = useState(false);
  const [editingAtmosphere, setEditingAtmosphere] = useState(false);
  const { analyzing: analyzingPhotos, checkingStorage, error: photoError, recognizableInteriorIdentity, analyze: analyzePhotos, checkAndAutoAnalyze } = useVisualIdentityAnalyzer();

  // Load business and existing strategy
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) return;

        // Get business
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (!business) return;

        const bizId = (business as any).id;
        setBusinessId(bizId);

        // Auto-analyze if photos exist
        await checkAndAutoAnalyze(bizId);

        // Check for existing strategy (also loads atmosphere)
        const { data: existingStrategy } = await supabase
          .from('business_brand_profile')
          .select('*')
          .eq('business_id', bizId)
          .maybeSingle();

        if ((existingStrategy as any)?.recognizable_interior_identity) {
          setAtmosphereText((existingStrategy as any).recognizable_interior_identity);
        }

        console.log('Existing strategy from DB:', existingStrategy);

        // @ts-ignore - New columns exist but types not yet regenerated after migration
        if (existingStrategy && (existingStrategy as any).core_offerings) {
          // Transform from database format to BrandStrategy type
          // Ensure arrays are actually arrays
          const strategyData = existingStrategy as any;
          const coreOfferings = Array.isArray(strategyData.core_offerings) 
            ? strategyData.core_offerings 
            : [];
          const offeringsReasoning = Array.isArray(strategyData.offerings_reasoning)
            ? strategyData.offerings_reasoning
            : [];
          const primaryAudience = Array.isArray(strategyData.target_audience_primary)
            ? strategyData.target_audience_primary
            : [];
          const audienceReasoning = Array.isArray(strategyData.audience_reasoning)
            ? strategyData.audience_reasoning
            : [];
          const goalReasoning = Array.isArray(strategyData.goal_reasoning)
            ? strategyData.goal_reasoning
            : [];

          const loadedStrategy: BrandStrategy = {
            business_id: bizId,
            core_offerings: {
              // @ts-ignore
              offerings: coreOfferings,
              // @ts-ignore
              weights: strategyData.offerings_weights || {},
              // @ts-ignore
              reasoning: offeringsReasoning,
              // @ts-ignore
              confidence: strategyData.offerings_confidence || 'low',
              // @ts-ignore
              generated_at: strategyData.generated_at || new Date().toISOString()
            },
            target_audience: {
              // @ts-ignore
              primary: primaryAudience,
              // @ts-ignore
              seasonal: strategyData.target_audience_seasonal || [],
              // @ts-ignore
              reasoning: audienceReasoning,
              // @ts-ignore
              confidence: strategyData.audience_confidence || 'low'
            },
            communication_goal: {
              // @ts-ignore
              goal: (strategyData.communication_goal || 'drive_visits') as CommunicationGoalType,
              // @ts-ignore
              reasoning: goalReasoning,
              // @ts-ignore
              confidence: strategyData.goal_confidence || 'low'
            },
            // @ts-ignore
            locale: strategyData.locale || 'da-DK',
            // @ts-ignore
            version: strategyData.strategy_version || '1.0.0',
            // @ts-ignore
            generated_at: strategyData.generated_at || new Date().toISOString(),
            // @ts-ignore
            approved_by_user: strategyData.approved_by_user || false
          };

          console.log('Loaded strategy from DB:', loadedStrategy);
          setStrategy(loadedStrategy);
        }

      } catch (err) {
        console.error('Error loading data:', err);
        setError('Kunne ikke indlæse data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate new strategy
  const handleGenerate = async () => {
    if (!businessId) return;

    try {
      setIsGenerating(true);
      setError(null);

      console.log('🎯 Starting brand strategy generation...');

      const newStrategy = await generateBrandStrategy(businessId);

      if (!newStrategy) {
        setError('Kunne ikke generere brandprofil. Sørg for at have udfyldt menu, åbningstider og lokation.');
        return;
      }

      // After generation, reload the latest strategy from DB to ensure reasoning/debug info is up-to-date
      const { data: existingStrategy } = await supabase
        .from('business_brand_profile')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (existingStrategy && Array.isArray((existingStrategy as any).core_offerings)) {
        // Use correct fields from schema
        const sd = existingStrategy as any;
        const loadedStrategy: BrandStrategy = {
          business_id: businessId,
          core_offerings: {
            offerings: sd.core_offerings || [],
            weights: sd.offerings_weights || {},
            reasoning: sd.offerings_reasoning || [],
            confidence: sd.offerings_confidence || 'low',
            generated_at: sd.generated_at || new Date().toISOString()
          },
          target_audience: {
            primary: sd.target_audience_primary || [],
            seasonal: sd.target_audience_seasonal || [],
            reasoning: sd.audience_reasoning || [],
            confidence: sd.audience_confidence || 'low'
          },
          communication_goal: {
            goal: (sd.communication_goal || 'drive_visits') as CommunicationGoalType,
            reasoning: sd.goal_reasoning || [],
            confidence: sd.goal_confidence || 'low'
          },
          locale: sd.locale || 'da-DK',
          version: sd.strategy_version || '1.0.0',
          generated_at: sd.generated_at || new Date().toISOString(),
          approved_by_user: sd.approved_by_user || false
        };
        setStrategy(loadedStrategy);
      } else {
        setStrategy(newStrategy);
      }

    } catch (err) {
      console.error('Error generating strategy:', err);
      setError('Der opstod en fejl ved generering af brandprofil');
    } finally {
      setIsGenerating(false);
    }
  };

  // Approve and save strategy
  const handleApprove = async () => {
    if (!strategy) return;

    try {
      const approvedStrategy = {
        ...strategy,
        approved_by_user: true
      };

      const success = await saveBrandStrategy(approvedStrategy);

      if (success) {
        setStrategy(approvedStrategy);
        // Optionally navigate somewhere or show success message
      } else {
        setError('Kunne ikke gemme brandprofil');
      }

    } catch (err) {
      console.error('Error approving strategy:', err);
      setError('Der opstod en fejl ved godkendelse');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12" aria-live="polite">
          <AnalyzeIcon className="w-12 h-12 text-blue-600 animate-spin motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Brandprofil
        </h1>
        <p className="text-gray-600">
          Din brandprofil hjælper os med at lave de rigtige indlæg til din virksomhed
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ── Fotos & atmosfære ─────────────────────────────────────────── */}
      <div className="mb-6 bg-white rounded-lg border-2 border-teal-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Fotos & atmosfære</h3>
              <p className="text-xs text-gray-500 mt-0.5">AI analyserer dine fotos og bruger atmosfærebeskrivelsen i tekster om stemning, behind-the-scenes og brand</p>
            </div>
          </div>
          <button
            onClick={() => setEditingAtmosphere(v => !v)}
            className="px-3 py-1.5 text-xs font-medium text-teal-700 hover:text-white hover:bg-teal-600 border border-teal-300 rounded-md transition-colors shrink-0"
          >
            {editingAtmosphere ? 'Luk' : 'Rediger'}
          </button>
        </div>

        {/* Atmosphere status */}
        {(checkingStorage || analyzingPhotos) ? (
          <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mb-4">
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {checkingStorage ? 'Tjekker for fotos…' : 'Analyserer fotos med AI…'}
          </div>
        ) : (atmosphereText || recognizableInteriorIdentity) ? (
          <p className="text-xs text-gray-700 bg-teal-50 rounded-lg px-3 py-2 leading-relaxed mb-4">
            {atmosphereText || recognizableInteriorIdentity}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic mb-4">
            Ikke udfyldt — upload 2–3 fotos nedenfor. AI genererer en atmosfærebeskrivelse der bruges til at skrive mere præcise og levende tekster om dit sted.
          </p>
        )}

        {/* Photo uploader — always visible */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <p className="text-xs text-teal-700 mb-3">
            Upload 2–3 fotos af dit indre og ydre. AI analyserer dem og genererer en atmosfærebeskrivelse der bruges i dine tekster.
          </p>
          <PhotoUploader
            businessId={businessId ?? ''}
            onUploadComplete={setInteriorPhotoPaths}
          />
          {interiorPhotoPaths.length > 0 && (
            <button
              onClick={async () => { if (businessId) await analyzePhotos(businessId, interiorPhotoPaths) }}
              disabled={analyzingPhotos || !businessId}
              className="mt-3 w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {analyzingPhotos ? '⏳ Analyserer fotos…' : `✨ Analyser ${interiorPhotoPaths.length} foto${interiorPhotoPaths.length !== 1 ? 's' : ''}`}
            </button>
          )}
          {photoError && <p className="mt-2 text-xs text-red-600">{photoError}</p>}
          {recognizableInteriorIdentity && <p className="mt-2 text-xs text-teal-700">✓ Atmosfærebeskrivelse udfyldt fra fotos</p>}
        </div>

        {/* Manual editor */}
        {editingAtmosphere && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Eller skriv en atmosfærebeskrivelse manuelt:</p>
              <textarea
                value={atmosphereText}
                onChange={(e) => setAtmosphereText(e.target.value)}
                placeholder="Fx: 'Udendørs terrasse direkte ved åen', 'Åbent køkken', 'Ingen hvid-dug service — åben og uformel borddækning'…"
                className="w-full h-32 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
              />
            </div>
            <button
              onClick={async () => {
                if (!businessId) return;
                setIsSavingAtmosphere(true);
                await supabase.from('business_brand_profile').upsert({ business_id: businessId, recognizable_interior_identity: atmosphereText }, { onConflict: 'business_id' });
                setIsSavingAtmosphere(false);
                setEditingAtmosphere(false);
              }}
              disabled={isSavingAtmosphere}
              className="w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSavingAtmosphere ? 'Gemmer…' : 'Gem beskrivelse'}
            </button>
          </div>
        )}
      </div>

      {/* No strategy yet - show generate button */}
      {!strategy && !isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Klar til at lave din brandprofil?
            </h2>
            <p className="text-gray-600 mb-6">
              Vi analyserer dit menukort, åbningstider og lokation for at finde den perfekte strategi til din virksomhed.
            </p>
            <button
              onClick={handleGenerate}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Generer brandprofil
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Det tager normalt 5-10 sekunder
            </p>
          </div>
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center" aria-live="polite">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center mb-4">
              <AnalyzeIcon className="w-12 h-12 text-blue-600 animate-spin motion-reduce:animate-none" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Analyserer din virksomhed...
            </h2>
            <p className="text-gray-600">
              Vi kigger på dit menukort, åbningstider og lokation for at finde de rigtige målgrupper og strategi
            </p>
          </div>
        </div>
      )}

      {/* Show generated strategy */}
      {strategy && !isGenerating && (
        <BrandStrategyDisplay
          strategy={strategy}
          onApprove={handleApprove}
          onRegenerate={handleGenerate}
        />
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => navigate('/dashboard/location')}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Tilbage til Lokation
        </button>
        {strategy?.approved_by_user && (
          <button
            onClick={() => navigate('/dashboard/menu')}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Videre til Menu →
          </button>
        )}
      </div>
    </div>
  );
}
