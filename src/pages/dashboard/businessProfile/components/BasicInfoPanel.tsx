import type { TFunction } from 'i18next'
import type { BusinessSector } from '../../../../types/businessSector'

interface BasicInfoPanelProps {
  t: TFunction
  businessName: string
  onBusinessNameChange: (value: string) => void
  businessSector: BusinessSector | null
  onBusinessSectorChange: (value: BusinessSector | null) => void
  businessCategory: string
  onBusinessCategoryChange: (value: string) => void
  aboutText: string
  onAboutTextChange: (value: string) => void
}

const BUSINESS_SECTORS: { value: BusinessSector; label: string }[] = [
  { value: 'hospitality', label: 'Restauration & madsteder' },
  { value: 'beauty', label: 'Skønhed & velvære' },
  { value: 'wellness', label: 'Sundhed & wellness' },
  { value: 'retail', label: 'Butik / detailhandel' }
]

export function BasicInfoPanel({
  t,
  businessName,
  onBusinessNameChange,
  businessSector,
  onBusinessSectorChange,
  businessCategory,
  onBusinessCategoryChange,
  aboutText,
  onAboutTextChange
}: BasicInfoPanelProps) {
  return (
    <div className="space-y-4">
      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.businessName')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => onBusinessNameChange(e.target.value)}
          placeholder="fx Min Restaurant"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Business Sector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.businessSector')}
        </label>
        <select
          value={businessSector || ''}
          onChange={(e) => onBusinessSectorChange(e.target.value as BusinessSector || null)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        >
          <option value="">Vælg branche...</option>
          {BUSINESS_SECTORS.map((sector) => (
            <option key={sector.value} value={sector.value}>
              {sector.label}
            </option>
          ))}
        </select>
      </div>

      {/* Business Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.businessCategory')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="text"
          value={businessCategory}
          onChange={(e) => onBusinessCategoryChange(e.target.value)}
          placeholder="fx Italiensk restaurant, Frisør, Yoga studio"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Præciser din virksomhedstype for mere målrettede opslag
        </p>
      </div>

      {/* About Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.shortDescription')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <textarea
          value={aboutText}
          onChange={(e) => onAboutTextChange(e.target.value)}
          placeholder="En kort beskrivelse af din virksomhed..."
          rows={4}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          Dette bruges til at skrive bedre og mere relevante opslag
        </p>
      </div>
    </div>
  )
}
