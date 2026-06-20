import { useTranslation } from 'react-i18next'

interface VideoCoverSelectorProps {
  candidates: string[]       // up to 3 public storage URLs extracted from the video
  selectedUrl?: string       // currently selected cover
  isExtracting: boolean      // true while frame extraction + upload is in progress
  onSelect: (url: string) => void
}

/**
 * VideoCoverSelector — shown in the Design step left panel whenever the current
 * media item is a video (Smart / Pro tiers only).
 *
 * Displays three candidate cover thumbnails extracted from the video. The user
 * taps one to designate it as the Reel cover. The selected URL is stored on
 * MediaItem.selectedCoverUrl and later passed to the Graph API Reels publish
 * endpoint as cover_url / video_cover_image_url.
 */
export function VideoCoverSelector({
  candidates,
  selectedUrl,
  isExtracting,
  onSelect,
}: VideoCoverSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {t('create.videoCover.title', 'Reel cover')}
        </h3>
        <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
          {t('create.videoCover.subtitle', 'Vælg det billede, der vises som forsidebillede på dit Reel.')}
        </p>
      </div>

      {isExtracting ? (
        // Loading skeletons while frames are being extracted + uploaded
        <div className="flex gap-2 pt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 aspect-[9/16] rounded-lg bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-slate-400 italic pt-1">
          {t('create.videoCover.noFrames', 'Kunne ikke udtrække frames fra videoen.')}
        </p>
      ) : (
        <div className="flex gap-2 pt-1">
          {candidates.map((url, i) => {
            const isSelected = url === selectedUrl
            return (
              <button
                key={i}
                onClick={() => onSelect(url)}
                className={[
                  'flex-1 relative rounded-lg overflow-hidden border-2 transition-all duration-150',
                  isSelected
                    ? 'border-blue-500 shadow-md'
                    : 'border-transparent hover:border-slate-300',
                ].join(' ')}
                title={t('create.videoCover.selectFrame', 'Vælg som cover')}
              >
                <img
                  src={url}
                  alt={`Cover kandidat ${i + 1}`}
                  className="w-full aspect-[9/16] object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )}
                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-medium text-white drop-shadow-sm">
                  {i === 0
                    ? t('create.videoCover.frameStart', 'Start')
                    : i === 1
                    ? t('create.videoCover.frameMid', 'Midten')
                    : t('create.videoCover.frameEnd', 'Slutning')}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selectedUrl && (
        <p className="text-[10px] text-blue-600 font-medium pt-0.5">
          ✓ {t('create.videoCover.selected', 'Cover valgt — bruges ved publicering')}
        </p>
      )}
    </div>
  )
}
