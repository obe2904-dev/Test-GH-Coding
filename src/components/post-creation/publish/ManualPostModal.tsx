import { useState, useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { PhotoContent } from '../../../stores/postCreationStore'
import { useTierStore } from '../../../stores/tierStore'
import { PlatformIndicator } from './PlatformIndicator'
import { Download, Copy, ExternalLink } from './icons'
import { formatPlatformList, getPlatformLabel } from './utils.ts'
import { QuarterHourTimePicker } from '../../ui/QuarterHourTimePicker'

interface ManualPostModalProps {
  isOpen: boolean
  platforms: string[]
  photoContent: PhotoContent | null
  copiedPlatform: string | null
  t: TFunction
  onClose: () => void
  onComplete: () => void
  onConnectPlatform: (platform: string) => void
  downloadPhoto: () => Promise<void>
  copyToClipboard: (platform: string) => Promise<void>
  openPlatform: (platform: string) => void
  getFormattedContent: (platform: string) => string
  onConfirmPosted: (platform: string, postedAt: Date) => Promise<void>
}

function getCurrentTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function ManualPostModal({
  isOpen,
  platforms,
  photoContent,
  copiedPlatform,
  t,
  onClose,
  onComplete,
  downloadPhoto,
  copyToClipboard,
  openPlatform,
  getFormattedContent,
  onConfirmPosted
}: ManualPostModalProps) {
  const { currentTier } = useTierStore()
  const showUpsell = currentTier === 'free'
  const [openedPlatforms, setOpenedPlatforms] = useState<Set<string>>(new Set())
  const [confirmedPlatforms, setConfirmedPlatforms] = useState<Set<string>>(new Set())
  const [platformPostTimes, setPlatformPostTimes] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState<string | null>(null)

  const getPostTime = (platformName: string) =>
    platformPostTimes[platformName] ?? getCurrentTimeString()

  const handleOpenPlatform = useCallback((platformName: string) => {
    setOpenedPlatforms((prev) => new Set(prev).add(platformName))
    // Seed the time to "now" the moment the user clicks open
    setPlatformPostTimes((prev) => ({
      ...prev,
      [platformName]: prev[platformName] ?? getCurrentTimeString(),
    }))
    openPlatform(platformName)
  }, [openPlatform])

  const handleConfirm = useCallback(async (platformName: string) => {
    setConfirming(platformName)
    const timeStr = getPostTime(platformName)
    const [hours, minutes] = timeStr.split(':').map(Number)
    const postedAt = new Date()
    postedAt.setHours(hours, minutes, 0, 0)
    await onConfirmPosted(platformName, postedAt)
    setConfirmedPlatforms((prev) => new Set(prev).add(platformName))
    setConfirming(null)
  }, [platformPostTimes, onConfirmPosted])

  const allConfirmed = platforms.every((p) => confirmedPlatforms.has(getPlatformLabel(p)))

  if (!isOpen || platforms.length === 0) {
    return null
  }

  const formattedPlatforms = formatPlatformList(platforms)
  const isCarousel = photoContent?.carouselMode === true && (photoContent?.uploadedMedia?.length ?? 0) > 1
  const photoUrl = isCarousel ? null : (photoContent?.uploadedMedia?.[0]?.url ?? null)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E7EB]"
        style={{ boxShadow: '0 18px 40px rgba(15, 46, 50, 0.08)' }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1F2937]">📋 {t('manualPostModal.title', 'Klar til at poste')}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
              ×
            </button>
          </div>

          <p className="text-sm text-[#6B7280] mb-4">
            {t('manualPostModal.subtitle', 'Your post is ready! Copy and paste to {platforms}.', {
              platforms: formattedPlatforms
            })}
          </p>

          {platforms.map((platform) => {
            const platformName = getPlatformLabel(platform)
            const copyStep = photoUrl ? '2' : '1'
            const openStep = photoUrl ? '3' : '2'
            const isOpened = openedPlatforms.has(platformName)
            const isConfirmed = confirmedPlatforms.has(platformName)
            const isConfirming = confirming === platformName

            return (
              <div key={platform} className="mt-3 first:mt-0">
                <h3 className="text-xs font-medium text-[#1F2937] mb-1">{platformName} post</h3>
                <div className={`p-3 rounded-xl border transition-colors ${
                  isConfirmed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-[#F8F6FF] border-[#E5E7EB]'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <PlatformIndicator platform={platformName} isConnected={false} />
                    {isConfirmed ? (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        ✓ {t('manualPostModal.confirmedAt', 'Postet {time}', { time: getPostTime(platformName) })}
                      </span>
                    ) : (
                      <span className="text-xs text-[#6B7280]">
                        {t('manualPostingRequired', 'Manual post required')}
                      </span>
                    )}
                  </div>

                  {isCarousel && photoContent?.uploadedMedia && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        🎠 {t('manualPostModal.carouselSlides', 'Karrusel-slides')} ({photoContent.uploadedMedia.length})
                      </p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {photoContent.uploadedMedia.map((m, i) => (
                          <div key={m.id} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200">
                            {m.type === 'video' ? (
                              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                <span className="text-white text-xs">▶</span>
                              </div>
                            ) : (
                              <img
                                src={m.adjustedUrl || m.url}
                                alt={`Slide ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center leading-4">
                              {i === (photoContent.carouselCoverIndex ?? 0) ? '⭐' : `${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {t('manualPostModal.carouselNote', 'Gem hvert slide og upload dem i rækkefølge som karrusel.')}
                      </p>
                    </div>
                  )}

                  {photoUrl && (
                    <div className="mb-2">
                      <img
                        src={photoUrl}
                        alt="Post preview"
                        className="w-full max-h-[160px] object-cover rounded-lg border border-[#E5E7EB]"
                      />
                    </div>
                  )}

                  {/* Action buttons — copy / open */}
                  {!isConfirmed && (
                    <div className="flex gap-1.5 mb-2">
                      {photoUrl && (
                        <button
                          onClick={downloadPhoto}
                          className="flex-1 px-2 py-2 bg-white border border-[#D1D5DB] text-brand rounded-lg text-xs font-medium hover:bg-[#F9FAFB] flex items-center justify-center gap-1"
                        >
                          <span className="font-bold">1</span>
                          <Download className="w-3 h-3" />
                          <span>{t('manualPostModal.saveImage', 'Gem billede')}</span>
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(platformName)}
                        className="flex-1 px-2 py-2 bg-white border border-[#D1D5DB] text-brand rounded-lg text-xs font-medium hover:bg-[#F9FAFB] flex items-center justify-center gap-1"
                      >
                        <span className="font-bold">{copyStep}</span>
                        <Copy className="w-3 h-3" />
                        <span>{copiedPlatform === platformName ? t('manualPostModal.copied', 'Kopieret!') : t('manualPostModal.copyText', 'Kopiér tekst')}</span>
                      </button>
                      <button
                        onClick={() => handleOpenPlatform(platformName)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                          isOpened
                            ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                            : 'bg-cta text-text-inverse hover:bg-cta-hover'
                        }`}
                      >
                        <span className="font-bold">{openStep}</span>
                        <ExternalLink className="w-3 h-3" />
                        <span>
                          {isOpened
                            ? t('manualPostModal.platformOpened', '{platform} åbnet', { platform: platformName })
                            : t('manualPostModal.openPlatform', 'Åbn {platform}', { platform: platformName })}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Confirm posted — appears after the user has opened the platform */}
                  {isOpened && !isConfirmed && (
                    <div className="mt-2 p-2.5 bg-white rounded-lg border border-emerald-200">
                      <p className="text-xs font-semibold text-[#1F2937] mb-2">
                        {t('manualPostModal.confirmQuestion', 'Hvornår postede du det?')}
                      </p>
                      <div className="flex items-center gap-2">
                        <QuarterHourTimePicker
                          value={getPostTime(platformName)}
                          className="w-32"
                          onChange={(value) => setPlatformPostTimes((prev) => ({ ...prev, [platformName]: value }))}
                        />
                        <button
                          onClick={() => handleConfirm(platformName)}
                          disabled={isConfirming}
                          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1 transition-colors"
                        >
                          {isConfirming ? (
                            <span>{t('manualPostModal.saving', 'Gemmer...')}</span>
                          ) : (
                            <span>✓ {t('manualPostModal.confirmPosted', 'Jeg har postet det')}</span>
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">Tid vælges i 15-minutters intervaller: 00, 15, 30 og 45.</p>
                    </div>
                  )}

                  {/* Post text preview */}
                  <div className={`py-2 px-3 rounded-lg border mt-2 ${isConfirmed ? 'bg-emerald-50 border-emerald-100' : 'bg-[#F9FAFB] border-[#E5E7EB]'}`} style={{ lineHeight: '1.3' }}>
                    <p className="text-xs text-[#1F2937] whitespace-pre-wrap">{getFormattedContent(platformName)}</p>
                  </div>

                  {!isConfirmed && (
                    <p className="text-[11px] text-[#6B7280] mt-1">
                      <span className="font-medium">{t('manualPostModal.howTo', 'Sådan gør du')}:</span>{' '}
                      {photoUrl
                        ? t('manualPostModal.stepsWithPhoto', '1. Gem billede · 2. Kopiér tekst · 3. Åbn {platform} · 4. Indsæt', {
                          platform: platformName
                        })
                        : t('manualPostModal.stepsWithoutPhoto', '1. Kopiér tekst · 2. Åbn {platform} · 3. Indsæt', {
                          platform: platformName
                        })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {showUpsell && (
            <div className="mt-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
              <div className="flex items-start gap-2.5">
                <div className="text-xl">⚡</div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-[#1F2937] mb-1">{t('manualPostModal.upsellTitle', 'Want scheduling & automation?')}</h3>
                  <p className="text-xs text-[#6B7280] mb-2 leading-relaxed">
                    {t('manualPostModal.upsellDescription', 'Upgrade to Smart or Pro for automatic posting and content planning.')}
                  </p>

                  <div className="space-y-1 mb-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                      <span className="text-emerald-600">✓</span>
                      <span>{t('manualPostModal.upsellBullet1', 'Schedule posts in advance')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                      <span className="text-emerald-600">✓</span>
                      <span>{t('manualPostModal.upsellBullet2', 'One-click automatic posting')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                      <span className="text-emerald-600">✓</span>
                      <span>{t('manualPostModal.upsellBullet3', 'Performance tracking & AI insights')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = '/settings?tab=subscription'}
                      className="px-4 py-2 bg-cta text-text-inverse rounded-lg text-xs font-medium hover:bg-cta-hover flex items-center gap-1.5"
                    >
                      <span>⭐</span>
                      {t('manualPostModal.upgrade', 'Upgrade to Smart')}
                    </button>
                    <button onClick={onClose} className="px-3 py-2 text-xs text-[#6B7280] hover:text-[#1F2937]">
                      {t('manualPostModal.maybeLater', 'Maybe later')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom action row */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
              {t('manualPostModal.close', 'Luk')}
            </button>
            <button
              onClick={onComplete}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                allConfirmed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {allConfirmed
                ? `✓ ${t('manualPostModal.done', 'Færdig')}`
                : t('manualPostModal.skipConfirm', 'Spring bekræftelse over →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
