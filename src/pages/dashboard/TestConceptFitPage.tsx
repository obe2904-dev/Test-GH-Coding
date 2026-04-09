import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Business {
  id: string;
  name: string;
  area_type?: string;
  category_scores?: any;
}

interface ConceptFitResult {
  overall_fit_level: string;
  overall_fit_score: number;
  customer_fit: string;
  motivation_fit: string;
  pace_fit: string;
  price_fit: string;
  winning_angles_fit: string;
  strategy_approach: string;
  strategy_positioning: string;
  emphasis: string[];
  avoid: string[];
  cta_style: string;
  detected_motivations: Array<{
    motivation: string;
    confidence: number;
    evidence: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  analyzed_for_location_type: string;
  analyzed_at: string;
}

export default function TestConceptFitPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ConceptFitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          business_location_intelligence (
            area_type,
            category_scores
          )
        `)
        .not('business_location_intelligence.area_type', 'is', null)
        .limit(20);

      if (error) throw error;

      const formatted = data?.map((b: any) => ({
        id: b.id,
        name: b.name,
        area_type: b.business_location_intelligence?.[0]?.area_type,
        category_scores: b.business_location_intelligence?.[0]?.category_scores,
      })) || [];

      setBusinesses(formatted);
    } catch (err: any) {
      console.error('Error loading businesses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeConceptFit() {
    if (!selectedBusiness) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      // Call the edge function
      console.log('[Concept Fit] Calling edge function for business:', selectedBusiness);
      
      const { data, error } = await supabase.functions.invoke('analyze-concept-fit', {
        body: { business_id: selectedBusiness },
      });

      console.log('[Concept Fit] Edge function response:', { data, error });

      if (error) {
        console.error('[Concept Fit] Edge function error:', error);
        throw new Error(`Edge function failed: ${error.message}`);
      }

      // Wait a moment for the database write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch the saved result from database
      console.log('[Concept Fit] Fetching saved result from database...');
      
      const { data: fitData, error: fitError } = await (supabase as any)
        .from('business_concept_fit')
        .select('*')
        .eq('business_id', selectedBusiness)
        .single();

      console.log('[Concept Fit] Database query result:', { fitData, fitError });

      if (fitError) {
        if (fitError.code === 'PGRST116') {
          throw new Error('Analysis completed but no result found. Check edge function logs.');
        }
        throw fitError;
      }

      setResult(fitData as any);
      console.log('[Concept Fit] ✅ Analysis complete!');
    } catch (err: any) {
      console.error('[Concept Fit] ❌ Error:', err);
      setError(err.message || 'Failed to analyze concept fit');
    } finally {
      setAnalyzing(false);
    }
  }

  async function loadExistingResult() {
    if (!selectedBusiness) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await (supabase as any)
        .from('business_concept_fit')
        .select('*')
        .eq('business_id', selectedBusiness)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError('No existing analysis found for this business');
        } else {
          throw error;
        }
      } else {
        setResult(data as any);
      }
    } catch (err: any) {
      console.error('Error loading result:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedBusinessData = businesses.find(b => b.id === selectedBusiness);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎯 Test Concept Fit Analysis</h1>
        <p className="text-gray-600 mb-8">
          Test the AI-powered concept fit analysis system that evaluates how well a business matches its location type.
        </p>

        {/* Business Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Business</h2>
          
          {loading && <p className="text-gray-500">Loading businesses...</p>}
          
          {!loading && businesses.length === 0 && (
            <p className="text-gray-500">No businesses with location intelligence found</p>
          )}

          {!loading && businesses.length > 0 && (
            <div className="space-y-4">
              <select
                value={selectedBusiness}
                onChange={(e) => {
                  setSelectedBusiness(e.target.value);
                  setResult(null);
                  setError(null);
                }}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">-- Select a business --</option>
                {businesses.map(business => (
                  <option key={business.id} value={business.id}>
                    {business.name} ({business.area_type})
                  </option>
                ))}
              </select>

              {selectedBusinessData && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Current Location Type:</p>
                  <p className="text-lg font-semibold text-blue-700">{selectedBusinessData.area_type}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={analyzeConceptFit}
                  disabled={!selectedBusiness || analyzing}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {analyzing ? '🤖 Analyzing with AI...' : '🚀 Run New Analysis'}
                </button>
                
                <button
                  onClick={loadExistingResult}
                  disabled={!selectedBusiness || loading}
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : '📊 Load Existing Result'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">❌ Error</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6">
            {/* Overall Fit */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Overall Concept Fit</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Fit Level</p>
                  <p className={`text-2xl font-bold ${
                    result.overall_fit_level === 'strong' ? 'text-green-600' :
                    result.overall_fit_level === 'moderate' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {result.overall_fit_level.toUpperCase()}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Fit Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(result.overall_fit_score * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Strategy</p>
                  <p className="text-lg font-bold text-purple-600">
                    {result.strategy_approach.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Factor Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Factor-by-Factor Analysis</h2>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Customer', value: result.customer_fit },
                  { label: 'Motivation', value: result.motivation_fit },
                  { label: 'Pace', value: result.pace_fit },
                  { label: 'Price', value: result.price_fit },
                  { label: 'Winning Angles', value: result.winning_angles_fit },
                ].map(factor => (
                  <div key={factor.label} className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">{factor.label}</p>
                    <p className={`font-bold ${
                      factor.value === 'good' ? 'text-green-600' :
                      factor.value === 'moderate' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {factor.value?.toUpperCase() || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detected Motivations */}
            {result.detected_motivations && result.detected_motivations.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">🎯 Detected Customer Motivations</h2>
                <div className="space-y-3">
                  {result.detected_motivations.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">{m.motivation}</p>
                        <p className="text-sm text-blue-700">{m.evidence}</p>
                      </div>
                      <div className="ml-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">
                            {(m.confidence * 100).toFixed(0)}%
                          </p>
                          <p className="text-xs text-blue-500">confidence</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Strategy */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📝 Content Strategy</h2>
              
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Positioning Statement</p>
                <p className="text-lg text-gray-900 bg-purple-50 p-3 rounded-lg">
                  {result.strategy_positioning || 'N/A'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2">✅ EMPHASIS (Do say)</p>
                  <ul className="space-y-2">
                    {result.emphasis?.map((item, idx) => (
                      <li key={idx} className="text-sm bg-green-50 p-2 rounded">
                        {item}
                      </li>
                    )) || <li className="text-gray-500 text-sm">None</li>}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">❌ AVOID (Don't say)</p>
                  <ul className="space-y-2">
                    {result.avoid?.map((item, idx) => (
                      <li key={idx} className="text-sm bg-red-50 p-2 rounded">
                        {item}
                      </li>
                    )) || <li className="text-gray-500 text-sm">None</li>}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">CTA Style</p>
                <p className="text-sm bg-gray-50 p-2 rounded inline-block">
                  {result.cta_style || 'N/A'}
                </p>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">💪 Strengths & Weaknesses</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2">Strengths</p>
                  <ul className="space-y-2">
                    {result.strengths?.map((item, idx) => (
                      <li key={idx} className="text-sm bg-green-50 p-2 rounded flex items-start">
                        <span className="mr-2">✓</span>
                        <span>{item}</span>
                      </li>
                    )) || <li className="text-gray-500 text-sm">None listed</li>}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-orange-700 mb-2">Weaknesses</p>
                  <ul className="space-y-2">
                    {result.weaknesses?.map((item, idx) => (
                      <li key={idx} className="text-sm bg-orange-50 p-2 rounded flex items-start">
                        <span className="mr-2">⚠</span>
                        <span>{item}</span>
                      </li>
                    )) || <li className="text-gray-500 text-sm">None listed</li>}
                  </ul>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p>
                <strong>Analyzed for location type:</strong> {result.analyzed_for_location_type}
              </p>
              <p>
                <strong>Analyzed at:</strong> {new Date(result.analyzed_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
