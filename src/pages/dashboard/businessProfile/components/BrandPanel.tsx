import type { TFunction } from 'i18next'

interface BrandPanelProps {
  t?: TFunction
  aboutText: string
  onAboutTextChange: (value: string) => void
  brandVoice: string
  onBrandVoiceChange: (value: string) => void
  targetAudience: string
  onTargetAudienceChange: (value: string) => void
  bookingLink: string
  onBookingLinkChange: (value: string) => void
  ctaPreference: string
  onCtaPreferenceChange: (value: string) => void
}

export function BrandPanel({
  t: _t,
  aboutText,
  onAboutTextChange,
  brandVoice,
  onBrandVoiceChange,
  targetAudience,
  onTargetAudienceChange,
  bookingLink,
  onBookingLinkChange,
  ctaPreference,
  onCtaPreferenceChange
}: BrandPanelProps) {
  return (
    <div className="space-y-6">
      {/* Brand Identity Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Brand & Kommunikation
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Om din virksomhed
            </label>
            <textarea
              value={aboutText}
              onChange={(event) => onAboutTextChange(event.target.value)}
              placeholder="Fortæl kort om din virksomhed..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Brand tone
              </label>
              <input
                type="text"
                value={brandVoice}
                onChange={(event) => onBrandVoiceChange(event.target.value)}
                placeholder="fx venlig, professionel, casual..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Målgruppe
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(event) => onTargetAudienceChange(event.target.value)}
                placeholder="fx familier, unge, lokale..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Call-to-Action tekst
              </label>
              <input
                type="text"
                value={ctaPreference}
                onChange={(event) => onCtaPreferenceChange(event.target.value)}
                placeholder="fx Book bord nu, Se menuen..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Booking link
              </label>
              <input
                type="url"
                value={bookingLink}
                onChange={(event) => onBookingLinkChange(event.target.value)}
                placeholder="fx https://dinvirksomhed.dk/book"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#88F2D7]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
