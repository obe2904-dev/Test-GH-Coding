import type { TFunction } from 'i18next'
import type { WeekSchedule } from '../../../../types/businessProfile'

interface OpeningHoursSimplePanelProps {
  t: TFunction
  openingHours: WeekSchedule
  onOpeningHoursChange: (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => void
}

const DAYS = [
  { key: 'man' as const, label: 'Mandag' },
  { key: 'tir' as const, label: 'Tirsdag' },
  { key: 'ons' as const, label: 'Onsdag' },
  { key: 'tor' as const, label: 'Torsdag' },
  { key: 'fre' as const, label: 'Fredag' },
  { key: 'lør' as const, label: 'Lørdag' },
  { key: 'søn' as const, label: 'Søndag' }
]

export function OpeningHoursSimplePanel({
  t,
  openingHours,
  onOpeningHoursChange
}: OpeningHoursSimplePanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        {t('businessProfile.openingHoursHelp')}
      </p>

      {DAYS.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div>
            <input
              type="time"
              value={openingHours[key]?.open || ''}
              onChange={(e) => onOpeningHoursChange(key, 'open', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Åbner"
            />
          </div>
          <div>
            <input
              type="time"
              value={openingHours[key]?.close || ''}
              onChange={(e) => onOpeningHoursChange(key, 'close', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Lukker"
            />
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        💡 Lad felterne stå tomme for lukkede dage
      </p>
    </div>
  )
}
