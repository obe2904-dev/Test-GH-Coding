import { useTranslation } from 'react-i18next'

// Icon Components
const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const ExternalLink = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
  </svg>
)

interface IdeaCardProps {
  idea: any
  isSelected: boolean
  onSelect: () => void
  type: 'ai' | 'custom'
}

export function IdeaCard({ idea, isSelected, onSelect, type }: IdeaCardProps) {
  const { t } = useTranslation()
  
  // For custom ideas, don't render the card at all (photo suggestion moved to bottom)
  if (type === 'custom') {
    return null
  }
  
  const borderColor = type === 'ai' 
    ? (isSelected ? 'border-purple-500' : 'border-slate-200')
    : (isSelected ? 'border-cta' : 'border-slate-200')
  
  const bgColor = type === 'ai'
    ? (isSelected ? 'bg-purple-50' : 'bg-white')
    : (isSelected ? 'bg-cta-surface' : 'bg-white')

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md ${borderColor} ${bgColor}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-800 mb-0.5">{idea.title}</h4>
          <p className="text-sm text-slate-600">{idea.headline}</p>
        </div>
        
        {isSelected && (
          <div className="bg-purple-600 text-white rounded-full p-1">
            <Check className="w-3 h-3" />
          </div>
        )}
      </div>

      <p className="text-sm text-slate-700 mb-2 line-clamp-2">{idea.text}</p>

      {/* CTA Section (if available from V2 API) */}
      {idea._cta && (
        <div className="mb-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
            idea._cta.type === 'booking' 
              ? 'bg-cta-surface text-cta-text border border-cta-surface'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            <span>{idea._cta.text}</span>
            {idea._cta.url && (
              <ExternalLink className="w-3 h-3" />
            )}
          </div>
        </div>
      )}

      {(idea.bestTimeToPost || idea.impact) && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {idea.bestTimeToPost && (
            <div>
              <span className="font-semibold text-slate-700">{t('publish.bestTime', 'Best time')}:</span>{' '}
              <span>{idea.bestTimeToPost}</span>
            </div>
          )}
          {idea.impact && (
            <div>
              <span className="font-semibold text-slate-700">{t('publish.reach', 'Impact')}:</span>{' '}
              <span>{t(`photoAnalysis.impact.${String(idea.impact).toLowerCase()}` as any, String(idea.impact))}</span>
            </div>
          )}
        </div>
      )}

      {idea.description && (
        <div className="flex items-start gap-1.5 p-2 bg-white rounded-lg border border-slate-200">
          <Camera className="w-3 h-3 text-cta flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-0.5">
              {t('generate.photoSuggestion', 'Foto ide')}:
            </p>
            <p className="text-xs text-slate-600">{idea.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}