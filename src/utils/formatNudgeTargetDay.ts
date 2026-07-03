// Utility function to format booking nudge target day in Danish
// Used by WeeklyPlanOverview to display booking nudge context

export function formatNudgeTargetDay(peakDay: string, leadDaysUsed?: number | null): string {
  const date = new Date(peakDay + 'T00:00:00')
  
  const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  
  const dayName = dayNames[date.getDay()]
  const dayNum = date.getDate()
  const monthName = monthNames[date.getMonth()]
  
  const dateStr = `${dayName} d. ${dayNum}. ${monthName}`
  const leadStr = leadDaysUsed ? ` · ${leadDaysUsed} dages forspring` : ''
  
  return `${dateStr}${leadStr}`
}
