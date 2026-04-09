import type { WeeklyContentPlan } from '../../types/weekly-plan'

interface PlanContextStripProps {
  plan: WeeklyContentPlan
  currentIndex: number
  sessionDoneIndices: number[]
  onBack: () => void
  onSwitchPost: (rawIndex: number) => void
  onNewPost?: () => void // Exit Weekly Plan flow and start a fresh Hurtigt Opslag
}

// Danish short day name from ISO date string (avoids UTC shift)
function shortDayDanish(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const names = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  return names[date.getDay()]
}

function dayOfMonth(dateStr: string): number {
  const [, , d] = dateStr.split('-').map(Number)
  return d
}

export function PlanContextStrip({
  plan,
  currentIndex,
  sessionDoneIndices,
  onBack,
  onSwitchPost,
  onNewPost,
}: PlanContextStripProps) {
  // Build sorted list preserving raw indices
  const sortedPosts = plan.posts
    .map((post, rawIndex) => ({ post, rawIndex }))
    .sort(
      (a, b) =>
        new Date(`${a.post.timing.date}T00:00:00`).getTime() -
        new Date(`${b.post.timing.date}T00:00:00`).getTime()
    )

  const currentPost = plan.posts[currentIndex]

  return (
    <div className="bg-cta-surface border border-cta-surface rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-semibold text-cta-text hover:text-cta-text shrink-0 transition-colors"
        title="Tilbage til ugeplanen"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Ugeplanen
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-cta-surface shrink-0" />

      {/* Post chips */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        {sortedPosts.map(({ post, rawIndex }) => {
          const isActive = rawIndex === currentIndex
          const isDone = sessionDoneIndices.includes(rawIndex)

          let chipClass =
            'inline-flex flex-col items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer '

          if (isActive) {
            chipClass +=
              'bg-cta text-white border-cta shadow-sm ring-2 ring-cta ring-offset-1'
          } else if (isDone) {
            chipClass +=
              'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
          } else {
            chipClass +=
              'bg-white text-slate-600 border-slate-200 hover:bg-cta-surface hover:border-cta hover:text-cta-text'
          }

          return (
            <button
              key={rawIndex}
              onClick={() => !isActive && onSwitchPost(rawIndex)}
              className={chipClass}
              title={`${shortDayDanish(post.timing.date)} ${dayOfMonth(post.timing.date)}: ${post.contentSubject.dish}`}
            >
              <span>{shortDayDanish(post.timing.date)}</span>
              <span className="leading-none">
                {isDone && !isActive ? '✓' : dayOfMonth(post.timing.date)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Current post subject (right label) */}
      {currentPost && (
        <div
          className="text-[11px] text-cta-text font-medium truncate max-w-[140px] shrink-0"
          title={currentPost.contentSubject.dish}
        >
          {currentPost.contentSubject.dish}
        </div>
      )}

      {/* Divider + Exit to Hurtigt Opslag */}
      {onNewPost && (
        <>
          <div className="w-px h-4 bg-cta-surface shrink-0" />
          <button
            onClick={onNewPost}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 shrink-0 transition-colors"
            title="Start et nyt opslag uden for ugeplanen"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Hurtigt opslag
          </button>
        </>
      )}
    </div>
  )
}
