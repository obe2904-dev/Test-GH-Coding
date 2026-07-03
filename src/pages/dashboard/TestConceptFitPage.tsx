// ⚠️ The `business_concept_fit` table was DROPPED April 2026 (migration 20260420000007).
// Concept fit data is now part of `business_location_intelligence.concept_fit_by_category`.
// This test page has been disabled.


export default function TestConceptFitPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Concept Fit</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800 font-medium mb-2">This page has been disabled.</p>
          <p className="text-yellow-700 text-sm">
            The <code>business_concept_fit</code> table was dropped in April 2026 (migration 20260420000007).
            Concept fit data now lives in <code>business_location_intelligence.concept_fit_by_category</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// Legacy code removed — table dropped April 2026.

