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
import { BrandStrategy } from '../../lib/brandStrategy/types';
import { generateBrandStrategy, saveBrandStrategy } from '../../lib/brandStrategy/generator';
import { BrandStrategyDisplay } from '../../components/brandStrategy/BrandStrategyDisplay';

export default function BrandProfilePageNew() {
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        // Check for existing strategy
        const { data: existingStrategy } = await supabase
          .from('business_brand_profile')
          .select('*')
          .eq('business_id', bizId)
          .maybeSingle();

        console.log('Existing strategy from DB:', existingStrategy);

        // @ts-ignore - New columns exist but types not yet regenerated after migration
        if (existingStrategy && existingStrategy.core_offerings) {
          // Transform from database format to BrandStrategy type
          // Ensure arrays are actually arrays
          const coreOfferings = Array.isArray(existingStrategy.core_offerings) 
            ? existingStrategy.core_offerings 
            : [];
          const offeringsReasoning = Array.isArray(existingStrategy.offerings_reasoning)
            ? existingStrategy.offerings_reasoning
            : [];
          const primaryAudience = Array.isArray(existingStrategy.target_audience_primary)
            ? existingStrategy.target_audience_primary
            : [];
          const audienceReasoning = Array.isArray(existingStrategy.audience_reasoning)
            ? existingStrategy.audience_reasoning
            : [];
          const goalReasoning = Array.isArray(existingStrategy.goal_reasoning)
            ? existingStrategy.goal_reasoning
            : [];

          const loadedStrategy: BrandStrategy = {
            business_id: bizId,
            core_offerings: {
              // @ts-ignore
              offerings: coreOfferings,
              // @ts-ignore
              weights: existingStrategy.offerings_weights || {},
              // @ts-ignore
              reasoning: offeringsReasoning,
              // @ts-ignore
              confidence: existingStrategy.offerings_confidence || 'low',
              // @ts-ignore
              generated_at: existingStrategy.generated_at || new Date().toISOString()
            },
            target_audience: {
              // @ts-ignore
              primary: primaryAudience,
              // @ts-ignore
              seasonal: existingStrategy.target_audience_seasonal || [],
              // @ts-ignore
              reasoning: audienceReasoning,
              // @ts-ignore
              confidence: existingStrategy.audience_confidence || 'low'
            },
            communication_goal: {
              // @ts-ignore
              goal: existingStrategy.communication_goal || 'drive_visits',
              // @ts-ignore
              reasoning: goalReasoning,
              // @ts-ignore
              confidence: existingStrategy.goal_confidence || 'low'
            },
            // @ts-ignore
            locale: existingStrategy.locale || 'da-DK',
            // @ts-ignore
            version: existingStrategy.strategy_version || '1.0.0',
            // @ts-ignore
            generated_at: existingStrategy.generated_at || new Date().toISOString(),
            // @ts-ignore
            approved_by_user: existingStrategy.approved_by_user || false
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

      if (existingStrategy && Array.isArray(existingStrategy.core_offerings)) {
        // Use correct fields from schema
        const loadedStrategy: BrandStrategy = {
          business_id: businessId,
          core_offerings: {
            offerings: existingStrategy.core_offerings || [],
            weights: existingStrategy.offerings_weights || {},
            reasoning: existingStrategy.offerings_reasoning || [],
            confidence: existingStrategy.offerings_confidence || 'low',
            generated_at: existingStrategy.generated_at || new Date().toISOString()
          },
          target_audience: {
            primary: existingStrategy.target_audience_primary || [],
            seasonal: existingStrategy.target_audience_seasonal || [],
            reasoning: existingStrategy.audience_reasoning || [],
            confidence: existingStrategy.audience_confidence || 'low'
          },
          communication_goal: {
            goal: existingStrategy.communication_goal || 'drive_visits',
            reasoning: existingStrategy.goal_reasoning || [],
            confidence: existingStrategy.goal_confidence || 'low'
          },
          locale: existingStrategy.locale || 'da-DK',
          version: existingStrategy.strategy_version || '1.0.0',
          generated_at: existingStrategy.generated_at || new Date().toISOString(),
          approved_by_user: existingStrategy.approved_by_user || false
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
