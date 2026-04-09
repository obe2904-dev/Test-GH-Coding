import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MediaItem } from '../../../stores/postCreationStore'
import { useTierStore } from '../../../stores/tierStore'

// Icon Components
const Upload = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

const Play = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

interface PhotoUploadManagerProps {
  uploadedMedia: MediaItem[]
  selectedMediaIndex: number
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onReplacePhoto?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto: (index: number) => void
  onSelectMedia: (index: number) => void
  processingImage?: boolean
}

export function PhotoUploadManager({
  uploadedMedia,
  selectedMediaIndex,
  onPhotoUpload,
  onReplacePhoto,
  onRemovePhoto,
  onSelectMedia,
  processingImage = false
}: PhotoUploadManagerProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const { currentTier } = useTierStore()

  // Plan limits
  const planLimits: Record<string, number> = { free: 1, standardplus: 5, premium: 10 }
  const maxPhotos = planLimits[currentTier]
  
  const hasPhoto = uploadedMedia && uploadedMedia.length > 0
  const canAddMore = uploadedMedia.length < maxPhotos

  return (
    <>
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-800 mb-1">
          {t('create.chooseYourPhoto')}
        </h3>
        <p className="text-xs text-slate-600">
          {t('create.uploadPreviewDesc')}
        </p>
      </div>

      {/* Thumbnail Gallery - Shows ABOVE main photo for multiple photos */}
      {hasPhoto && uploadedMedia.length > 1 && (
        <div className="mb-3 p-2 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              {uploadedMedia.length} {t('create.photos', 'photos')} ({selectedMediaIndex + 1} {t('create.selected', 'selected')})
            </span>
            {canAddMore && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-cta font-medium hover:underline flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                {t('create.addMore', 'Add')}
              </button>
            )}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            {uploadedMedia.map((media, index) => (
              <div 
                key={media.id}
                onClick={() => onSelectMedia(index)}
                className={`relative cursor-pointer flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedMediaIndex 
                    ? 'border-cta ring-2 ring-cta' 
                    : 'border-slate-200 hover:border-cta'
                }`}
              >
                {media.type === 'video' ? (
                  <>
                    <video
                      src={media.url}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white drop-shadow" />
                    </div>
                  </>
                ) : (
                  <img
                    src={media.url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                {media.adjustedUrl && (
                  <div className="absolute top-0.5 right-0.5">
                    <Sparkles className="w-3 h-3 text-yellow-400 drop-shadow" />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemovePhoto(index)
                  }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {processingImage ? (
        <div className="border-2 border-dashed border-cta rounded-lg p-8 text-center bg-cta-surface">
          <div className="animate-spin w-8 h-8 border-4 border-cta-surface border-t-cta rounded-full mx-auto mb-2" />
          <p className="text-xs font-medium text-cta-text mb-1">
            {t('create.uploadingProcessing')}
          </p>
          <p className="text-xs text-cta">
            {t('create.pleaseWait')}
          </p>
        </div>
      ) : !hasPhoto ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-lg py-6 text-center cursor-pointer hover:border-cta hover:bg-cta-surface transition-all h-[140px] flex flex-col items-center justify-center"
        >
          <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700 mb-1">
            {t('create.clickToUploadMedia')}
          </p>
          <p className="text-xs text-slate-500">
            {t('create.fileFormats')}
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/x-m4v"
            multiple={currentTier !== 'free'}
            onChange={onPhotoUpload}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Change Photo Button - Single photos only */}
          {uploadedMedia.length === 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => replaceFileInputRef.current?.click()}
                className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-cta hover:text-cta hover:bg-cta-surface transition-all"
              >
                {t('create.changePhoto', 'Change Photo')}
              </button>
              
              <input
                ref={replaceFileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/x-m4v"
                multiple={false}
                onChange={onReplacePhoto}
                className="hidden"
              />
            </div>
          )}

          {/* Add More Photos Button - Multiple photos */}
          {uploadedMedia.length > 1 && canAddMore && (
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-cta hover:text-cta hover:bg-cta-surface transition-all flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" />
                {t('create.addMorePhotos', 'Add More Photos')} ({uploadedMedia.length}/{maxPhotos})
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/x-m4v"
                multiple={currentTier !== 'free'}
                onChange={onPhotoUpload}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}

    </div>
  </>
  )
}