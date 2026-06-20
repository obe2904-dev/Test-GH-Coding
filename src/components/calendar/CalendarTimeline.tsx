import { PublishedPost } from '../../hooks/usePublishedPosts'

interface CalendarTimelineProps {
  posts: PublishedPost[]
  isConnected: (platform: string) => boolean
  onPostClick?: (post: PublishedPost) => void
  scrollToDate?: Date | null
}

function platformColor(platform: string): string {
  const p = platform.toLowerCase()
  if (p === 'facebook') return 'bg-blue-500'
  if (p === 'instagram') return 'bg-pink-500'
  return 'bg-slate-400'
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('da-DK', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  })
}

function titleFromPost(p: PublishedPost): string {
  return p.menuItemName || p.contentType || 'Opslag'
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 7) return `om ${diffDays} dage`
  if (diffDays > 1) return `om ${diffDays} dage`
  if (diffDays === 1) return 'i morgen'
  if (diffHours > 1) return `om ${diffHours} timer`
  if (diffHours === 1) return 'om 1 time'
  if (diffMins > 1) return `om ${diffMins} min`
  if (diffMins > 0) return 'snart'
  
  // Past
  const absDays = Math.abs(diffDays)
  const absHours = Math.abs(diffHours)
  
  if (absDays > 7) return `${absDays} dage siden`
  if (absDays > 1) return `${absDays} dage siden`
  if (absDays === 1) return 'i går'
  if (absHours > 1) return `${absHours} timer siden`
  if (absHours === 1) return '1 time siden'
  
  return 'for nylig'
}

export function CalendarTimeline({ 
  posts, 
  isConnected, 
  onPostClick 
}: CalendarTimelineProps) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  // Sort all posts by date (oldest to newest for past, newest to oldest for future)
  const pastPosts = posts
    .filter(p => {
      const postDate = p.scheduledFor ?? p.postedAt
      return postDate < todayStart
    })
    .sort((a, b) => {
      const dateA = a.scheduledFor ?? a.postedAt
      const dateB = b.scheduledFor ?? b.postedAt
      return dateB.getTime() - dateA.getTime() // newest first for past
    })
    .slice(0, 10) // Only show last 10 past posts

  const futurePosts = posts
    .filter(p => {
      const postDate = p.scheduledFor ?? p.postedAt
      return postDate >= todayEnd
    })
    .sort((a, b) => {
      const dateA = a.scheduledFor ?? a.postedAt
      const dateB = b.scheduledFor ?? b.postedAt
      return dateA.getTime() - dateB.getTime() // oldest first for future
    })

  const todayPosts = posts
    .filter(p => {
      const postDate = p.scheduledFor ?? p.postedAt
      return postDate >= todayStart && postDate < todayEnd
    })
    .sort((a, b) => {
      const dateA = a.scheduledFor ?? a.postedAt
      const dateB = b.scheduledFor ?? b.postedAt
      return dateA.getTime() - dateB.getTime()
    })

  const renderPost = (post: PublishedPost, isPast: boolean) => {
    const postDate = post.scheduledFor ?? post.postedAt
    const isScheduled = post.status === 'scheduled'
    const needsManual = isScheduled && !isConnected(post.platform.toLowerCase())
    
    return (
      <div
        key={post.id}
        onClick={() => onPostClick?.(post)}
        className={`p-3 rounded-lg border transition-all ${
          isScheduled
            ? 'bg-purple-50 border-purple-200 hover:border-purple-400 cursor-pointer'
            : 'bg-white border-slate-200'
        } ${needsManual ? 'border-amber-300 bg-amber-50' : ''}`}
      >
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
            {post.photoUrl ? (
              <img src={post.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                📝
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Platform & Status */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full ${platformColor(post.platform)}`} />
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                {post.platform}
              </span>
              
              {isScheduled && (
                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                  planlagt
                </span>
              )}
              
              {needsManual && (
                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  ⚠️ Manuel
                </span>
              )}
            </div>

            {/* Title */}
            <p className="text-xs font-semibold text-slate-900 line-clamp-1 mb-0.5">
              {titleFromPost(post)}
            </p>

            {/* Date & Time */}
            <div className="text-[10px] text-slate-500 flex items-center gap-2">
              <span>{formatDate(postDate)}</span>
              <span>•</span>
              <span>{formatTime(postDate)}</span>
              {!isPast && isScheduled && (
                <>
                  <span>•</span>
                  <span className="text-purple-600 font-medium">
                    🕐 {getRelativeTime(postDate)}
                  </span>
                </>
              )}
            </div>

            {/* Snippet */}
            {post.postText && (
              <p className="text-[10px] text-slate-600 line-clamp-2 mt-1">
                {post.postText}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {/* Past Posts */}
        {pastPosts.length > 0 && (
          <>
            {pastPosts.map(post => renderPost(post, true))}
          </>
        )}

        {/* Today Divider */}
        <div className="flex items-center gap-3 py-3">
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent flex-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 rounded-full">
            <span className="text-xs font-bold text-indigo-700">I DAG</span>
            <span className="text-xs text-indigo-600">
              {new Date().toLocaleDateString('da-DK', { 
                day: 'numeric', 
                month: 'short' 
              })}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent flex-1" />
        </div>

        {/* Today's Posts */}
        {todayPosts.length > 0 && (
          <>
            {todayPosts.map(post => renderPost(post, false))}
          </>
        )}

        {todayPosts.length === 0 && (
          <div className="py-6 text-center">
            <div className="text-2xl mb-2">📅</div>
            <p className="text-xs text-slate-500">Ingen opslag i dag</p>
          </div>
        )}

        {/* Future Posts */}
        {futurePosts.length > 0 && (
          <div className="space-y-2 mt-2">
            <div className="px-2 py-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Kommende
              </p>
            </div>
            {futurePosts.map(post => renderPost(post, false))}
          </div>
        )}

        {futurePosts.length === 0 && pastPosts.length === 0 && todayPosts.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-medium text-slate-700">Ingen opslag endnu</p>
            <p className="text-xs text-slate-500 mt-1">Opret dit første opslag for at se det her</p>
          </div>
        )}
      </div>
    </div>
  )
}
