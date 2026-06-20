import type { TFunction } from 'i18next'
import type { BusinessSector } from '../../../../types/businessSector'
import { AnalyzeIcon } from '../../BusinessProfileIcons'
import { QuarterHourTimePicker } from '../../../../components/ui/QuarterHourTimePicker'

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
  openingHours: Record<string, { open: string; close: string }>
  onOpeningHoursChange: (day: string, field: 'open' | 'close', value: string) => void
  keywords: string[]
  newKeyword: string
  onKeywordInputChange: (value: string) => void
  onAddKeyword: () => void
  onRemoveKeyword: (index: number) => void
  businessOfferings: { categories: Array<{ id: string; name: string; items: Array<{ id: string; name: string }> }> }
  onUpdateCategoryName: (categoryId: string, value: string) => void
  onRemoveCategory: (categoryId: string) => void
  onUpdateItemName: (categoryId: string, itemId: string, value: string) => void
  onAddItem: (categoryId: string) => void
  onRemoveItem: (categoryId: string, itemId: string) => void
  onAddCategory: () => void
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
  newKeyword,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  businessOfferings,
  onUpdateCategoryName,
  onRemoveCategory,
  onUpdateItemName,
  onAddItem,
  onRemoveItem,
  onAddCategory,
  getItemPlaceholder,
  hasBookingButton,
  hasUnsavedChanges,
  onDeleteAll,
  onRevertChanges,
  onSaveProfile
}: BusinessDetailsPanelProps) {
  if (isAnalyzing) {
    return (
      <div className="text-center py-12" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-cta-surface rounded-full mb-4">
          <AnalyzeIcon className="w-8 h-8 text-cta animate-spin motion-reduce:animate-none" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">
          {t('business.analyzing')}
        </h3>
        <p className="text-sm text-text-secondary">{t('business.analysisFetching')}</p>
      </div>
    )
  }

  if (!analysisComplete) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-surface-alt rounded-full mb-3">
          <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text mb-1">{t('business.enterWebsiteAbove')}</h3>
          <p className="text-xs text-text-muted">{t('business.aiAnalysisNote')}</p>
          <p className="text-xs text-text-muted">{t('business.changeLater')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-text flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('navigation.businessProfile')} · <span className="text-sm text-green-600 font-medium">Free Plan</span>
        </h3>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text">{t('business.reviewAndEdit')}</p>
          <p className="text-xs text-text-secondary">{t('business.aiAnalysisNote')}</p>
          <p className="text-xs text-text-muted">{t('business.changeLater')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('business.basicInfo.title')}
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('business.basicInfo.businessName')}</label>
            <input
              type="text"
              value={businessName}
              onChange={(event) => onBusinessNameChange(event.target.value)}
              placeholder={t('business.basicInfo.businessNamePlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('business.basicInfo.businessType')}</label>
            <select
              value={businessSector || ''}
              onChange={(event) => {
                const value = event.target.value as BusinessSector | ''
                onBusinessSectorChange(value || null)
              }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            >
              <option value="">{t('business.basicInfo.selectType')}</option>
              <option value="hospitality">Restauration &amp; madsteder</option>
              <option value="beauty">Skønhed &amp; velvære</option>
              <option value="wellness">Sundhed &amp; wellness</option>
              <option value="retail">Butik / detailhandel</option>
            </select>
            <p className="text-[11px] text-text-muted mt-1">
              {t('business.quickStart.description')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('business.basicInfo.businessType')}</label>
            <input
              type="text"
              value={businessCategory}
              onChange={(event) => onBusinessCategoryChange(event.target.value)}
              placeholder={t('business.basicInfo.categoryPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
            <p className="text-[11px] text-text-muted mt-1">
              {t('business.basicInfo.categoryHint')}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Kort "Om os"-tekst</label>
          <textarea
            value={aboutText}
            onChange={(event) => onAboutTextChange(event.target.value)}
            rows={2}
            placeholder="1–2 linjer om din forretning"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            maxLength={150}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-text-muted flex items-center gap-1">
              <span>💡</span>
              <span>Det behøver ikke være langt.</span>
            </p>
            <p className="text-xs text-text-muted">{aboutText.length}/150</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Kontaktinformation
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="Dit telefonnummer"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="Din email"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Placering
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Adresse (gade og nr.)</label>
            <input
              type="text"
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              placeholder="fx Nørrebrogade 42"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Postnummer</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={postalCode}
                onChange={(event) => onPostalCodeChange(event.target.value)}
                placeholder="fx 2200"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-cta ${
                  postalLookupError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-border'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">By</label>
              <input
                type="text"
                value={city}
                readOnly={isDanishCountry && !postalLookupError}
                onChange={(event) => onCityChange(event.target.value)}
                placeholder={isFetchingCity ? 'Henter by...' : 'fx København N'}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-cta ${
                  isDanishCountry && !postalLookupError
                    ? 'bg-surface-alt text-text-secondary cursor-not-allowed border-border'
                    : 'border-border'
                }`}
              />
              <p className={`text-[11px] mt-1 ${postalLookupError ? 'text-red-600' : 'text-text-muted'}`}>
                {postalLookupError
                  ? postalLookupError
                  : isFetchingCity
                    ? t('onboarding.postalLookupLoading')
                    : city
                      ? t('onboarding.postalLookupSuccess')
                      : t('onboarding.cityAutoHelper')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Land</label>
              <input
                type="text"
                value={country}
                disabled
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-alt text-text-muted cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Åbningstider
        </h4>
        <p className="text-xs text-text-muted">Brug ur-ikonerne for at vælge tider</p>
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
                <span className="text-xs text-text-secondary font-medium w-12">{label}</span>
                <QuarterHourTimePicker className="w-32" value={openingHours[key].open} onChange={(value) => onOpeningHoursChange(key, 'open', value)} />
                <QuarterHourTimePicker className="w-32" value={openingHours[key].close} onChange={(value) => onOpeningHoursChange(key, 'close', value)} />
              </div>
            ))}
            <p className="mt-1 text-[11px] text-text-muted">Tid vælges i 15-minutters intervaller: 00, 15, 30 og 45.</p>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
          <h4 className="text-sm font-semibold text-text flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-cta"
            />
            <button
              onClick={onAddKeyword}
              className="px-4 py-2 bg-white border border-[#D1D5DB] text-brand rounded-lg text-xs font-semibold hover:bg-[#F9FAFB] transition-colors"
            >
              Tilføj
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-accent-surface border border-accent text-brand rounded-full text-xs hover:bg-accent-surface transition-colors"
              >
                {keyword}
                <button
                  onClick={() => onRemoveKeyword(index)}
                  className="hover:bg-accent-surface rounded-full p-0.5 transition-colors"
                >
                  <svg className="w-3 h-3 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
        </div>
      </div>

      <div className="space-y-2">
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Det du tilbyder
            </label>
            <p className="text-xs text-text-secondary mb-2">
              Gruppér dine produkter eller services i kategorier. Dette hjælper AI'en med at foreslå relevant indhold.
            </p>
          </div>

          <div className="space-y-3">
            {businessOfferings.categories.map((category) => (
              <div key={category.id} className="p-3 bg-surface-alt border border-border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={category.name}
                    onChange={(event) => onUpdateCategoryName(category.id, event.target.value)}
                    placeholder="Kategori-navn (fx Drikkevarer, Behandlinger)"
                    className="flex-1 px-2 py-1 border border-border rounded text-sm focus:ring-2 focus:ring-cta focus:border-cta"
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
                      <span className="text-text-muted text-xs">•</span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) => onUpdateItemName(category.id, item.id, event.target.value)}
                        placeholder={getItemPlaceholder()}
                        className="flex-1 px-2 py-1 border border-border rounded text-sm bg-white focus:ring-2 focus:ring-cta focus:border-cta"
                      />
                      <button
                        onClick={() => onRemoveItem(category.id, item.id)}
                        className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
                    className="text-xs text-brand hover:text-mint font-medium transition-colors"
                  >
                    + Tilføj produkt/service
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={onAddCategory}
              className="w-full px-4 py-2 border-2 border-dashed border-border text-text-secondary rounded-lg text-sm font-medium hover:border-mint hover:text-brand transition-colors"
            >
              + Tilføj kategori
            </button>
          </div>
      </div>

      {hasBookingButton && (
        <div className="flex items-center gap-2 p-3 bg-info-surface border border-info rounded-lg">
          <svg className="w-5 h-5 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-info-text">Booking-knap fundet på hjemmeside</span>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onDeleteAll}
          className="px-6 py-2 bg-error-surface border border-error text-error-text rounded-lg text-sm font-semibold hover:bg-error-surface transition-colors"
        >
          Slet Alt
        </button>
        <button
          onClick={onRevertChanges}
          disabled={!hasUnsavedChanges}
          className="text-sm text-text-muted hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Fortryd Ændringer
        </button>
        <button
          onClick={onSaveProfile}
          disabled={!hasUnsavedChanges}
          className={`flex-1 px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
            hasUnsavedChanges
              ? 'bg-cta text-text-inverse hover:bg-cta-hover'
              : 'bg-surface-alt text-text-muted cursor-not-allowed'
          }`}
        >
          {hasUnsavedChanges ? 'Gem forretningsprofil' : 'Gemt'}
        </button>
      </div>
    </div>
  )
}
