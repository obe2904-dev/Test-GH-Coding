import type { TFunction } from 'i18next'

interface ContactPanelProps {
  t: TFunction
  phone: string
  onPhoneChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
  websiteUrl: string
  bookingLink: string
  onBookingLinkChange: (value: string) => void
}

export function ContactPanel({
  t,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  websiteUrl,
  bookingLink,
  onBookingLinkChange
}: ContactPanelProps) {
  return (
    <div className="space-y-4">
      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.phone')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="fx +45 12 34 56 78"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.email')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="fx kontakt@minvirksomhed.dk"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm"
        />
      </div>

      {/* Website URL - Read-only display */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.website')}
        </label>
        <div className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600">
          {websiteUrl || 'Ikke angivet'}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Ændres i analysefeltet øverst
        </p>
      </div>

      {/* Booking Link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('businessProfile.bookingLink')} <span className="text-gray-500 font-normal">(valgfri)</span>
        </label>
        <input
          type="url"
          value={bookingLink}
          onChange={(e) => onBookingLinkChange(e.target.value)}
          placeholder="fx https://booking.dinvirksomhed.dk"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Link hvor kunder kan booke tid eller bord
        </p>
      </div>
    </div>
  )
}
