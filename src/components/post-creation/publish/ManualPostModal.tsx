import type { TFunction } from 'i18next'
import type { PhotoContent } from '../../../stores/postCreationStore'
import { PlatformIndicator } from './PlatformIndicator'
import { Download, Copy, ExternalLink, Link2 } from './icons'
import { formatPlatformList, getPlatformLabel } from './utils.ts'

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
}

export function ManualPostModal({
  isOpen,
  platforms,
  photoContent,
  copiedPlatform,
  t,
  onClose,
  onComplete,
  onConnectPlatform,
  downloadPhoto,
  copyToClipboard,
  openPlatform,
  getFormattedContent
}: ManualPostModalProps) {
  if (!isOpen || platforms.length === 0) {
    return null
  }

  const formattedPlatforms = formatPlatformList(platforms)
  const photoUrl = photoContent?.uploadedMedia?.[0]?.url ?? null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E7EB]"
        style={{ boxShadow: '0 18px 40px rgba(15, 46, 50, 0.08)' }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1F2937]">📋 Ready to Post</h2>
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

            return (
              <div key={platform} className="mt-3 first:mt-0">
                <h3 className="text-xs font-medium text-[#1F2937] mb-1">{platformName} post</h3>
                <div className="p-3 bg-[#F8F6FF] rounded-xl border border-[#E5E7EB]">
                  <div className="flex items-center justify-between mb-1.5">
                    <PlatformIndicator platform={platformName} isConnected={false} />
                    <span className="text-xs text-[#6B7280]">
                      {t('manualPostingRequired', 'Manual post required')}
                    </span>
                  </div>

                  {photoUrl && (
                    <div className="mb-2">
                      <img
                        src={photoUrl}
                        alt="Post preview"
                        className="w-full max-h-[160px] object-cover rounded-lg border border-[#E5E7EB]"
                      />
                    </div>
                  )}

                  <div className="flex gap-1.5 mb-2">
                    {photoUrl && (
                      <button
                        onClick={downloadPhoto}
                        className="flex-1 px-2 py-2 bg-white border border-[#D1D5DB] text-[#0F2E32] rounded-lg text-xs font-medium hover:bg-[#F9FAFB] flex items-center justify-center gap-1"
                      >
                        <span className="font-bold">1</span>
                        <Download className="w-3 h-3" />
                        <span>{t('manualPostModal.saveImage', 'Gem billede')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(platformName)}
                      className="flex-1 px-2 py-2 bg-white border border-[#D1D5DB] text-[#0F2E32] rounded-lg text-xs font-medium hover:bg-[#F9FAFB] flex items-center justify-center gap-1"
                    >
                      <span className="font-bold">{copyStep}</span>
                      <Copy className="w-3 h-3" />
                      <span>{copiedPlatform === platformName ? t('manualPostModal.copied', 'Kopieret!') : t('manualPostModal.copyText', 'Kopiér tekst')}</span>
                    </button>
                    <button
                      onClick={() => openPlatform(platformName)}
                      className="flex-1 px-2 py-2 bg-[#0F2E32] text-[#88F2D7] rounded-lg text-xs font-medium hover:bg-[#12393D] flex items-center justify-center gap-1"
                    >
                      <span className="font-bold">{photoUrl ? '3' : '2'}</span>
                      <ExternalLink className="w-3 h-3" />
                      <span>{t('manualPostModal.openPlatform', 'Åbn {platform}', { platform: platformName })}</span>
                    </button>
                  </div>

                  <div className="py-2 px-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]" style={{ lineHeight: '1.3' }}>
                    <p className="text-xs text-[#1F2937] whitespace-pre-wrap">{getFormattedContent(platformName)}</p>
                  </div>

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
                </div>
              </div>
            )
          })}

          <div className="mt-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <div className="flex items-start gap-2.5">
              <div className="text-xl">💡</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#1F2937] mb-1">{t('manualPostModal.upsellTitle', 'Want to save time?')}</h3>
                <p className="text-xs text-[#6B7280] mb-2 leading-relaxed">
                  {t('manualPostModal.upsellDescription', 'Connect your platforms to post automatically and track performance.')}
                </p>

                <div className="space-y-1 mb-2.5">
                  <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                    <span className="text-emerald-600">✓</span>
                    <span>{t('manualPostModal.upsellBullet1', 'One-click posting (no copy-paste)')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                    <span className="text-emerald-600">✓</span>
                    <span>{t('manualPostModal.upsellBullet2', 'Automatic performance tracking')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#1F2937]">
                    <span className="text-emerald-600">✓</span>
                    <span>{t('manualPostModal.upsellBullet3', 'AI learns what works for YOUR audience')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onConnectPlatform(platforms[0])}
                    className="px-4 py-2 bg-[#0F2E32] text-[#88F2D7] rounded-lg text-xs font-bold hover:bg-[#12393D] flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {t('manualPostModal.connect', 'Connect {platforms}', {
                      platforms: formattedPlatforms
                    })}
                  </button>
                  <button onClick={onClose} className="px-3 py-2 text-xs text-[#6B7280] hover:text-[#1F2937]">
                    {t('manualPostModal.maybeLater', 'Maybe later')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button onClick={onComplete} className="text-xs text-slate-500 hover:text-slate-700">
              {t('manualPostModal.postedManually', "I've posted manually →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
