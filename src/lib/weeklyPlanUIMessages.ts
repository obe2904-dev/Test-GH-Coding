/**
 * WEEKLY PLAN UI MESSAGES
 * 
 * Soft, reassuring language for displaying timing context in weekly plans
 * Philosophy: All times are good. Some are targeted, some are broad appeal.
 * Never create hierarchy or anxiety.
 */

export interface WeeklyPlanSummary {
  totalPosts: number
  targetedPosts: number
  broadAppealPosts: number
}

/**
 * Get reassuring summary message for weekly plan overview
 */
export function getWeeklyPlanSummaryMessage(summary: WeeklyPlanSummary): string {
  const { totalPosts, targetedPosts, broadAppealPosts } = summary
  
  if (targetedPosts === 0) {
    return `${totalPosts} posts med bred appel — dækker alle åbningstider godt`
  }
  
  if (broadAppealPosts === 0) {
    return `${totalPosts} målrettede posts — fokuseret på dine peak-tider`
  }
  
  return `${totalPosts} posts: ${targetedPosts} målrettede, ${broadAppealPosts} bred appel — alle tidspunkter er dækket`
}

/**
 * Get comfort footer message for weekly plan
 */
export function getWeeklyPlanFooter(): string {
  return '💡 Alle tider er gode postetider — blandet strategi fylder hele ugen'
}

/**
 * Get help text for timing strategy
 */
export function getTimingStrategyHelpText(): string {
  return `Sådan fungerer tidstilpasning:

Din restaurant har naturlige kunde-mønstre gennem ugen:

🎯 Peak-tider (vennegrupper fredag, familier weekend)
   → Målrettet indhold til den gruppe

⚡ Åbne tider (frokost, hverdagsaftener)  
   → Bred appel: AYCE værdi, beliggenhed, variation

Begge tilgange fylder dit restaurant — bare på forskellige måder. 
Vi sørger for, at dit indhold passer til hvem der ser det, hvornår de ser det.`
}

/**
 * Get scheduling calendar footer message
 */
export function getSchedulingCalendarFooter(): string {
  return '💡 Alle tider er gode — vi guider dig til hvad der passer bedst'
}

/**
 * Get day label with timing context
 */
export function getDayLabel(
  day: string,
  hasStrategicSegment: boolean,
  segmentLabel?: string
): string {
  if (hasStrategicSegment && segmentLabel) {
    return `${day}: ${segmentLabel} (stærkt valg)`
  }
  return `${day}: Åbent for alle`
}

/**
 * Post type labels (soft language)
 */
export const POST_TYPE_LABELS = {
  strategic: {
    short: 'Målrettet',
    long: 'Målrettet indhold',
    icon: '🎯'
  },
  broadAppeal: {
    short: 'Bred appel',
    long: 'Bred appel',
    icon: '⚡'
  }
} as const

/**
 * Analytics section messages (no percentages, just patterns)
 */
export const ANALYTICS_MESSAGES = {
  targetedPerformance: 'Stærk respons når tiden matcher',
  broadAppealPerformance: 'Solidt engagement hele ugen',
  bothContribute: 'Begge typer bidrager til din synlighed — forskellige styrker'
} as const

/**
 * Reassuring phrases for different contexts
 */
export const REASSURANCE_PHRASES = {
  mondayLunch: 'Frokost er perfekt til bred appel — AYCE værdi trækker godt her',
  fridayEvening: 'Fredag aften er vennegruppe-tid — målrettet indhold virker stærkt',
  weekendFamily: 'Weekend familietid — målrettet indhold passer perfekt',
  allTimesCovered: 'Din uge blander målrettet og bred appel — alle tider er dækket',
  noWastedPosts: 'Alle posts arbejder for dig — forskellige tidspunkter, forskellige styrker'
} as const

/**
 * Get day-specific reassurance
 */
export function getDayReassurance(
  dayName: string,
  hour: number,
  hasSegment: boolean
): string {
  if (hasSegment) {
    if (dayName === 'Fredag' && hour >= 18) {
      return REASSURANCE_PHRASES.fridayEvening
    }
    if ((dayName === 'Lørdag' || dayName === 'Søndag') && hour >= 17 && hour < 21) {
      return REASSURANCE_PHRASES.weekendFamily
    }
    return 'Målrettet indhold til peak-tid — stærkt valg'
  } else {
    if (hour >= 11 && hour < 17) {
      return REASSURANCE_PHRASES.mondayLunch
    }
    return 'Bred appel fylder tiden godt — solidt valg'
  }
}

/**
 * Format timing badge for post card
 */
export function formatTimingBadge(
  mode: 'strategic_segment' | 'gap_capacity',
  label: string
): { icon: string; text: string } {
  return {
    icon: mode === 'strategic_segment' ? '🎯' : '⚡',
    text: label
  }
}

/**
 * Get onboarding message
 */
export function getOnboardingMessage(): string {
  return 'Vi tilpasser indhold til tiden, så du altid taler til de rigtige mennesker på det rigtige tidspunkt'
}

/**
 * Tooltip templates for different UI contexts
 */
export const TOOLTIP_TEMPLATES = {
  strategicPost: (target: string) => 
    `${target}\nVi ved, de kommer — så vi taler direkte til dem`,
  
  broadAppealPost: () =>
    `Åbent for alle\nVi fokuserer på det der trækker bredt:\nværdi, beliggenhed og variation`,
  
  weeklyOverview: (targeted: number, broad: number) =>
    `Din uge blander ${targeted} målrettede og ${broad} bred appel posts\nAlle tider er dækket godt`
} as const
