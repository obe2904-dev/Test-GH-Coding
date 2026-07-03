import type { TFunction } from 'i18next'
import type { BusinessSector } from '../../../../types/businessSector'
import { AnalyzeIcon } from '../../BusinessProfileIcons'
import type { Tier } from '../../../../stores/tierStore'

interface BusinessDetailsPanelProps {
  t?: TFunction
  isAnalyzing: boolean
  analysisComplete: boolean
  businessName: string
  onBusinessNameChange: (value: string) => void
  businessSector: BusinessSector | null
  onBusinessSectorChange: (value: BusinessSector | null) => void
  businessCategory: string
  onBusinessCategoryChange: (value: string) => void
  address: string
  onAddressChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
  postalCode: string
  onPostalCodeChange: (value: string) => void
  city: string
  onCityChange: (value: string) => void
  country: string
  postalLookupError: string | null
  isFetchingCity: boolean
  isDanishCountry: boolean
  currentTier: Tier
}

export function BusinessDetailsPanel({
  t: _t,
  isAnalyzing,
  analysisComplete: _analysisComplete,
  businessName,
  onBusinessNameChange,
  businessSector,
  onBusinessSectorChange,
  businessCategory,
  onBusinessCategoryChange,
  address,
  onAddressChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  postalCode,
  onPostalCodeChange,
  city,
  onCityChange,
  country,
  postalLookupError,
  isFetchingCity,
  isDanishCountry,
  currentTier
}: BusinessDetailsPanelProps) {
  // t parameter kept for future i18n support
  if (isAnalyzing) {
    return (
      <div className="text-center py-12" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-info-surface rounded-full mb-4">
          <AnalyzeIcon className="w-8 h-8 text-cta animate-spin motion-reduce:animate-none" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">Analyserer din hjemmeside...</h3>
        <p className="text-sm text-text-secondary">Vi henter information om din forretning. Dette tager kun et øjeblik.</p>
      </div>
    )
  }

  const isPaid = currentTier !== 'free'

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay during AI analysis */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-info-surface rounded-full mb-4">
              <div className="w-8 h-8 border-4 border-cta border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-base font-semibold text-text mb-1">
              Analyserer din hjemmeside
            </h3>
            <p className="text-xs text-text-secondary">
              Henter information om din forretning...
            </p>
          </div>
        </div>
      )}

      {/* Two Column Layout: Om forretningen & Placering og kontakt */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column: Om forretningen */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text border-b border-border pb-2">
            Om forretningen
          </h3>

          <div className="space-y-2">
            {/* Forretningsnavn - Full width */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Forretningsnavn</label>
              <input
                type="text"
                value={businessName}
                onChange={(event) => onBusinessNameChange(event.target.value)}
                placeholder="Din virksomheds navn"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
              />
            </div>

            {/* Type forretning & Kategori - 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Type forretning
                </label>
                <select
                  value={businessSector || ''}
                  onChange={(event) => {
                    const value = event.target.value as BusinessSector | ''
                    onBusinessSectorChange(value || null)
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                >
                  <option value="">Vælg type...</option>
                  <option value="hospitality">Restauration &amp; madsteder</option>
                  <option value="beauty">Skønhed &amp; velvære</option>
                  <option value="wellness">Sundhed &amp; wellness</option>
                  <option value="retail">Butik / detailhandel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Kategori
                </label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(event) => onBusinessCategoryChange(event.target.value)}
                  placeholder="fx café, restaurant, frisør"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Placering og kontakt */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text border-b border-border pb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Placering og kontakt
          </h3>

          <div className="space-y-2">
            {/* Adresse - Full width */}
            {isPaid && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Adresse</label>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => onAddressChange(event.target.value)}
                  placeholder="fx Nørrebrogade 52"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                />
              </div>
            )}

            {/* Postnummer, By, Land - 3 columns */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Postnummer</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(event) => onPostalCodeChange(event.target.value)}
                  placeholder="fx 2200"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">By</label>
                <div className="relative">
                  <input
                    type="text"
                    value={city}
                    onChange={(event) => onCityChange(event.target.value)}
                    placeholder="fx København N"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                    disabled={isFetchingCity && isDanishCountry}
                  />
                  {isFetchingCity && isDanishCountry && (
                    <div className="absolute right-3 top-2.5">
                      <AnalyzeIcon className="w-4 h-4 text-text-muted animate-spin motion-reduce:animate-none" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Land</label>
                <input
                  type="text"
                  value={country}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-alt text-text-secondary"
                />
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              Byen udfyldes automatisk når du indtaster et gyldigt postnummer.
            </p>

            {/* Telefon & Email - 2 columns */}
            {isPaid && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => onPhoneChange(event.target.value)}
                    placeholder="fx +45 12 34 56 78"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="fx kontakt@dinvirksomhed.dk"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
                  />
                </div>
              </div>
            )}

            {postalLookupError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {postalLookupError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
