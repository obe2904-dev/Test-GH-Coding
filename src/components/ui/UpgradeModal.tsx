import { useTranslation } from 'react-i18next'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: 'variations' | 'photo-picker' | 'scheduling' | 'tone-length'
}

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

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/>
  </svg>
)

interface FeaturePreview {
  tone: string
  text: string
  locked: boolean
}

interface FeatureContent {
  title: string
  subtitle: string
  preview?: FeaturePreview[]
  benefits: string[]
}

export function UpgradeModal({ isOpen, onClose, feature }: UpgradeModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  // Feature-specific content
  const featureContent: Record<string, FeatureContent> = {
    variations: {
      title: 'See 3 AI Variations',
      subtitle: 'Get more options to choose from',
      preview: [
        { tone: 'Objective', text: 'Your current version ✓', locked: false },
        { tone: 'Warm & Welcoming', text: 'Friendly, inviting tone...', locked: true },
        { tone: 'Passionate', text: 'Energetic, exciting tone...', locked: true }
      ],
      benefits: [
        'Choose from 3 different tones',
        'Pick short, medium, or long versions',
        'Regenerate unlimited times',
        'Perfect for A/B testing'
      ]
    },
    'photo-picker': {
      title: 'AI Photo Analysis',
      subtitle: 'Let AI pick your best photo',
      benefits: [
        'AI analyzes composition & lighting',
        'Picks photo with best engagement potential',
        'Saves you 5 minutes of decision time',
        'Works with up to 5 photos'
      ]
    },
    scheduling: {
      title: 'Smart Scheduling',
      subtitle: 'Schedule posts at perfect times',
      benefits: [
        'Schedule 10 posts per month',
        'AI suggests best times for YOUR audience',
        'Calendar view with conflict detection',
        '1-click scheduling'
      ]
    },
    'tone-length': {
      title: 'Customize Tone & Length',
      subtitle: 'Full control over your content',
      benefits: [
        'Choose from 3 professional tones',
        'Select short, medium, or long posts',
        'Perfect for different platforms',
        'Matches your brand voice'
      ]
    }
  }

  const content = featureContent[feature]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{content.title}</h2>
              <p className="text-xs text-slate-600">{content.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Variations Preview (only for variations feature) */}
          {feature === 'variations' && content.preview && (
            <div className="space-y-2 mb-4">
              {content.preview.map((variant, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-2 ${
                    variant.locked
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {variant.tone}
                    </span>
                    {variant.locked ? (
                      <span className="text-xs text-slate-500">🔒 Smart</span>
                    ) : (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className={`text-sm ${variant.locked ? 'text-slate-500' : 'text-slate-700'}`}>
                    {variant.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Benefits */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {t('upgrade.withStandardPlus', 'With Smart you get:')}
            </h3>
            <div className="space-y-2">
              {content.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-purple-900">DKK 199</span>
              <span className="text-sm text-purple-700">/month</span>
            </div>
            <p className="text-xs text-purple-700 mb-3">
              {t('upgrade.unlimitedPosts', 'Unlimited posts + all pro features')}
            </p>
            <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md">
              {t('upgrade.startTrial', 'Start 14-Day Free Trial')}
            </button>
            <p className="text-xs text-center text-purple-700 mt-2">
              {t('upgrade.noCard', 'No credit card required')}
            </p>
          </div>

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-800 underline"
            >
              {t('upgrade.maybeLater', 'Maybe later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
