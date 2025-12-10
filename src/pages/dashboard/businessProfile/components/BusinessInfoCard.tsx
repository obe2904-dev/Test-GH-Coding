import type { TFunction } from 'i18next'

interface BusinessInfoCardProps {
  t: TFunction
  websiteUrl: string
  highlightWebsite: boolean
  analysisComplete: boolean
  active: boolean
  onActivate: () => void
  onWebsiteChange: (value: string) => void
  onAnalyze: () => void
  onManualEntry: () => void
}

export function BusinessInfoCard({
  t,
  websiteUrl,
  highlightWebsite,
  analysisComplete,
  active,
  onActivate,
  onWebsiteChange,
  onAnalyze,
  onManualEntry
}: BusinessInfoCardProps) {
  const showHighlightedState = highlightWebsite || active
  const activeBorderColor = 'border-[#0F2E32]'
  const baseBorder = showHighlightedState ? activeBorderColor : 'border-gray-200'
  const borderWidth = showHighlightedState ? 'border-4' : 'border-2'
  const shadowClass = showHighlightedState ? 'shadow-lg' : 'shadow-sm'

  return (
    <div
      onClick={onActivate}
      className={`bg-white rounded-lg ${borderWidth} p-6 transition-all duration-300 cursor-pointer ${baseBorder} ${shadowClass}`}
      style={{
        boxShadow: showHighlightedState ? 'rgba(0,0,0,0.03) 0px 4px 10px' : 'rgba(0,0,0,0.02) 0px 2px 6px'
      }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {t('businessProfile.frame1.title')}
        </h2>
        <p className="text-sm text-gray-700 mb-2">
          {t('businessProfile.frame1.subtitle')}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>{t('businessProfile.frame1.supportText1')}</strong><br />
          {t('businessProfile.frame1.supportText2')}<br />
          {t('businessProfile.frame1.supportText3')}<br /><br />
          {t('businessProfile.frame1.supportText4')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <input
            type="url"
            value={websiteUrl}
            onChange={(event) => onWebsiteChange(event.target.value)}
            onFocus={onActivate}
            placeholder={t('businessProfile.frame1.websitePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#88F2D7] focus:border-[#88F2D7] text-sm"
          />
          <button
            onClick={onAnalyze}
            disabled={!websiteUrl.trim()}
            className="w-full px-6 py-2 bg-[#0F2E32] text-[#88F2D7] rounded-lg text-sm font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {websiteUrl && analysisComplete
              ? 'Hent informationer igen'
              : t('businessProfile.frame1.websiteButton')}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={onManualEntry}
            className="text-xs text-[#6B7280] hover:text-[#4B5563] hover:underline transition-colors"
          >
            {t('businessProfile.frame1.manualLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
