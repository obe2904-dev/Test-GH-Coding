import type { TFunction } from 'i18next'
import type { BusinessOfferingsProfile } from '../../../../types/businessOfferings'
import type { BusinessSector } from '../../../../types/businessSector'
import type { WeekSchedule } from '../../../../types/businessProfile'

interface BusinessDetailsPanelProps {
  t: TFunction
  isAnalyzing: boolean
  analysisComplete: boolean
  businessName: string
  onBusinessNameChange: (value: string) => void
  businessSector: BusinessSector | null
  onBusinessSectorChange: (value: BusinessSector | null) => void
  businessCategory: string
  onBusinessCategoryChange: (value: string) => void
  aboutText: string
  onAboutTextChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
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
  openingHours: WeekSchedule
  onOpeningHoursChange: (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => void
  keywords: string[]
  onRemoveKeyword: (index: number) => void
  onAddKeyword: () => void
  onKeywordInputChange: (value: string) => void
  newKeyword: string
  businessOfferings: BusinessOfferingsProfile
  onAddCategory: () => void
  onRemoveCategory: (categoryId: string) => void
  onUpdateCategoryName: (categoryId: string, name: string) => void
  onAddItem: (categoryId: string) => void
  onRemoveItem: (categoryId: string, itemId: string) => void
  onUpdateItemName: (categoryId: string, itemId: string, name: string) => void
  getItemPlaceholder: () => string
  hasBookingButton: boolean
  hasUnsavedChanges: boolean
  onDeleteAll: () => void
  onRevertChanges: () => void
  onSaveProfile: () => void
}

export function BusinessDetailsPanel({
  t,
  isAnalyzing,
  analysisComplete,
  businessName,
  onBusinessNameChange,
  businessSector,
  onBusinessSectorChange,
  businessCategory,
  onBusinessCategoryChange,
  aboutText,
  onAboutTextChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  address,
  onAddressChange,
  postalCode,
  onPostalCodeChange,
  city,
  onCityChange,
  country,
  postalLookupError,
  isFetchingCity,
  isDanishCountry,
  openingHours,
  onOpeningHoursChange,
  keywords,
  onRemoveKeyword,
  onAddKeyword,
  onKeywordInputChange,
  newKeyword,
  businessOfferings,
  onAddCategory,
  onRemoveCategory,
  onUpdateCategoryName,
  onAddItem,
  onRemoveItem,
  onUpdateItemName,
  getItemPlaceholder,
  hasBookingButton,
  hasUnsavedChanges,
  onDeleteAll,
  onRevertChanges,
  onSaveProfile
}: BusinessDetailsPanelProps) {
  if (isAnalyzing) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
          <svg className="animate-spin w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Analyserer din hjemmeside...
        </h3>
        <p className="text-sm text-gray-600">
          Vi henter information om din forretning. Dette tager kun et øjeblik.
        </p>
      </div>
    )
  }

  if (!analysisComplete) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Indtast din hjemmeside ovenfor
        </h3>
        <p className="text-xs text-gray-600">
          Vi analyserer din hjemmeside og henter automatisk information om din forretning.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Forretningsprofil · <span className="text-sm text-green-600 font-medium">Free Plan</span>
        </h3>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Tjek og udfyld dine oplysninger</p>
          <p className="text-xs text-gray-600">Jo mere jeg ved, jo bedre kan jeg hjælpe dig med at skrive gode opslag.</p>
          <p className="text-xs text-gray-500">Du kan altid ændre det senere.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Generel Information
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Navn på forretningen</label>
            <input
              type="text"
              value={businessName}
              onChange={(event) => onBusinessNameChange(event.target.value)}
              placeholder="Din virksomheds navn"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Overordnet type forretning
            </label>
            <select
              value={businessSector || ''}
              onChange={(event) => {
                const value = event.target.value as BusinessSector | ''
                onBusinessSectorChange(value || null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            >
              <option value="">Vælg type...</option>
              <option value="hospitality">Restauration &amp; madsteder</option>
              <option value="beauty">Skønhed &amp; velvære</option>
              <option value="wellness">Sundhed &amp; wellness</option>
              <option value="retail">Butik / detailhandel</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Det hjælper mig med at foreslå opslag, der passer til din type forretning.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Branche / kategori (mere præcis)
            </label>
            <input
              type="text"
              value={businessCategory}
              onChange={(event) => onBusinessCategoryChange(event.target.value)}
              placeholder="fx café, restaurant, bar, frisør, tøjbutik"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Skriv det, du selv kalder din forretning i hverdagen (fx "café", "herrefrisør", "tøjbutik").
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Kort "Om os"-tekst</label>
          <textarea
            value={aboutText}
            onChange={(event) => onAboutTextChange(event.target.value)}
            rows={2}
            placeholder="1–2 linjer om din forretning"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            maxLength={150}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <span>💡</span>
              <span>Det behøver ikke være langt.</span>
            </p>
            <p className="text-xs text-gray-500">{aboutText.length}/150</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Kontaktinformation
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="Dit telefonnummer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="Din email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Placering
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse (gade og nr.)</label>
            <input
              type="text"
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              placeholder="fx Nørrebrogade 42"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Postnummer</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={postalCode}
                onChange={(event) => onPostalCodeChange(event.target.value)}
                placeholder="fx 2200"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7] ${
                  postalLookupError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">By</label>
              <input
                type="text"
                value={city}
                readOnly={isDanishCountry && !postalLookupError}
                onChange={(event) => onCityChange(event.target.value)}
                placeholder={isFetchingCity ? 'Henter by...' : 'fx København N'}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7] ${
                  isDanishCountry && !postalLookupError
                    ? 'bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200'
                    : 'border-gray-300'
                }`}
              />
              <p className={`text-[11px] mt-1 ${postalLookupError ? 'text-red-600' : 'text-gray-500'}`}>
                {postalLookupError
                  ? postalLookupError
                  : isFetchingCity
                    ? t('onboarding.postalLookupLoading', 'Looking up postal code...')
                    : city
                      ? t('onboarding.postalLookupSuccess', 'Town found automatically from the postal code.')
                      : t('onboarding.cityAutoHelper', 'The town fills automatically once you enter a valid postal code.')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Land</label>
              <input
                type="text"
                value={country}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Åbningstider
        </h4>
        <p className="text-xs text-gray-500">Brug ur-ikonerne for at vælge tider</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {([
            { key: 'man' as const, label: 'Man' },
            { key: 'fre' as const, label: 'Fre' },
            { key: 'tir' as const, label: 'Tir' },
            { key: 'lør' as const, label: 'Lør' },
            { key: 'ons' as const, label: 'Ons' },
            { key: 'søn' as const, label: 'Søn' },
            { key: 'tor' as const, label: 'Tor' }
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 font-medium w-12">{label}</span>
              <input
                type="time"
                value={openingHours[key].open}
                onChange={(event) => onOpeningHoursChange(key, 'open', event.target.value)}
                className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#88F2D7]"
                placeholder="Åbner"
              />
              <input
                type="time"
                value={openingHours[key].close}
                onChange={(event) => onOpeningHoursChange(key, 'close', event.target.value)}
                className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#88F2D7]"
                placeholder="Lukker"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Nøgleord
        </h4>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(event) => onKeywordInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddKeyword()
              }
            }}
            placeholder="Tilføj nøgleord (fx brunch, kaffe, herreklip)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
          />
          <button
            onClick={onAddKeyword}
            className="px-4 py-2 bg-white border border-[#D1D5DB] text-[#0F2E32] rounded-lg text-xs font-semibold hover:bg-[#F9FAFB] transition-colors"
          >
            Tilføj
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#F4F1FE] border border-[#C7BAF7] text-[#0F2E32] rounded-full text-xs hover:bg-[#EDE8FF] hover:border-[#BFA9F4] transition-colors"
            >
              {keyword}
              <button
                onClick={() => onRemoveKeyword(index)}
                className="hover:bg-[#BFA9F4] hover:bg-opacity-30 rounded-full p-0.5 transition-colors"
              >
                <svg className="w-3 h-3 text-[#0F2E32]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Det du tilbyder
          </label>
          <p className="text-xs text-gray-600 mb-2">
            Gruppér dine produkter eller services i kategorier. Dette hjælper AI'en med at foreslå relevant indhold.
          </p>
        </div>

        <div className="space-y-3">
          {businessOfferings.categories.map((category) => (
            <div key={category.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={category.name}
                  onChange={(event) => onUpdateCategoryName(category.id, event.target.value)}
                  placeholder="Kategori-navn (fx Drikkevarer, Behandlinger)"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#88F2D7] focus:border-[#88F2D7]"
                />
                <button
                  onClick={() => onRemoveCategory(category.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Fjern kategori"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-1 pl-2">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">•</span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) => onUpdateItemName(category.id, item.id, event.target.value)}
                      placeholder={getItemPlaceholder()}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm bg-white focus:ring-2 focus:ring-[#88F2D7] focus:border-[#88F2D7]"
                    />
                    <button
                      onClick={() => onRemoveItem(category.id, item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Fjern produkt"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onAddItem(category.id)}
                  className="text-xs text-[#0F2E32] hover:text-[#88F2D7] font-medium transition-colors"
                >
                  + Tilføj produkt/service
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={onAddCategory}
            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:border-[#88F2D7] hover:text-[#0F2E32] transition-colors"
          >
            + Tilføj kategori
          </button>
        </div>
      </div>

      {hasBookingButton && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-blue-900">Booking-knap fundet på hjemmeside</span>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onDeleteAll}
          className="px-6 py-2 bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] rounded-lg text-sm font-semibold hover:bg-[#FEE2E2] transition-colors"
        >
          Slet Alt
        </button>
        <button
          onClick={onRevertChanges}
          disabled={!hasUnsavedChanges}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
            hasUnsavedChanges
              ? 'bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]'
              : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Fortryd Ændringer
        </button>
        <button
          onClick={onSaveProfile}
          disabled={!hasUnsavedChanges}
          className={`flex-1 px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
            hasUnsavedChanges
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {hasUnsavedChanges ? 'Gem forretningsprofil' : 'Gemt'}
        </button>
      </div>
    </div>
  )
}
