import type { TFunction } from 'i18next'
import type { WeekSchedule } from '../../../../types/businessProfile'

interface OpeningHoursAndLinksPanelProps {
  t?: TFunction
  openingHours: WeekSchedule
  onOpeningHoursChange: (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => void
  websiteUrl: string
  aboutUsUrl: string
  onAboutUsUrlChange: (value: string) => void
  openingHoursUrl: string
  onOpeningHoursUrlChange: (value: string) => void
  bookingLink: string
  onBookingLinkChange: (value: string) => void
  isPaid: boolean
}

const DAYS = [
  { key: 'man' as const, label: 'Man' },
  { key: 'tir' as const, label: 'Tir' },
  { key: 'ons' as const, label: 'Ons' },
  { key: 'tor' as const, label: 'Tor' },
  { key: 'fre' as const, label: 'Fre' },
  { key: 'lør' as const, label: 'Lør' },
  { key: 'søn' as const, label: 'Søn' }
]

export function OpeningHoursAndLinksPanel({
  t: _t,
  openingHours,
  onOpeningHoursChange,
  websiteUrl,
  aboutUsUrl,
  onAboutUsUrlChange,
  openingHoursUrl,
  onOpeningHoursUrlChange,
  bookingLink,
  onBookingLinkChange,
  isPaid
}: OpeningHoursAndLinksPanelProps) {
  return (
    <div>
      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Opening Hours (1/3 width) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Åbningstider
          </h3>

          <div className="space-y-2">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-[50px_1fr_1fr] gap-2 items-center">
                <label className="text-xs font-medium text-gray-700">{label}</label>
                <input
                  type="time"
                  value={openingHours[key]?.open || ''}
                  onChange={(e) => onOpeningHoursChange(key, 'open', e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-mint"
                />
                <input
                  type="time"
                  value={openingHours[key]?.close || ''}
                  onChange={(e) => onOpeningHoursChange(key, 'close', e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-mint"
                />
              </div>
            ))}
          </div>
          
          <p className="text-[11px] text-gray-500">
            Lad feltet stå tomt for lukkede dage
          </p>

          {/* Opening Hours URL - moved to left column */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Åbningstider side
              <span className="text-gray-500 font-normal ml-1">(valgfri)</span>
            </label>
            <input
              type="url"
              value={openingHoursUrl}
              onChange={(e) => onOpeningHoursUrlChange(e.target.value)}
              placeholder="fx https://dinvirksomhed.dk/aabningstider"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Link til din åbningstider-side
            </p>
          </div>
        </div>

        {/* Right Column: Links (2/3 width) */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Links
          </h3>

          <div className="space-y-3">
            {/* Website - Read-only */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Hjemmeside
              </label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 truncate">
                {websiteUrl || 'Ikke angivet'}
              </div>
            </div>

            {/* About Us URL */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Om os side
                <span className="text-gray-500 font-normal ml-1">(valgfri)</span>
              </label>
              <input
                type="url"
                value={aboutUsUrl}
                onChange={(e) => onAboutUsUrlChange(e.target.value)}
                placeholder="fx https://dinvirksomhed.dk/om-os"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Link til din "Om os" eller "About" side
              </p>
            </div>

            {/* Booking Link - Only for paid tiers */}
            {isPaid && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Booking link
                  <span className="text-gray-500 font-normal ml-1">(valgfri)</span>
                </label>
                <input
                  type="url"
                  value={bookingLink}
                  onChange={(e) => onBookingLinkChange(e.target.value)}
                  placeholder="fx https://book.dinvirksomhed.dk"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Link til dit online booking system
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
