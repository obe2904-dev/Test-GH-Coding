import type { TFunction } from 'i18next'

interface LinksPanelProps {
  t: TFunction
  aboutUsUrl: string
  onAboutUsUrlChange: (value: string) => void
  openingHoursUrl: string
  onOpeningHoursUrlChange: (value: string) => void
}

export function LinksPanel({
  t,
  aboutUsUrl,
  onAboutUsUrlChange,
  openingHoursUrl,
  onOpeningHoursUrlChange
}: LinksPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {t('businessProfile.linksHelp')}
      </p>

      {/* About Us URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.aboutUsUrl')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="url"
          value={aboutUsUrl}
          onChange={(e) => onAboutUsUrlChange(e.target.value)}
          placeholder="fx https://www.dinvirksomhed.dk/om-os"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Direkte link til jeres "Om os" eller "Om virksomheden" side
        </p>
      </div>

      {/* Opening Hours URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.openingHoursUrl')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="url"
          value={openingHoursUrl}
          onChange={(e) => onOpeningHoursUrlChange(e.target.value)}
          placeholder="fx https://www.dinvirksomhed.dk/aabningstider"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Direkte link til jeres åbningstider side
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
        <p className="text-xs text-blue-800">
          💡 <strong>Tip:</strong> Disse links hjælper AI'en med at finde mere præcis information om din virksomhed
        </p>
      </div>
    </div>
  )
}
