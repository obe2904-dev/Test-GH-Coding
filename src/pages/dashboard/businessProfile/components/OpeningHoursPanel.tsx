import type { TFunction } from 'i18next'
import type { WeekSchedule } from '../../../../types/businessProfile'

interface OpeningHoursPanelProps {
  t?: TFunction
  openingHours: WeekSchedule
  onOpeningHoursChange: (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => void
}

// day keys are in Danish short form in the data model

export function OpeningHoursPanel({
  t: _t,
  openingHours,
  onOpeningHoursChange
}: OpeningHoursPanelProps) {
  const DAYS = [
    { key: 'man' as const, label: _t ? _t('business.openingHours.monday') : 'Man' },
    { key: 'tir' as const, label: _t ? _t('business.openingHours.tuesday') : 'Tir' },
    { key: 'ons' as const, label: _t ? _t('business.openingHours.wednesday') : 'Ons' },
    { key: 'tor' as const, label: _t ? _t('business.openingHours.thursday') : 'Tor' },
    { key: 'fre' as const, label: _t ? _t('business.openingHours.friday') : 'Fre' },
    { key: 'lør' as const, label: _t ? _t('business.openingHours.saturday') : 'Lør' },
    { key: 'søn' as const, label: _t ? _t('business.openingHours.sunday') : 'Søn' }
  ]
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {_t ? _t('business.openingHours.title') : 'Åbningstider'}
      </h3>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <input
              type="time"
              value={openingHours[key]?.open || ''}
              onChange={(e) => onOpeningHoursChange(key, 'open', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#88F2D7]"
            />
            <input
              type="time"
              value={openingHours[key]?.close || ''}
              onChange={(e) => onOpeningHoursChange(key, 'close', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#88F2D7]"
            />
          </div>
        ))}
      </div>
      
      <p className="text-[11px] text-gray-500">{_t ? _t('business.openingHours.emptyHint') : 'Lad feltet stå tomt for lukkede dage'}</p>
    </div>
  )
}
