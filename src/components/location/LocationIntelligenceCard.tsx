import React from 'react';
import { useLocationIntelligence } from '@/hooks/useBusinessKnowledge';
import { useLocationIntelligencePopulator } from '@/hooks/useLocationIntelligencePopulator';

interface LocationIntelligenceCardProps {
  businessId: string;
  businessAddress?: string;
  businessCity?: string;
}

export function LocationIntelligenceCard({ 
  businessId, 
  businessAddress,
  businessCity 
}: LocationIntelligenceCardProps) {
  const { data: location, loading, refetch } = useLocationIntelligence(businessId);
  const { populating, error: populateError, populate } = useLocationIntelligencePopulator();

  const handlePopulate = async () => {
    if (!businessAddress) {
      alert('Tilføj venligst en adresse til din forretning først');
      return;
    }

    const success = await populate(businessId, businessAddress, businessCity);
    if (success) {
      await refetch();
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Henter lokationsdata...</p>
      </div>
    );
  }

  // If no location data yet
  if (!location || !location.latitude) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">📍 Lokationsintelligens</h3>
            <p className="text-sm text-gray-600 mt-1">
              AI-genereret data om din placering
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            Vi kan automatisk hente data om nærliggende landemærker, offentlig transport, 
            og markedsførings-vinkler baseret på din adresse.
          </p>
        </div>

        {populateError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{populateError}</p>
          </div>
        )}

        <button
          onClick={handlePopulate}
          disabled={populating || !businessAddress}
          className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {populating ? 'Henter data...' : '✨ Hent lokationsdata automatisk'}
        </button>

        {!businessAddress && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Tilføj en adresse til din forretning for at fortsætte
          </p>
        )}
      </div>
    );
  }

  // Display populated location data
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📍 Lokationsintelligens</h3>
          <p className="text-xs text-gray-500 mt-1">
            Sidst opdateret: {location.last_updated_by_ai 
              ? new Date(location.last_updated_by_ai).toLocaleDateString('da-DK')
              : 'Aldrig'}
          </p>
        </div>
        <button
          onClick={handlePopulate}
          disabled={populating}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          🔄 Opdater
        </button>
      </div>

      {/* Neighborhood */}
      {location.neighborhood && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700">Kvarter:</span>
          <p className="text-gray-900">{location.neighborhood}</p>
        </div>
      )}

      {/* Area type */}
      {location.area_type && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700">Områdetype:</span>
          <p className="text-gray-900 capitalize">{location.area_type.replace('_', ' ')}</p>
        </div>
      )}

      {/* Landmarks */}
      {location.landmarks_nearby && location.landmarks_nearby.length > 0 && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700">Nærliggende landemærker:</span>
          <ul className="mt-2 space-y-1">
            {location.landmarks_nearby.slice(0, 5).map((landmark: any, index: number) => (
              <li key={index} className="text-sm text-gray-600">
                • {landmark.name} ({landmark.walking_distance_minutes} min)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Marketing hooks */}
      {location.location_marketing_hooks && location.location_marketing_hooks.length > 0 && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700">Marketing hooks:</span>
          <div className="mt-2 space-y-1">
            {location.location_marketing_hooks.map((hook: string, index: number) => (
              <div key={index} className="text-sm bg-green-50 text-green-800 px-3 py-1 rounded">
                {hook}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View/Outdoor space */}
      {location.has_view && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-700">Udsigt:</span>
          <p className="text-gray-900">
            {location.view_type?.join(', ') || 'Ja'}
          </p>
        </div>
      )}
    </div>
  );
}
