import type { TFunction } from 'i18next'
import type { WeekSchedule } from '../../../../types/businessProfile'
import { QuarterHourTimePicker } from '../../../../components/ui/QuarterHourTimePicker'

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
            <QuarterHourTimePicker className="w-full" value={openingHours[key]?.open || ''} onChange={(value) => onOpeningHoursChange(key, 'open', value)} />
          </div>
          <div>
            <QuarterHourTimePicker className="w-full" value={openingHours[key]?.close || ''} onChange={(value) => onOpeningHoursChange(key, 'close', value)} />
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-500">Tid vælges i 15-minutters intervaller: 00, 15, 30 og 45.</p>

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        💡 Lad felterne stå tomme for lukkede dage
      </p>
    </div>
  )
}
