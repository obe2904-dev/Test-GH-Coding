// src/features/scheduleIdeas/index.tsx
// Offline stub for post scheduling suggestions

export type SchedulePriority = 'high' | 'medium' | 'low'

export interface ScheduleSuggestion {
  id: string
  icon: (props: { className?: string }) => JSX.Element // React component
  date: string // e.g. "Today", "Tomorrow", or date string
  time: string // e.g. "14:00"
  reasoning: string // Why this time is suggested
  priority: SchedulePriority // For frame color
}

// Subtle icon components for schedule suggestions
export const Sun = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

export const Users = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

export const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

export function generateScheduleSuggestions(): ScheduleSuggestion[] {
  return [
    {
      id: 'schedule-1',
      icon: Sun,
      date: 'Today',
      time: '18:00',
      reasoning: 'Peak engagement for your audience after work hours.',
      priority: 'high',
    },
    {
      id: 'schedule-2',
      icon: Users,
      date: 'Tomorrow',
      time: '09:00',
      reasoning: 'Morning posts catch early risers and commuters.',
      priority: 'medium',
    },
    {
      id: 'schedule-3',
      icon: TrendingUp,
      date: 'Tomorrow',
      time: '23:00',
      reasoning: 'Late night posts have lower reach but may suit niche audiences.',
      priority: 'low',
    },
  ]
}
