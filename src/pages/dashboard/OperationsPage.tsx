import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'

type DaySchedule = {
  open: string
  close: string
}

type WeekSchedule = {
  man: DaySchedule
  tir: DaySchedule
  ons: DaySchedule
  tor: DaySchedule
  fre: DaySchedule
  lør: DaySchedule
  søn: DaySchedule
}

type TimePeriod = 'morgen' | 'frokost' | 'aften'
type DayKey = keyof WeekSchedule
type PeriodSelection = Record<string, boolean> // "man-morgen": true

const createEmptySchedule = (): WeekSchedule => ({
  man: { open: '', close: '' },
  tir: { open: '', close: '' },
  ons: { open: '', close: '' },
  tor: { open: '', close: '' },
  fre: { open: '', close: '' },
  lør: { open: '', close: '' },
  søn: { open: '', close: '' }
})

const DAY_NAMES: Record<DayKey, string> = {
  man: 'Mandag',
  tir: 'Tirsdag',
  ons: 'Onsdag',
  tor: 'Torsdag',
  fre: 'Fredag',
  lør: 'Lørdag',
  søn: 'Søndag'
}

const PERIOD_NAMES: Record<TimePeriod, string> = {
  morgen: 'Morgen',
  frokost: 'Frokost',
  aften: 'Aften'
}

function OperationsPage() {
  const { t } = useTranslation()
  const currentTier = useTierStore((state) => state.currentTier)

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Opening hours
  const [openingHours, setOpeningHours] = useState<WeekSchedule>(createEmptySchedule())
  const [isEditingHours, setIsEditingHours] = useState(false)

  // Capacity
  const [seatingIndoor, setSeatingIndoor] = useState<string>('')
  const [seatingOutdoor, setSeatingOutdoor] = useState<string>('')
  const [isEditingCapacity, setIsEditingCapacity] = useState(false)

  // Service model
  const [hasTableService, setHasTableService] = useState(false)
  const [hasTakeaway, setHasTakeaway] = useState(false)
  const [hasDelivery, setHasDelivery] = useState(false)
  const [hasOutdoorSeating, setHasOutdoorSeating] = useState(false)
  const [hasWifi, setHasWifi] = useState(false)
  const [hasPowerOutlets, setHasPowerOutlets] = useState(false)
  const [hasParking, setHasParking] = useState(false)
  const [reservationRequired, setReservationRequired] = useState(false)
  const [hasKidsMenu, setHasKidsMenu] = useState(false)
  const [isEditingService, setIsEditingService] = useState(false)

  // Pricing
  const [priceLevel, setPriceLevel] = useState<string>('')
  const [averageCheck, setAverageCheck] = useState<string>('')
  const [currency, setCurrency] = useState('DKK')
  const [isEditingPricing, setIsEditingPricing] = useState(false)

  // Busy/Slow periods
  const [busyPeriods, setBusyPeriods] = useState<PeriodSelection>({})
  const [slowPeriods, setSlowPeriods] = useState<PeriodSelection>({})
  const [isEditingPeriods, setIsEditingPeriods] = useState(false)

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const DAY_NAMES: Record<DayKey, string> = {
    man: t('business.openingHours.monday'),
    tir: t('business.openingHours.tuesday'),
    ons: t('business.openingHours.wednesday'),
    tor: t('business.openingHours.thursday'),
    fre: t('business.openingHours.friday'),
    lør: t('business.openingHours.saturday'),
    søn: t('business.openingHours.sunday')
  }

  const PERIOD_NAMES: Record<TimePeriod, string> = {
    morgen: t('operations.periods.morning'),
    frokost: t('operations.periods.lunch'),
    aften: t('operations.periods.evening')
  }

  useUnsavedChangesPrompt(hasUnsavedChanges, t('common.unsavedChanges'))

  // Manual save only - removed auto-save
  // Users will click Save button to persist changes

  // Load data
  useEffect(() => {
    let isActive = true

    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) return

        const { data: businessData } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!businessData) return
        const bizId = (businessData as any).id
        setBusinessId(bizId)

        // Load operations data
        const { data: opsData } = await (supabase as any)
          .from('business_operations')
          .select('*')
          .eq('business_id', bizId)
          .maybeSingle()

        if (!isActive) return

        if (opsData) {
          // Seating
          setSeatingIndoor(String((opsData as any).seating_capacity_indoor || ''))
          setSeatingOutdoor(String((opsData as any).seating_capacity_outdoor || ''))

          // Service model
          setHasTableService(Boolean((opsData as any).has_table_service))
          setHasTakeaway(Boolean((opsData as any).has_takeaway))
          setHasDelivery(Boolean((opsData as any).has_delivery))
          setHasOutdoorSeating(Boolean((opsData as any).has_outdoor_seating))
          setHasWifi(Boolean((opsData as any).has_wifi))
          setHasPowerOutlets(Boolean((opsData as any).has_power_outlets))
          setHasParking(Boolean((opsData as any).has_parking))
          setReservationRequired(Boolean((opsData as any).reservation_required))
          setHasKidsMenu(Boolean((opsData as any).has_kids_menu))

          // Pricing
          setPriceLevel((opsData as any).price_level || '')
          setAverageCheck(String((opsData as any).average_check_per_person || ''))
          setCurrency((opsData as any).currency || 'DKK')

          // Busy/Slow periods (stored as string arrays)
          const busyArray = (opsData as any).typical_busy_periods || []
          const slowArray = (opsData as any).typical_slow_periods || []

          const busyObj: PeriodSelection = {}
          busyArray.forEach((period: string) => {
            busyObj[period] = true
          })
          setBusyPeriods(busyObj)

          const slowObj: PeriodSelection = {}
          slowArray.forEach((period: string) => {
            slowObj[period] = true
          })
          setSlowPeriods(slowObj)
        }

        // Load opening hours
        const { data: hoursData } = await supabase
          .from('opening_hours')
          .select('*')
          .eq('business_id', bizId)
          .eq('kind', 'normal')

        if (!isActive) return

        if (hoursData && Array.isArray(hoursData) && hoursData.length > 0) {
          const dayMap: Record<string, DayKey> = {
            monday: 'man',
            tuesday: 'tir',
            wednesday: 'ons',
            thursday: 'tor',
            friday: 'fre',
            saturday: 'lør',
            sunday: 'søn'
          }

          const loadedHours = createEmptySchedule()
          hoursData.forEach((row: any) => {
            const key = dayMap[row.weekday]
            if (key) {
              loadedHours[key] = {
                open: row.open_time?.substring(0, 5) || '',
                close: row.close_time?.substring(0, 5) || ''
              }
            }
          })
          setOpeningHours(loadedHours)
        }

        setHasUnsavedChanges(false)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      isActive = false
    }
  }, [])

  const handleSave = async () => {
    if (!businessId) return

    setIsSaving(true)

    try {
      const opsData = {
        business_id: businessId,
        seating_capacity_indoor: seatingIndoor ? parseInt(seatingIndoor) : null,
        seating_capacity_outdoor: seatingOutdoor ? parseInt(seatingOutdoor) : null,
        has_table_service: hasTableService,
        has_takeaway: hasTakeaway,
        has_delivery: hasDelivery,
        has_outdoor_seating: hasOutdoorSeating,
        has_wifi: hasWifi,
        has_power_outlets: hasPowerOutlets,
        has_parking: hasParking,
        reservation_required: reservationRequired,
        has_kids_menu: hasKidsMenu,
        price_level: priceLevel || null,
        average_check_per_person: averageCheck ? parseFloat(averageCheck) : null,
        currency: currency,
        typical_busy_periods: Object.keys(busyPeriods).filter((k) => busyPeriods[k]),
        typical_slow_periods: Object.keys(slowPeriods).filter((k) => slowPeriods[k])
      }

      // Use UPSERT to insert or update
      const { error: upsertError } = await (supabase as any)
        .from('business_operations')
        .upsert(opsData, {
          onConflict: 'business_id'
        })
      
      if (upsertError) {
        console.error('❌ Operations upsert error:', upsertError)
        throw upsertError
      }

      // Save opening hours
      const dayMap: Record<DayKey, string> = {
        man: 'monday',
        tir: 'tuesday',
        ons: 'wednesday',
        tor: 'thursday',
        fre: 'friday',
        lør: 'saturday',
        søn: 'sunday'
      }

      // Delete existing hours
      const { error: deleteError } = await supabase
        .from('opening_hours')
        .delete()
        .eq('business_id', businessId)
        .eq('kind', 'normal')
      
      if (deleteError) {
        console.error('❌ Opening hours delete error:', deleteError)
        throw deleteError
      }

      // Insert new hours
      const hoursToInsert = Object.entries(openingHours)
        .filter(([_, hours]) => hours.open && hours.close)
        .map(([dayKey, hours]) => ({
          business_id: businessId,
          weekday: dayMap[dayKey as DayKey] as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
          kind: 'normal' as const,
          open_time: hours.open,
          close_time: hours.close
        }))

      if (hoursToInsert.length > 0) {
        const { error: insertHoursError } = await supabase
          .from('opening_hours')
          .insert(hoursToInsert)
        
        if (insertHoursError) {
          console.error('❌ Opening hours insert error:', insertHoursError)
          throw insertHoursError
        }
      }

      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      console.log('✅ Operations saved successfully')
    } catch (error) {
      console.error('Error saving operations:', error)
      alert('Kunne ikke gemme ændringer. Tjek konsollen for detaljer.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleHoursChange = (day: DayKey, field: 'open' | 'close', value: string) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
    setHasUnsavedChanges(true)
  }

  const toggleBusyPeriod = (day: DayKey, period: TimePeriod) => {
    const key = `${day}-${period}`
    setBusyPeriods((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
    setHasUnsavedChanges(true)
  }

  const toggleSlowPeriod = (day: DayKey, period: TimePeriod) => {
    const key = `${day}-${period}`
    setSlowPeriods((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
    setHasUnsavedChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">{t('common.loading')}</div>
      </div>
    )
  }

  // Free tier - upgrade prompt
  if (currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{t('operations.title')}</h1>
            <p className="text-sm text-gray-600">{t('operations.subtitle')}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⏰</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{t('operations.upgrade.title')}</h3>
                <p className="text-sm text-gray-600 mb-4">{t('operations.upgrade.description')}</p>
                <button
                  onClick={() => (window.location.href = '/dashboard/plans')}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded font-medium text-sm"
                >
                  {t('operations.upgrade.cta')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{t('operations.title')}</h1>
          <p className="text-sm text-gray-600">{t('operations.subtitle')}</p>
        </div>

        {/* Save button */}
        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              hasUnsavedChanges && !isSaving
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? t('operations.save.saving') : t('operations.save.changes')}
          </button>
          
          {lastSaved && !hasUnsavedChanges && (
            <span className="text-xs text-green-600">
              {t('operations.save.savedAt')} {lastSaved.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {/* Opening Hours */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('business.openingHours.title')}</h3>
                {!isEditingHours && (
                  <p className="text-sm text-gray-600">
                    {Object.entries(openingHours).some(([_, h]) => h.open || h.close)
                      ? Object.entries(openingHours)
                          .filter(([_, h]) => h.open && h.close)
                          .slice(0, 2)
                          .map(([day, h]) => `${DAY_NAMES[day as DayKey]}: ${h.open}-${h.close}`)
                          .join(', ') +
                        (Object.entries(openingHours).filter(([_, h]) => h.open && h.close).length > 2 ? '...' : '')
                      : t('operations.notSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingHours(!isEditingHours)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingHours ? t('common.close') : t('common.edit')}
              </button>
            </div>

            {isEditingHours && (
              <div className="mt-4 pt-4 border-t space-y-2">
                {(Object.keys(openingHours) as DayKey[]).map((day) => (
                  <div key={day} className="grid grid-cols-3 gap-3 items-center">
                    <div className="text-sm font-medium text-gray-700">{DAY_NAMES[day]}</div>
                    <div>
                      <input
                        type="time"
                        value={openingHours[day].open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={openingHours[day].close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seating Capacity */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('operations.capacity.title')}</h3>
                {!isEditingCapacity && (
                  <p className="text-sm text-gray-600">
                    {seatingIndoor || seatingOutdoor
                      ? [
                          seatingIndoor && `Indendørs: ${seatingIndoor}`,
                          seatingOutdoor && `Udendørs: ${seatingOutdoor}`
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : t('operations.notSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingCapacity(!isEditingCapacity)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingCapacity ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingCapacity && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('operations.capacity.indoorLabel')}</label>
                    <input
                      type="number"
                      value={seatingIndoor}
                      onChange={(e) => {
                        setSeatingIndoor(e.target.value)
                        setHasUnsavedChanges(true)
                      }}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('operations.capacity.outdoorLabel')}</label>
                    <input
                      type="number"
                      value={seatingOutdoor}
                      onChange={(e) => {
                        setSeatingOutdoor(e.target.value)
                        setHasUnsavedChanges(true)
                      }}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Service Model */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('operations.service.title')}</h3>
                {!isEditingService && (
                  <p className="text-sm text-gray-600">
                    {[
                      hasTableService && t('operations.service.tableService'),
                      hasTakeaway && t('operations.service.takeaway'),
                      hasDelivery && t('operations.service.delivery'),
                      hasOutdoorSeating && t('operations.service.outdoorSeating'),
                      hasWifi && t('operations.service.wifi'),
                      hasPowerOutlets && t('operations.service.powerOutlets'),
                      hasParking && t('operations.service.parking'),
                      reservationRequired && t('operations.service.reservationRequired'),
                      hasKidsMenu && t('operations.service.kidsMenu')
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('operations.notSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingService(!isEditingService)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingService ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingService && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasTableService}
                    onChange={(e) => {
                      setHasTableService(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.tableService')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasTakeaway}
                    onChange={(e) => {
                      setHasTakeaway(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.takeaway')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasDelivery}
                    onChange={(e) => {
                      setHasDelivery(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.delivery')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasOutdoorSeating}
                    onChange={(e) => {
                      setHasOutdoorSeating(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.outdoorSeating')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasWifi}
                    onChange={(e) => {
                      setHasWifi(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.wifi')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasPowerOutlets}
                    onChange={(e) => {
                      setHasPowerOutlets(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.powerOutlets')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasParking}
                    onChange={(e) => {
                      setHasParking(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.parking')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reservationRequired}
                    onChange={(e) => {
                      setReservationRequired(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.reservationRequired')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasKidsMenu}
                    onChange={(e) => {
                      setHasKidsMenu(e.target.checked)
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t('operations.service.kidsMenu')}</span>
                </label>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('operations.pricing.title')}</h3>
                {!isEditingPricing && (
                  <p className="text-sm text-gray-600">
                    {priceLevel || averageCheck
                      ? [
                          priceLevel && `Niveau: ${priceLevel}`,
                          averageCheck && `Gennemsnit: ${averageCheck} ${currency}`
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : t('operations.notSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingPricing(!isEditingPricing)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingPricing ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingPricing && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('operations.pricing.priceLevel')}</label>
                  <select
                    value={priceLevel}
                    onChange={(e) => {
                      setPriceLevel(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">{t('operations.pricing.selectPlaceholder')}</option>
                    <option value="budget">{t('operations.pricing.options.budget')}</option>
                    <option value="moderate">{t('operations.pricing.options.moderate')}</option>
                    <option value="upscale">{t('operations.pricing.options.upscale')}</option>
                    <option value="luxury">{t('operations.pricing.options.luxury')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('operations.pricing.averageCheck')}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={averageCheck}
                      onChange={(e) => {
                        setAverageCheck(e.target.value)
                        setHasUnsavedChanges(true)
                      }}
                      placeholder="0"
                      min="0"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      value={currency}
                      readOnly
                      className="w-20 px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Busy/Slow Periods */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Travle & Stille Perioder</h3>
                {!isEditingPeriods && (
                  <p className="text-sm text-gray-600">
                    {Object.keys(busyPeriods).filter((k) => busyPeriods[k]).length > 0 ||
                    Object.keys(slowPeriods).filter((k) => slowPeriods[k]).length > 0
                      ? `${Object.keys(busyPeriods).filter((k) => busyPeriods[k]).length} travle, ${
                          Object.keys(slowPeriods).filter((k) => slowPeriods[k]).length
                        } stille`
                      : 'Ikke angivet'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingPeriods(!isEditingPeriods)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingPeriods ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingPeriods && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {/* Busy Periods */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">{t('operations.busy.title')}</h4>
                  <div className="space-y-2">
                    {(Object.keys(openingHours) as DayKey[]).map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-gray-600">{DAY_NAMES[day]}</div>
                        <div className="flex gap-2">
                          {(['morgen', 'frokost', 'aften'] as TimePeriod[]).map((period) => {
                            const key = `${day}-${period}`
                            return (
                              <label key={period} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={busyPeriods[key] || false}
                                  onChange={() => toggleBusyPeriod(day, period)}
                                  className="rounded border-gray-300 text-green-600"
                                />
                                <span className="text-xs text-gray-700">{PERIOD_NAMES[period]}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slow Periods */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">{t('operations.slow.title')}</h4>
                  <div className="space-y-2">
                    {(Object.keys(openingHours) as DayKey[]).map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-gray-600">{DAY_NAMES[day]}</div>
                        <div className="flex gap-2">
                          {(['morgen', 'frokost', 'aften'] as TimePeriod[]).map((period) => {
                            const key = `${day}-${period}`
                            return (
                              <label key={period} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={slowPeriods[key] || false}
                                  onChange={() => toggleSlowPeriod(day, period)}
                                  className="rounded border-gray-300 text-amber-600"
                                />
                                <span className="text-xs text-gray-700">{PERIOD_NAMES[period]}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OperationsPage
