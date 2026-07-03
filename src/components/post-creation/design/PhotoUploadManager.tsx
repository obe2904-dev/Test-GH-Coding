import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MediaItem } from '../../../stores/postCreationStore'
import { useTierStore } from '../../../stores/tierStore'
import { TIER_QUOTAS } from '../../../config/quotas'

// ── Icon Components ────────────────────────────────────────────────────────────

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

const Trash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
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

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
)

// ── Sortable thumbnail (Pro drag-and-drop) ─────────────────────────────────────

interface SortableThumbnailProps {
  media: MediaItem
  index: number
  selectedMediaIndex: number
  coverIndex: number
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onClearSkip: (index: number) => void
}

function SortableThumbnail({
  media,
  index,
  selectedMediaIndex,
  coverIndex,
  onSelect,
  onRemove,
  onClearSkip,
}: SortableThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const isCover = index === coverIndex

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(index)}
      className={`relative cursor-grab active:cursor-grabbing flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all select-none ${
        index === selectedMediaIndex ? 'border-cta ring-2 ring-cta' : 'border-slate-200 hover:border-cta'
      }`}
    >
      <ThumbnailContent media={media} />
      {isCover && (
        <span className="absolute top-0.5 left-0.5 text-yellow-400 text-xs leading-none pointer-events-none">⭐</span>
      )}
      {media.aiSkipSuggested && (
        <button
          onClick={(e) => { e.stopPropagation(); onClearSkip(index) }}
          className="absolute inset-0 bg-black/40 flex items-center justify-center"
          title="AI flagged — click to keep"
        >
          <span className="text-xs">⚠️</span>
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index) }}
        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  )
}

// ── Static thumbnail (shared rendering) ───────────────────────────────────────

function ThumbnailContent({ media }: { media: MediaItem }) {
  return media.type === 'video' ? (
    <>
      <video src={media.url} className="w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
        <Play className="w-4 h-4 text-white drop-shadow" />
      </div>
    </>
  ) : (
    <img src={media.url} alt="" className="w-full h-full object-cover" />
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface PhotoUploadManagerProps {
  uploadedMedia: MediaItem[]
  selectedMediaIndex: number
  carouselMode?: boolean
  carouselCoverIndex?: number
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onReplacePhoto?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto: (index: number) => void
  onSelectMedia: (index: number) => void
  onReorderMedia?: (newOrder: MediaItem[]) => void
  onSetCover?: (index: number) => void
  onClearAiSkip?: (index: number) => void
  onSlideCaptionChange?: (index: number, caption: string) => void
  processingImage?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PhotoUploadManager({
  uploadedMedia,
  selectedMediaIndex,
  carouselMode = false,
  carouselCoverIndex = 0,
  onPhotoUpload,
  onReplacePhoto,
  onRemovePhoto,
  onSelectMedia,
  onReorderMedia,
  onSetCover,
  onClearAiSkip,
  onSlideCaptionChange,
  processingImage = false,
}: PhotoUploadManagerProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const { currentTier } = useTierStore()

  const maxPhotos = TIER_QUOTAS[currentTier].photoUploadsPerPost
  const carouselQuota = TIER_QUOTAS[currentTier].carousel
  const dragEnabled = carouselQuota.dragAndDrop
  const slideCaptionEnabled = carouselQuota.slideCaption

  const hasPhoto = uploadedMedia && uploadedMedia.length > 0
  const canAddMore = uploadedMedia.length < maxPhotos

  // dnd-kit sensors (only active when drag-and-drop is enabled)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = uploadedMedia.findIndex(m => m.id === active.id)
    const newIndex = uploadedMedia.findIndex(m => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(uploadedMedia, oldIndex, newIndex)
    onReorderMedia?.(newOrder)
    // After drag the selected item follows
    onSelectMedia(newIndex)
  }

  const handleMoveLeft = (index: number) => {
    if (index === 0) return
    const newOrder = [...uploadedMedia]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    onReorderMedia?.(newOrder)
    onSelectMedia(index - 1)
  }

  const handleMoveRight = (index: number) => {
    if (index >= uploadedMedia.length - 1) return
    const newOrder = [...uploadedMedia]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    onReorderMedia?.(newOrder)
    onSelectMedia(index + 1)
  }

  const currentMedia = hasPhoto ? uploadedMedia[selectedMediaIndex] : undefined

  // ── Render ───────────────────────────────────────────────────────────────────

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

        {/* ── Carousel gallery (≥2 photos) ─────────────────────────────────── */}
        {hasPhoto && uploadedMedia.length > 1 && (
          <div className="mb-3 p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                {uploadedMedia.length} {t('create.photos', 'fotos')}
                {carouselMode && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-cta text-white rounded text-[10px] font-bold uppercase tracking-wide">
                    {t('carousel.label')}
                  </span>
                )}
              </span>
              {canAddMore && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-cta font-medium hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  {t('create.addMore', 'Tilføj')}
                </button>
              )}
            </div>

            {/* Drag-and-drop (Pro) or static with arrows (Smart) */}
            {dragEnabled && onReorderMedia ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={uploadedMedia.map(m => m.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {uploadedMedia.map((media, index) => (
                      <SortableThumbnail
                        key={media.id}
                        media={media}
                        index={index}
                        selectedMediaIndex={selectedMediaIndex}
                        coverIndex={carouselCoverIndex}
                        onSelect={onSelectMedia}
                        onRemove={onRemovePhoto}
                        onClearSkip={(i) => onClearAiSkip?.(i)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {uploadedMedia.map((media, index) => (
                  <div key={media.id} className="flex flex-col items-center gap-1">
                    <div
                      onClick={() => onSelectMedia(index)}
                      className={`relative cursor-pointer flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        index === selectedMediaIndex ? 'border-cta ring-2 ring-cta' : 'border-slate-200 hover:border-cta'
                      }`}
                    >
                      <ThumbnailContent media={media} />
                      {/* Cover star */}
                      {carouselMode && index === carouselCoverIndex && (
                        <span className="absolute top-0.5 left-0.5 text-yellow-400 text-xs leading-none pointer-events-none">⭐</span>
                      )}
                      {/* AI skip flag */}
                      {media.aiSkipSuggested && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onClearAiSkip?.(index) }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center"
                          title={t('carousel.keepAnyway', 'Behold alligevel')}
                        >
                          <span className="text-xs">⚠️</span>
                        </button>
                      )}
                      {/* AI enhanced badge */}
                      {media.adjustedUrl && !media.aiSkipSuggested && (
                        <div className="absolute top-0.5 right-0.5 pointer-events-none">
                          <Sparkles className="w-3 h-3 text-yellow-400 drop-shadow" />
                        </div>
                      )}
                      {/* Remove */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemovePhoto(index) }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>

                    {/* Reorder arrows (Smart — shown when carousel mode active) */}
                    {carouselMode && onReorderMedia && (
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => handleMoveLeft(index)}
                          disabled={index === 0}
                          className="w-5 h-5 bg-white border border-slate-300 rounded flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={t('carousel.moveLeft', 'Flyt venstre')}
                        >
                          <ChevronLeft className="w-3 h-3 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleMoveRight(index)}
                          disabled={index >= uploadedMedia.length - 1}
                          className="w-5 h-5 bg-white border border-slate-300 rounded flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={t('carousel.moveRight', 'Flyt højre')}
                        >
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                        </button>
                      </div>
                    )}

                    {/* Set cover (carousel mode, not already cover) */}
                    {carouselMode && index !== carouselCoverIndex && onSetCover && (
                      <button
                        onClick={() => onSetCover(index)}
                        className="text-[10px] text-cta font-medium hover:underline leading-none"
                      >
                        {t('carousel.setCover', 'Cover')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Processing / empty / has-photo states ────────────────────────── */}
        {processingImage ? (
          <div className="border-2 border-dashed border-cta rounded-lg p-8 text-center bg-cta-surface">
            <div className="animate-spin w-8 h-8 border-4 border-cta-surface border-t-cta rounded-full mx-auto mb-2" />
            <p className="text-xs font-medium text-cta-text mb-1">{t('create.uploadingProcessing')}</p>
            <p className="text-xs text-cta">{t('create.pleaseWait')}</p>
          </div>
        ) : !hasPhoto ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg py-6 text-center cursor-pointer hover:border-cta hover:bg-cta-surface transition-all h-[140px] flex flex-col items-center justify-center"
          >
            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700 mb-1">{t('create.clickToUploadMedia')}</p>
            <p className="text-xs text-slate-500">{t('create.fileFormats')}</p>
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
            {uploadedMedia.length === 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="flex-1 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-cta hover:text-cta hover:bg-cta-surface transition-all"
                >
                  {t('create.changePhoto', 'Skift foto')}
                </button>
                <button
                  onClick={() => onRemovePhoto(0)}
                  className="px-3 py-1.5 border border-red-300 rounded-lg text-xs text-red-600 hover:border-red-500 hover:bg-red-50 transition-all flex items-center gap-1.5"
                  title={t('create.deletePhoto', 'Slet foto')}
                >
                  <Trash className="w-3.5 h-3.5" />
                  {t('create.delete', 'Slet')}
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

            {uploadedMedia.length > 1 && canAddMore && (
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-cta hover:text-cta hover:bg-cta-surface transition-all flex items-center justify-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  {t('create.addMorePhotos', 'Tilføj fotos')} ({uploadedMedia.length}/{maxPhotos})
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

        {/* ── Per-slide caption (Pro, carousel mode, selected slide) ──────── */}
        {slideCaptionEnabled && carouselMode && currentMedia && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('carousel.slideCaptionLabel', 'Slide tekst (valgfrit)')}
              <span className="ml-1 text-slate-400 font-normal">
                {selectedMediaIndex + 1}/{uploadedMedia.length}
              </span>
            </label>
            <textarea
              value={currentMedia.slideCaption ?? ''}
              onChange={(e) => onSlideCaptionChange?.(selectedMediaIndex, e.target.value)}
              maxLength={125}
              rows={2}
              placeholder={t('carousel.slideCaptionPlaceholder', 'Valgfri tekst til dette slide...')}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-cta focus:border-cta text-slate-800 placeholder-slate-400"
            />
            <p className="text-right text-[10px] text-slate-400 mt-0.5">
              {(currentMedia.slideCaption ?? '').length}/125
            </p>
          </div>
        )}
      </div>
    </>
  )
}
