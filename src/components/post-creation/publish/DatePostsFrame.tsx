/**
 * DatePostsFrame - Shows scheduled and published posts for a selected calendar date
 * 
 * This frame displays posts scheduled for a specific date,
 * updating when the user clicks different dates in the calendar.
 */

import { PostFrame } from '../PostFrame'
import type { LoadedPost } from '../../../hooks/usePosts'

interface DatePostsFrameProps {
  datePosts: LoadedPost[]
  selectedDate: Date | null
  locale: string
  onPostClick: (post: LoadedPost) => void
  isLoading: boolean
}

export function DatePostsFrame({
  datePosts,
  selectedDate,
  locale,
  onPostClick,
  isLoading,
}: DatePostsFrameProps) {
  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-700">
          Opslag for {formattedDate || 'valgt dato'}
        </h4>
        <span className="text-xs text-slate-500">
          {datePosts.length} {datePosts.length === 1 ? 'opslag' : 'opslag'}
        </span>
      </div>

      {/* Fixed height frame with scroll */}
      <div className="h-[280px] overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-cta border-t-transparent rounded-full animate-spin" />
          </div>
        ) : datePosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-slate-500 mb-1">Ingen opslag denne dag</p>
            <p className="text-xs text-slate-400">
              Klik på andre datoer i kalenderen for at se opslag
            </p>
          </div>
        ) : (
          datePosts.map((post) => (
            <PostFrame
              key={post.id}
              id={post.id}
              platform={post.platform as 'facebook' | 'instagram'}
              status={
                post.status === 'draft'
                  ? 'udkast'
                  : post.status === 'scheduled'
                  ? 'planlagt'
                  : 'udgivet'
              }
              text={post.postText ?? ''}
              photoUrl={post.photoUrl}
              scheduledAt={post.scheduledFor ?? post.postedAt ?? null}
              onClick={() => onPostClick(post)}
            />
          ))
        )}
      </div>
    </div>
  )
}
