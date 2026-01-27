

interface SeatingCapacityFormProps {
  indoorCapacity: number | null;
  outdoorCapacity: number | null;
  onChange: (indoor: number | null, outdoor: number | null) => void;
}

export function SeatingCapacityForm({ 
  indoorCapacity, 
  outdoorCapacity, 
  onChange 
}: SeatingCapacityFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Siddepladser</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Indoor capacity */}
        <div>
          <label htmlFor="indoor-capacity" className="block text-sm font-medium text-gray-700 mb-2">
            Indendørs pladser
          </label>
          <input
            id="indoor-capacity"
            type="number"
            min="0"
            value={indoorCapacity || ''}
            onChange={(e) => onChange(
              e.target.value ? parseInt(e.target.value) : null,
              outdoorCapacity
            )}
            placeholder="f.eks. 45"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Outdoor capacity */}
        <div>
          <label htmlFor="outdoor-capacity" className="block text-sm font-medium text-gray-700 mb-2">
            Udendørs pladser
          </label>
          <input
            id="outdoor-capacity"
            type="number"
            min="0"
            value={outdoorCapacity || ''}
            onChange={(e) => onChange(
              indoorCapacity,
              e.target.value ? parseInt(e.target.value) : null
            )}
            placeholder="f.eks. 20"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Lad stå tom hvis ingen udendørs pladser</p>
        </div>
      </div>

      {/* Total display */}
      {(indoorCapacity || outdoorCapacity) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Total kapacitet:</strong> {(indoorCapacity || 0) + (outdoorCapacity || 0)} pladser
          </p>
        </div>
      )}
    </div>
  );
}
