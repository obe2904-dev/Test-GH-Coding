/**
 * EXAMPLE: Weekly Plan Post Card with Timing Badge
 * 
 * Shows how to integrate soft timing context into weekly plan post cards
 */

import { TimingBadge, getTooltipText } from '@/components/timing'

/**
 * OPTION 1: Badge in Card Header
 * Shows timing badge prominently at top of card
 */
export function PostCardWithHeaderBadge({ post }: { post: any }) {
  const { mode, displayText } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle'
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header with timing badge */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{post.title}</h3>
          <p className="text-sm text-gray-500">{post.timing.day} {post.timing.time}</p>
        </div>
        <TimingBadge mode={mode} label={displayText} />
      </div>
      
      {/* Caption preview */}
      <p className="text-sm text-gray-700 line-clamp-2">
        {post.caption.text}
      </p>
      
      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="text-sm text-blue-600 hover:text-blue-700">
          Rediger
        </button>
        <button className="text-sm text-gray-600 hover:text-gray-700">
          Se detaljer
        </button>
      </div>
    </div>
  )
}

/**
 * OPTION 2: Badge in Footer
 * Shows timing badge at bottom of card, less prominent
 */
export function PostCardWithFooterBadge({ post }: { post: any }) {
  const { mode, displayText } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle'
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Visual preview */}
      <div className="aspect-square bg-gray-100">
        {/* Image preview or placeholder */}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-1">{post.title}</h3>
        <p className="text-sm text-gray-500 mb-3">
          {post.timing.day} {post.timing.time}
        </p>
        
        {/* Timing badge in footer */}
        <div className="pt-3 border-t border-gray-100">
          <TimingBadge mode={mode} label={displayText} />
        </div>
      </div>
    </div>
  )
}

/**
 * OPTION 3: Badge with Tooltip (Recommended)
 * Badge on hover shows detailed explanation
 */
export function PostCardWithTooltipBadge({ post }: { post: any }) {
  const { mode, displayText } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle'
  }
  
  const tooltipText = getTooltipText(post.segmentCoverage)
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{post.title}</h3>
          <p className="text-sm text-gray-500">{post.timing.day} {post.timing.time}</p>
        </div>
        
        {/* Badge with native tooltip */}
        <div title={tooltipText}>
          <TimingBadge mode={mode} label={displayText} />
        </div>
      </div>
      
      <p className="text-sm text-gray-700">{post.caption.text}</p>
    </div>
  )
}

/**
 * OPTION 4: Inline Time Label with Icon
 * Very subtle - just adds icon to existing time display
 */
export function PostCardWithInlineIcon({ post }: { post: any }) {
  const icon = post.segmentCoverage?.mode === 'strategic_segment' ? '🎯' : '⚡'
  const label = post.segmentCoverage?.displayText || 'Åbent for alle'
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-2">{post.title}</h3>
      
      {/* Time with inline icon */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <span>{icon}</span>
        <span>{post.timing.day} {post.timing.time}</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-500">{label}</span>
      </div>
      
      <p className="text-sm text-gray-700">{post.caption.text}</p>
    </div>
  )
}

/**
 * OPTION 5: Weekly Plan Grid with Summary
 * Shows all 7 posts in a grid with timing badges + summary at top
 */
export function WeeklyPlanGridWithSummary({ posts }: { posts: any[] }) {
  const targetedCount = posts.filter(
    (p: any) => p.segmentCoverage?.mode === 'strategic_segment'
  ).length
  const broadAppealCount = posts.length - targetedCount
  
  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="font-medium text-gray-900 mb-2">
          Din uge ({posts.length} posts)
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-gray-700">
              {targetedCount} målrettet{targetedCount !== 1 ? 'e' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-gray-700">
              {broadAppealCount} bred appel
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          💡 Blandet strategi — alle tidspunkter er dækket
        </p>
      </div>
      
      {/* Post grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post: any) => (
          <PostCardWithTooltipBadge key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

/**
 * OPTION 6: Compact List View
 * Shows posts in a list with minimal badges
 */
export function WeeklyPlanListView({ posts }: { posts: any[] }) {
  return (
    <div className="space-y-2">
      {posts.map((post: any) => {
        const { mode, displayText } = post.segmentCoverage || {
          mode: 'gap_capacity',
          displayText: 'Åbent for alle'
        }
        const icon = mode === 'strategic_segment' ? '🎯' : '⚡'
        
        return (
          <div 
            key={post.id}
            className="bg-white rounded border border-gray-200 p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {post.title}
                </h4>
                <p className="text-sm text-gray-500">
                  {post.timing.day} {post.timing.time}
                </p>
              </div>
              
              {/* Compact badge */}
              <div className="flex items-center gap-1.5 text-sm text-gray-600 ml-3">
                <span>{icon}</span>
                <span className="whitespace-nowrap">{displayText}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * RECOMMENDED: Card with Header Badge + Tooltip
 * Balance between visibility and information
 */
export function RecommendedPostCard({ post }: { post: any }) {
  const { mode, displayText, reassurance } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle',
    reassurance: 'Bred appel virker godt her'
  }
  
  const tooltipText = getTooltipText(post.segmentCoverage)
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header with badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {post.title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {post.timing.day} {post.timing.time}
          </p>
        </div>
        
        {/* Timing badge with tooltip */}
        <div title={tooltipText} className="flex-shrink-0 ml-3">
          <TimingBadge mode={mode} label={displayText} />
        </div>
      </div>
      
      {/* Caption preview */}
      <p className="text-sm text-gray-700 line-clamp-3 mb-3">
        {post.caption.text}
      </p>
      
      {/* Platform & format */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span className="px-2 py-1 bg-gray-100 rounded">
          {post.platformFormat.platform}
        </span>
        <span className="px-2 py-1 bg-gray-100 rounded">
          {post.platformFormat.format}
        </span>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors">
          Rediger
        </button>
        <button className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors">
          Se detaljer
        </button>
      </div>
    </div>
  )
}
