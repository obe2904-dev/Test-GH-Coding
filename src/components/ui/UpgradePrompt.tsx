import { useTranslation } from 'react-i18next'

interface UpgradePromptProps {
  feature: string
  currentUsage?: string
  targetTier?: 'standardplus' | 'premium'
  onClose?: () => void
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export function UpgradePrompt({ feature, currentUsage, targetTier = 'standardplus', onClose }: UpgradePromptProps) {
  const { t } = useTranslation()

  const tierFeatures = {
    standardplus: [
      t('upgrade.unlimitedAiIdeas', 'Unlimited AI Ideas'),
      t('upgrade.unlimitedCaptions', 'Unlimited Caption Improvements'),
      t('upgrade.unlimitedScheduling', 'Unlimited Scheduling'),
      t('upgrade.threeChannels', 'Up to 3 Social Channels')
    ],
    premium: [
      t('upgrade.allStandardPlus', 'Everything in Smart'),
      t('upgrade.sixChannels', 'Up to 6 Social Channels'),
      t('upgrade.autoReplies', 'Auto-Reply to Comments'),
      t('upgrade.deepInsights', 'Deep Analytics & Insights'),
      t('upgrade.windowScheduling', 'Smart Window Scheduling')
    ]
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8" />
            <h2 className="text-xl font-bold">
              {t('upgrade.title', 'Upgrade to Unlock')}
            </h2>
          </div>
          <p className="text-sm text-white/90">
            {t('upgrade.subtitle', `You've reached your limit for ${feature}`)}
          </p>
          {currentUsage && (
            <p className="text-xs text-white/80 mt-1">
              {currentUsage}
            </p>
          )}
        </div>

        {/* Features */}
        <div className="p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">
            {targetTier === 'standardplus' 
              ? t('upgrade.standardPlusFeatures', 'Smart Features')
              : t('upgrade.premiumFeatures', 'Pro Features')
            }
          </h3>
          
          <div className="space-y-3 mb-6">
            {tierFeatures[targetTier].map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // TODO: Navigate to upgrade page
                console.log('Upgrade to', targetTier)
              }}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              {t('upgrade.upgradeNow', 'Upgrade Now')}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                {t('upgrade.later', 'Maybe Later')}
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center mt-4">
            {t('upgrade.noCommitment', 'Cancel anytime. 14-day money-back guarantee.')}
          </p>
        </div>
      </div>
    </div>
  )
}
