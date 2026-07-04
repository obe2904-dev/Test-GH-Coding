/**
 * PostFrame - Compact timeline card for a single post (draft, scheduled, or published)
 *
 * Left accent stripe encodes status colour. Uniform compact height regardless of status.
 * Click opens a pop-up with full post details.
 *
 * Statuses:
 * - "Udkast"   → amber accent
 * - "Planlagt" → green accent
 * - "Udgivet"  → blue accent (slightly muted opacity)
 *
 * Special States:
 * - "selected" → adds purple glow ring to distinguish draft being edited
 */

import { Calendar, Clock, Image as ImageIcon, Eye, Heart, MessageCircle, Share2 } from 'lucide-react'

export type PostStatus = 'udkast' | 'planlagt' | 'udgivet'
export type Platform = 'facebook' | 'instagram'

interface PostFrameProps {
  id: string
  platform: Platform
  status: PostStatus
  headline?: string | null   // Short title / first sentence used as card headline
  text: string
  photoUrl?: string | null
  scheduledAt?: string | null  // ISO datetime
  onClick: () => void
  isSelected?: boolean  // Whether this is the currently selected/editing post
  engagement?: {
    views?: number
    likes?: number
    comments?: number
    shares?: number
  }
}

// ─── Platform ────────────────────────────────────────────────────────────────

const PLATFORM_DOT: Record<Platform, string> = {
  facebook:  'bg-[#1877F2]',
  instagram: 'bg-[#E4405F]',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
}

// ─── Status ───────────────────────────────────────────────────────────────────

const STATUS_ACCENT: Record<PostStatus, string> = {
  udkast:   'border-l-amber-400',
  planlagt: 'border-l-green-500',
  udgivet:  'border-l-blue-400',
}

const STATUS_PILL: Record<PostStatus, { bg: string; text: string; border: string }> = {
  udkast: {
    bg:     'bg-amber-50',
    text:   'text-amber-800',
    border: 'border-amber-300',
  },
  planlagt: {
    bg:     'bg-green-50',
    text:   'text-green-800',
    border: 'border-green-400',
  },
  udgivet: {
    bg:     'bg-blue-50',
    text:   'text-blue-800',
    border: 'border-blue-300',
  },
}

const STATUS_LABELS: Record<PostStatus, string> = {
  udkast:   'Udkast',
  planlagt: 'Planlagt',
  udgivet:  'Udgivet',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a short headline from the first non-empty line of text */
function deriveHeadline(text: string): string {
  const first = text.split('\n').find(l => l.trim().length > 0) ?? ''
  return first.length > 60 ? first.slice(0, 60) + '…' : first
}

/** Extract a preview line — the second non-empty line, or the tail of the first */
function derivePreview(text: string, headline: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const preview = lines.length > 1 ? lines[1] : text.slice(headline.replace('…', '').length).trim()
  return preview.length > 80 ? preview.slice(0, 80) + '…' : preview
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PostFrame({
  id,
  platform,
  status,
  headline,
  text,
  photoUrl,
  scheduledAt,
  onClick,
  isSelected = false,
  engagement,
}: PostFrameProps) {
  const pill = STATUS_PILL[status]

  const displayHeadline = headline ?? deriveHeadline(text)
  const displayPreview  = derivePreview(text, displayHeadline)

  const formattedTime = scheduledAt
    ? new Date(scheduledAt).toLocaleString('da-DK', {
        day:    'numeric',
        month:  'short',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left',
        'flex gap-3 items-start',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700 border-l-[3px]',
        STATUS_ACCENT[status],
        'rounded-lg',
        'px-3 py-2.5',
        'hover:bg-slate-50 dark:hover:bg-slate-800',
        'transition-all duration-150',
        status === 'udgivet' ? 'opacity-80' : '',
        // Subtle purple glow for selected posts
        isSelected ? 'ring-2 ring-purple-400 ring-offset-1' : '',
      ].join(' ')}
    >
      {/* ── Thumbnail ── */}
      <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Post preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0">

        {/* Row 1: platform dot + name · status pill */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${PLATFORM_DOT[platform]}`}
              aria-hidden="true"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {PLATFORM_LABELS[platform]}
            </span>
          </div>

          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${pill.bg} ${pill.text} ${pill.border}`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        {/* Row 2: headline */}
        {displayHeadline ? (
          <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate leading-snug mb-0.5">
            {displayHeadline}
          </p>
        ) : (
          <p className="text-[13px] italic text-slate-400 truncate leading-snug mb-0.5">
            Ingen tekst endnu
          </p>
        )}

        {/* Row 3: preview line */}
        {displayPreview && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-snug mb-1">
            {displayPreview}
          </p>
        )}

        {/* Row 4: time */}
        <div className="flex items-center gap-1 mt-1">
          {formattedTime ? (
            <>
              <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-slate-400">{formattedTime}</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-slate-400">Ikke planlagt endnu</span>
            </>
          )}
        </div>

        {/* Row 5: engagement metrics (published posts only) */}
        {status === 'udgivet' && engagement && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {engagement.views !== undefined && (
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <span className="text-[11px] text-slate-500">{engagement.views}</span>
              </div>
            )}
            {engagement.likes !== undefined && (
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <span className="text-[11px] text-slate-500">{engagement.likes}</span>
              </div>
            )}
            {engagement.comments !== undefined && (
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <span className="text-[11px] text-slate-500">{engagement.comments}</span>
              </div>
            )}
            {engagement.shares !== undefined && (
              <div className="flex items-center gap-1">
                <Share2 className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <span className="text-[11px] text-slate-500">{engagement.shares}</span>
              </div>
            )}
          </div>
        )}

      </div>
    </button>
  )
}
