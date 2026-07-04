/**
 * PostFrame - Timeline card for a single post (draft, scheduled, or published)
 * 
 * Displays a uniform frame in the Opslags Tidslinje with status badges:
 * - "Udkast" (pale yellow/orange) - status='draft'
 * - "Planlagt" (pale green border, white fill) - status='scheduled', future
 * - "Udgivet" (pale green solid) - status='published', past
 */

import { Calendar } from 'lucide-react'

export type PostStatus = 'udkast' | 'planlagt' | 'udgivet'
export type Platform = 'facebook' | 'instagram'

interface PostFrameProps {
  id: string
  platform: Platform
  status: PostStatus
  text: string
  photoUrl?: string | null
  scheduledAt?: string | null  // ISO datetime
  onClick: () => void
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  facebook: <span className="h-3 w-3 rounded-full bg-[#1877F2]" aria-hidden="true" />,
  instagram: <span className="h-3 w-3 rounded-full bg-[#E4405F]" aria-hidden="true" />,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: 'text-black',
  instagram: 'text-black',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
}

const STATUS_STYLES: Record<PostStatus, { bg: string; text: string; border?: string }> = {
  udkast: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  planlagt: {
    bg: 'bg-white',
    text: 'text-green-700',
    border: 'border-green-500',
  },
  udgivet: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
}

const STATUS_LABELS: Record<PostStatus, string> = {
  udkast: 'Udkast',
  planlagt: 'Planlagt',
  udgivet: 'Udgivet',
}

export function PostFrame({ id, platform, status, text, photoUrl, scheduledAt, onClick }: PostFrameProps) {
  const styles = STATUS_STYLES[status]
  const platformIcon = PLATFORM_ICONS[platform]
  const platformColor = PLATFORM_COLORS[platform]

  const formattedTime = scheduledAt
    ? new Date(scheduledAt).toLocaleString('da-DK', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 ${styles.border} ${styles.bg} hover:shadow-md transition-all cursor-pointer group`}
    >
      {/* Header: Platform + Status Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 font-semibold ${platformColor}`}>
          {platformIcon}
          <span className="text-sm">{PLATFORM_LABELS[platform]}</span>
        </div>
        
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${styles.bg} ${styles.text} border ${styles.border}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Preview: Photo + Text */}
      <div className="flex gap-3 mb-3">
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Post preview"
            className="w-16 h-16 rounded object-cover flex-shrink-0"
          />
        )}
        <p className="text-sm text-slate-700 line-clamp-3 flex-1">
          {text || <span className="italic text-slate-400">Ingen tekst endnu</span>}
        </p>
      </div>

      {/* Footer: Scheduled Time */}
      {formattedTime && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedTime}</span>
        </div>
      )}

      {/* Hover indicator */}
      <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
        Klik for at {status === 'udgivet' ? 'se' : 'redigere'} →
      </div>
    </button>
  )
}
