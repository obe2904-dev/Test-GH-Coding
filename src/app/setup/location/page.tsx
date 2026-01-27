'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeLocation, generateLocationProfile } from '@/lib/location/analyzer';
import { LocationAnalysis } from '@/types/location';
import LocationAnalysisDisplay from '@/components/setup/LocationAnalysis';

export default function LocationPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LocationAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAnalyze = async () => {
    if (!address.trim()) {
      setError('Indtast venligst en adresse');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeLocation(address);
      setAnalysis(result);
      
      // Auto-save after analysis completes
      await saveLocationProfile(result);
    } catch (err) {
      setError('Kunne ikke analysere adressen. Prøv venligst igen.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveLocationProfile = async (analysisData: LocationAnalysis) => {
    setIsSaving(true);
    try {
      const locationProfile = generateLocationProfile(analysisData);

      const response = await fetch('/api/business/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationProfile })
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }
      
      console.log('✅ Location profile auto-saved');
    } catch (err) {
      console.error('Save error:', err);
      setError('Kunne ikke gemme automatisk. Data er stadig tilgængelig.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!analysis) return;
    
    // Remove the category from matches
    const updatedAnalysis = {
      ...analysis,
      matches: analysis.matches.filter(m => m.categoryId !== categoryId)
    };
    
    setAnalysis(updatedAnalysis);
    
    // Re-save with updated categories
    saveLocationProfile(updatedAnalysis);
  };

  const handleContinue = () => {
    router.push('/setup/next-step');
  };

  const handleSaveAndContinue = async () => {
    // Auto-save is already enabled, so just navigate to next step
    router.push('/setup/next-step');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Din lokation</h1>
        <p className="text-gray-600">
          Indtast din virksomheds adresse, så analyserer vi din lokation og tilpasser indholdsstrategien.
        </p>
      </div>

      {/* Address Input */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium mb-2">
          Forretningsadresse
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="F.eks. Nyhavn 17, 1051 København K"
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyserer...' : 'Analyser'}
          </button>
        </div>
        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <>
          <LocationAnalysisDisplay 
            analysis={analysis} 
            onDeleteCategory={handleDeleteCategory}
          />

          {isSaving && (
            <div className="text-center text-sm text-gray-600 mt-4">
              💾 Gemmer automatisk...
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setAnalysis(null)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Analyser igen
            </button>
            <button
              onClick={handleSaveAndContinue}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Fortsæt
            </button>
          </div>
        </>
      )}
    </div>
  );
}
