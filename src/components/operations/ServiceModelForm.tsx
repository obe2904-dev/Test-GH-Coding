

interface ServiceModelFormProps {
  hasTableService: boolean;
  hasTakeaway: boolean;
  hasDelivery: boolean;
  reservationRequired: boolean;
  onChange: (field: string, value: boolean) => void;
}

export function ServiceModelForm({
  hasTableService,
  hasTakeaway,
  hasDelivery,
  reservationRequired,
  onChange
}: ServiceModelFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Servicemodel</h3>

      <div className="space-y-3">
        {/* Table service */}
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={hasTableService}
            onChange={(e) => onChange('has_table_service', e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Bordbetjening</div>
            <div className="text-sm text-gray-600">Gæster bliver betjent ved bordet</div>
          </div>
        </label>

        {/* Takeaway */}
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={hasTakeaway}
            onChange={(e) => onChange('has_takeaway', e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Takeaway</div>
            <div className="text-sm text-gray-600">Gæster kan afhente mad</div>
          </div>
        </label>

        {/* Delivery */}
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={hasDelivery}
            onChange={(e) => onChange('has_delivery', e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Levering</div>
            <div className="text-sm text-gray-600">Leverer til gæster (Wolt, JustEat, egen)</div>
          </div>
        </label>

        {/* Reservation required */}
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={reservationRequired}
            onChange={(e) => onChange('reservation_required', e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Bordreservation påkrævet</div>
            <div className="text-sm text-gray-600">
              Gæster skal booke bord på forhånd (især til aftensmad)
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
