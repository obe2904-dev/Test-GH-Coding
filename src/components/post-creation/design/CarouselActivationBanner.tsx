import { useTranslation } from 'react-i18next'

interface CarouselActivationBannerProps {
  onActivate: () => void
  onDismiss: () => void
}

export function CarouselActivationBanner({ onActivate, onDismiss }: CarouselActivationBannerProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.carousel' })

  return (
    <div className="flex items-start gap-3 p-3 bg-cta-surface border border-cta rounded-xl shadow-sm">
      <div className="text-xl leading-none shrink-0 mt-0.5">🖼️</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand mb-1">{t('activationTitle')}</p>
        <p className="text-xs text-cta-text leading-relaxed mb-3">{t('activationDesc')}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onActivate}
            className="px-3 py-1.5 bg-cta text-white rounded-lg text-xs font-semibold hover:bg-cta-hover transition-colors"
          >
            {t('activationYes')}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            {t('activationNo')}
          </button>
        </div>
      </div>
    </div>
  )
}
