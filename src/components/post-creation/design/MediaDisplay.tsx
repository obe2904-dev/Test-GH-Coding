import { useTranslation } from 'react-i18next'
import { MediaItem } from '../../../stores/postCreationStore'

// Icon Components  
const Loader = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
)

interface MediaDisplayProps {
  currentPhoto: MediaItem
  viewMode: 'original' | 'adjusted'
  hasAdjustedVersion: boolean
  selectedMediaIndex: number
  onViewModeChange: (mode: 'original' | 'adjusted') => void
  onRemovePhoto: (index: number) => void
  onSelectVersionForPost: (version: 'original' | 'adjusted') => void
}

function getDisplayUrl(photo: MediaItem, viewMode: 'original' | 'adjusted'): string {
  if (viewMode === 'adjusted' && photo.adjustedUrl) {
    return photo.adjustedUrl
  }
  return photo.url
}

export function MediaDisplay({
  currentPhoto,
  viewMode,
  hasAdjustedVersion,
  selectedMediaIndex,
  onViewModeChange,
  onRemovePhoto,
  onSelectVersionForPost
}: MediaDisplayProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })

  const displayUrl = getDisplayUrl(currentPhoto, viewMode)

  return (
    <div className="space-y-2">
      {/* Main Photo Display with View Toggle */}
      {/* Outer div is full-width for layout; inner div tightly wraps the image so no
          white/gray bars appear on sides when showing a square or portrait crop result. */}
      <div className="w-full flex justify-center">
      <div className="relative rounded-xl overflow-hidden border border-slate-200 inline-block">
        {currentPhoto?.isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium text-white">
                {t('create.processingAI', 'Enhancing with AI...')}
              </p>
            </div>
          </div>
        )}

        {/* Display video or image based on type */}
        {currentPhoto.type === 'video' ? (
          <video
            src={displayUrl}
            controls
            className="max-h-[520px] max-w-full w-auto rounded-xl bg-black"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <img
            src={displayUrl}
            alt="Upload"
            className="max-h-[520px] max-w-full w-auto h-auto block rounded-xl"
          />
        )}
        
        {/* View Mode Toggle - Overlaid on image */}
        {hasAdjustedVersion && (
          <div className="absolute top-2 left-2 flex gap-1 bg-black/50 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('original')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'original'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              {t('create.original', 'Original')}
            </button>
            <button
              onClick={() => onViewModeChange('adjusted')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === 'adjusted'
                  ? 'bg-cta text-white shadow-md'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {t('create.aiEnhanced', 'AI Enhanced')}
            </button>
          </div>
        )}

        {/* Remove button - floating badge top-right inside image */}
        <button
          onClick={() => onRemovePhoto(selectedMediaIndex)}
          aria-label={t('create.remove', 'Remove')}
          className="absolute top-2 right-2 z-20 px-2 py-0.5 bg-white/95 text-red-600 rounded-full shadow-md text-xs font-semibold hover:bg-white transition-colors border border-white/70"
        >
          {t('create.remove', 'Fjern')}
        </button>
      </div>{/* inner tight-wrap */}
      </div>{/* outer full-width centering wrapper */}
      
      {/* Select Version for Post */}
      {hasAdjustedVersion && (
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-medium text-slate-700 mb-2">
            {t('create.selectVersionForPost', 'Which version to use in your post?')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSelectVersionForPost('original')
                onViewModeChange('original')
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                currentPhoto.selectedVersionForPost === 'original'
                  ? 'bg-slate-700 text-white border-2 border-slate-800'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
              }`}
            >
              {currentPhoto.selectedVersionForPost === 'original' && (
                <Check className="w-3 h-3 inline mr-1" />
              )}
              {t('create.useOriginal', 'Use Original')}
            </button>
            <button
              onClick={() => {
                onSelectVersionForPost('adjusted')
                onViewModeChange('adjusted')
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                currentPhoto.selectedVersionForPost === 'adjusted'
                  ? 'bg-cta text-white border-2 border-cta'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
              }`}
            >
              {currentPhoto.selectedVersionForPost === 'adjusted' && (
                <Check className="w-3 h-3" />
              )}
              <Sparkles className="w-3 h-3" />
              {t('create.useAI', 'Use AI Enhanced')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}