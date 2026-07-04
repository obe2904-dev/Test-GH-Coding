import { useTranslation } from 'react-i18next'
import type { PhotoContent, MediaItem } from '../../../stores/postCreationStore'
import type { CarouselOrganiseResult } from '../../../hooks/useCarouselOrganise'

type CarouselTheme = NonNullable<PhotoContent['carouselTheme']>
type CarouselGoal = NonNullable<PhotoContent['carouselGoal']>

interface CarouselSetupProps {
  photoContent: PhotoContent
  onThemeSelect: (theme: CarouselTheme) => void
  onGoalSelect: (goal: CarouselGoal) => void
  onOrganise: () => void
  isOrganising: boolean
  organiseResult: CarouselOrganiseResult | null
  onApplyOrganise: () => void
  onDismissOrganise: () => void
  dragAndDropEnabled: boolean
  goalEnabled: boolean
}

const THEMES: { key: CarouselTheme; emoji: string; labelKey: string }[] = [
  { key: 'new_item',       emoji: '✨', labelKey: 'themeNewItem' },
  { key: 'todays_special', emoji: '⭐', labelKey: 'themeTodaysSpecial' },
  { key: 'brunch',         emoji: '☕', labelKey: 'themeBrunch' },
  { key: 'cozy',           emoji: '🕯️', labelKey: 'themeCozy' },
  { key: 'team',           emoji: '👥', labelKey: 'themeTeam' },
]

const GOALS: { key: CarouselGoal; emoji: string; labelKey: string }[] = [
  { key: 'sell',          emoji: '💰', labelKey: 'goalSell' },
  { key: 'cozy_brand',    emoji: '🤗', labelKey: 'goalCozyBrand' },
  { key: 'trust',         emoji: '🤝', labelKey: 'goalTrust' },
  { key: 'drive_traffic', emoji: '📍', labelKey: 'goalDriveTraffic' },
]

// Sparkles icon
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

function getPreviewUrl(media: MediaItem): string {
  if (media.selectedVersionForPost === 'adjusted' && media.adjustedUrl) return media.adjustedUrl
  return media.url
}

export function CarouselSetup({
  photoContent,
  onThemeSelect,
  onGoalSelect,
  onOrganise,
  isOrganising,
  organiseResult,
  onApplyOrganise,
  onDismissOrganise,
  dragAndDropEnabled: _dragAndDropEnabled,
  goalEnabled,
}: CarouselSetupProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.carousel' })
  const canOrganise = !!photoContent.carouselTheme && !isOrganising

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <span className="text-base leading-none">🖼️</span>
        <h3 className="text-sm font-bold text-slate-800">{t('setupTitle')}</h3>
      </div>

      <div className="p-3 space-y-4">

        {/* Theme picker */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">{t('themeLabel')}</p>
          <div className="flex gap-2 flex-wrap">
            {THEMES.map(({ key, emoji, labelKey }) => (
              <button
                key={key}
                onClick={() => onThemeSelect(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  photoContent.carouselTheme === key
                    ? 'bg-cta-surface border-cta text-brand shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-cta hover:bg-cta-surface'
                }`}
              >
                <span>{emoji}</span>
                <span>{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Goal picker — Pro only */}
        {goalEnabled && (
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">{t('goalLabel')}</p>
            <div className="flex gap-2 flex-wrap">
              {GOALS.map(({ key, emoji, labelKey }) => (
                <button
                  key={key}
                  onClick={() => onGoalSelect(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    photoContent.carouselGoal === key
                      ? 'bg-cta-surface border-cta text-brand shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-cta hover:bg-cta-surface'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Organise button */}
        {!organiseResult && (
          <button
            onClick={onOrganise}
            disabled={!canOrganise}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-cta text-white rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-cta-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isOrganising ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('organising')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t('organiseButton')}</span>
              </>
            )}
          </button>
        )}

        {/* AI Organise result */}
        {organiseResult && (
          <div className="border border-cta rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-cta-surface flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cta" />
              <p className="text-xs font-semibold text-brand">{t('organiseResultTitle')}</p>
            </div>

            {/* Suggested order thumbnails */}
            <div className="p-3 space-y-3">
              {organiseResult.rationale && (
                <p className="text-xs text-slate-600 italic leading-relaxed">{organiseResult.rationale}</p>
              )}

              <div className="flex gap-2 overflow-x-auto pb-1">
                {organiseResult.suggestedOrder.map((originalIndex, position) => {
                  const media = photoContent.uploadedMedia[originalIndex]
                  if (!media) return null
                  const isCover = position === 0
                  const isFlagged = organiseResult.flaggedSkipIndices.includes(originalIndex)
                  const flagReason = isFlagged
                    ? organiseResult.flaggedReasons[organiseResult.flaggedSkipIndices.indexOf(originalIndex)]
                    : null

                  return (
                    <div key={originalIndex} className="relative flex-shrink-0 w-14 h-14">
                      <div className={`w-full h-full rounded-lg overflow-hidden border-2 ${
                        isCover ? 'border-yellow-400' : isFlagged ? 'border-orange-300' : 'border-slate-200'
                      }`}>
                        <img
                          src={getPreviewUrl(media)}
                          alt={`Slide ${position + 1}`}
                          className={`w-full h-full object-cover ${isFlagged ? 'opacity-50' : ''}`}
                        />
                      </div>
                      {/* Position number */}
                      <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] font-bold rounded px-0.5 leading-tight">
                        {position + 1}
                      </span>
                      {/* Cover star */}
                      {isCover && (
                        <span className="absolute top-0.5 left-0.5 text-yellow-400 text-xs leading-none">⭐</span>
                      )}
                      {/* Skip warning */}
                      {isFlagged && (
                        <span className="absolute top-0.5 right-0.5 text-orange-500 text-xs leading-none" title={flagReason || ''}>⚠️</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Flagged reasons */}
              {organiseResult.flaggedSkipIndices.length > 0 && (
                <div className="space-y-1">
                  {organiseResult.flaggedSkipIndices.map((idx, i) => (
                    <p key={idx} className="text-xs text-orange-700 leading-snug">
                      ⚠️ {t('slide')} {organiseResult.suggestedOrder.indexOf(idx) + 1}: {organiseResult.flaggedReasons[i]}
                    </p>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onApplyOrganise}
                  className="flex-1 px-3 py-1.5 bg-cta text-white rounded-lg text-xs font-semibold hover:bg-cta-hover transition-colors"
                >
                  {t('organiseApply')}
                </button>
                <button
                  onClick={onDismissOrganise}
                  className="flex-1 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  {t('organiseDismiss')}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
