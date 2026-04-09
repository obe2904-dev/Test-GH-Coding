import type { TFunction } from 'i18next'
import type { Tier } from '../../../../stores/tierStore'

interface BusinessInfoCardProps {
  t: TFunction
  websiteUrl: string
  highlightWebsite: boolean
  analysisComplete: boolean
  active: boolean
  currentTier: Tier
  onActivate: () => void
  onWebsiteChange: (value: string) => void
  onAnalyze: () => void
  onManualEntry: () => void
  onUpgrade?: () => void
}

export function BusinessInfoCard({
  t,
  websiteUrl,
  highlightWebsite,
  analysisComplete,
  active,
  currentTier,
  onActivate,
  onWebsiteChange,
  onAnalyze,
  onManualEntry,
  onUpgrade
}: BusinessInfoCardProps) {
  const showHighlightedState = highlightWebsite || active
  const activeBorderColor = 'border-brand'
  const baseBorder = showHighlightedState ? activeBorderColor : 'border-gray-200'
  const borderWidth = showHighlightedState ? 'border-4' : 'border-2'
  const shadowClass = showHighlightedState ? 'shadow-lg' : 'shadow-sm'
  const isFree = currentTier === 'free'

  return (
    <div
      onClick={onActivate}
      className={`bg-white rounded-lg ${borderWidth} p-6 transition-all duration-300 cursor-pointer ${baseBorder} ${shadowClass}`}
      style={{
        boxShadow: showHighlightedState ? 'rgba(0,0,0,0.03) 0px 4px 10px' : 'rgba(0,0,0,0.02) 0px 2px 6px'
      }}
    >
      {isFree ? (
        // Free Tier - Simple info with upgrade prompt
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Din forretningsprofil
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              Udfyld de grundlæggende oplysninger om din forretning nedenfor.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-gray-700 leading-relaxed mb-2">
                <strong>💡 Opgrader til Smart eller Pro</strong> for at få automatisk information fra din hjemmeside.
              </p>
              {onUpgrade && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpgrade()
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                >
                  Se planer og priser →
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Paid Tiers - Website analysis feature
        <>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint focus:border-mint text-sm"
              />
              <button
                onClick={onAnalyze}
                disabled={!websiteUrl.trim()}
                title={!websiteUrl.trim() ? 'Indsæt link til hjemmeside' : ''}
                className="w-full px-6 py-2 bg-brand text-mint rounded-lg text-sm font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:bg-brand disabled:cursor-not-allowed"
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
        </>
      )}
    </div>
  )
}
