export type WeekdayKey = 'man' | 'tir' | 'ons' | 'tor' | 'fre' | 'lør' | 'søn'

export type DaySchedule = {
  open: string
  close: string
} & Record<string, string>

export type WeekSchedule = {
  [K in WeekdayKey]: DaySchedule
} & Record<string, DaySchedule>

export const createEmptyWeekSchedule = (): WeekSchedule => ({
  man: { open: '', close: '' },
  tir: { open: '', close: '' },
  ons: { open: '', close: '' },
  tor: { open: '', close: '' },
  fre: { open: '', close: '' },
  lør: { open: '', close: '' },
  søn: { open: '', close: '' }
})
