import type { TFunction } from 'i18next'

interface AddressPanelProps {
  t: TFunction
  address: string
  onAddressChange: (value: string) => void
  postalCode: string
  onPostalCodeChange: (value: string) => void
  city: string
  onCityChange: (value: string) => void
  country: string
  postalLookupError: string | null
  isFetchingCity: boolean
  isDanishCountry: boolean
}

export function AddressPanel({
  t,
  address,
  onAddressChange,
  postalCode,
  onPostalCodeChange,
  city,
  onCityChange,
  country,
  postalLookupError,
  isFetchingCity,
  isDanishCountry
}: AddressPanelProps) {
  return (
    <div className="space-y-4">
      {/* Street Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('businessProfile.address')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="fx Hovedgaden 123"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm"
        />
      </div>

      {/* Postal Code and City - Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Postal Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('businessProfile.postalCode')} <span className="text-gray-500 font-normal">(valgfri)</span>
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            placeholder={isDanishCountry ? '1234' : 'Postnr.'}
            maxLength={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm"
          />
          {postalLookupError && (
            <p className="text-xs text-red-600 mt-1">{postalLookupError}</p>
          )}
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('businessProfile.city')} <span className="text-gray-500 font-normal">(valgfri)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="København"
              disabled={isDanishCountry && isFetchingCity}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
            {isFetchingCity && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            )}
          </div>
          {isDanishCountry && (
            <p className="text-xs text-gray-500 mt-1">
              Findes automatisk baseret på postnummer
            </p>
          )}
        </div>
      </div>

      {/* Country - Read-only display */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
         {t('businessProfile.country')}
        </label>
        <div className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600">
         {country || t('ui.country.default_name')}
        </div>
      </div>
    </div>
  )
}
