/**
 * IdeaPostsFrame - Shows all posts (draft/scheduled/published) for the current idea
 * 
 * This frame displays posts linked to the current idea being edited,
 * regardless of their scheduled date. Shows version history.
 */

import { PostFrame } from '../PostFrame'
import type { LoadedPost } from '../../../hooks/usePosts'

interface IdeaPostsFrameProps {
  ideaPosts: LoadedPost[]
  currentIdeaTitle: string
  onPostClick: (post: LoadedPost) => void
  isLoading: boolean
}

export function IdeaPostsFrame({
  ideaPosts,
  currentIdeaTitle,
  onPostClick,
  isLoading,
}: IdeaPostsFrameProps) {
  // Filter out posts without valid platform labels
  const validPosts = ideaPosts.filter(
    (post) => post.platform && (post.platform === 'facebook' || post.platform === 'instagram')
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-700">
          Opslag for denne idé
        </h4>
        <span className="text-xs text-slate-500">
          {validPosts.length} {validPosts.length === 1 ? 'version' : 'versioner'}
        </span>
      </div>

      {/* Current idea indicator */}
      {currentIdeaTitle && (
        <div className="mb-2 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700">
          <span className="font-semibold">Idé:</span> {currentIdeaTitle}
        </div>
      )}

      {/* Fixed height frame with scroll - Taller to show more idea versions */}
      <div className="h-[250px] overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-cta border-t-transparent rounded-full animate-spin" />
          </div>
        ) : validPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-slate-500 mb-1">Ingen opslag endnu</p>
            <p className="text-xs text-slate-400">
              Dine gemte versioner vil vises her
            </p>
          </div>
        ) : (
          validPosts
            .map((post) => (
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
