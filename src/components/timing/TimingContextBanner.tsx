/**
 * TIMING CONTEXT BANNER COMPONENT
 * 
 * Displays soft, reassuring timing hints to users when creating posts
 * Used in: GenerateStep, weekly plan editor, scheduling UI
 */

import React from 'react'
import type { TimingContext } from '../../lib/segmentTimingContext'
import { formatContextBanner } from '../../lib/segmentTimingContext'

interface TimingContextBannerProps {
  context: TimingContext
  variant?: 'default' | 'compact' | 'tooltip'
  className?: string
}

export function TimingContextBanner({ 
  context, 
  variant = 'default',
  className = '' 
}: TimingContextBannerProps) {
  const banner = formatContextBanner(context)
  
  if (variant === 'tooltip') {
    return (
      <div className={`text-sm ${className}`}>
        <p className="font-medium">{banner.title}</p>
        <p className="text-gray-600 mt-1">{banner.subtitle}</p>
      </div>
    )
  }
  
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-lg">{banner.icon}</span>
        <span className="text-gray-700">{context.displayText}</span>
      </div>
    )
  }
  
  // Default full banner
  const bgColor = context.mode === 'strategic_segment' 
    ? 'bg-blue-50 border-blue-200' 
    : 'bg-purple-50 border-purple-200'
  
  const textColor = context.mode === 'strategic_segment'
    ? 'text-blue-800'
    : 'text-purple-800'
  
  return (
    <div className={`rounded-lg border p-3 ${bgColor} ${className}`}>
      <div className="flex items-start gap-2">
        <span className="text-xl flex-shrink-0">{banner.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${textColor}`}>
            {banner.title}
          </p>
          <p className={`text-sm mt-1 ${textColor} opacity-80`}>
            {banner.subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Timing Badge Component
 * Small badge for post cards in weekly plan
 */
interface TimingBadgeProps {
  mode: 'strategic_segment' | 'gap_capacity'
  label: string
  className?: string
}

export function TimingBadge({ mode, label, className = '' }: TimingBadgeProps) {
  const icon = mode === 'strategic_segment' ? '🎯' : '⚡'
  const bgColor = mode === 'strategic_segment' 
    ? 'bg-blue-100 text-blue-700' 
    : 'bg-purple-100 text-purple-700'
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${className}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

/**
 * Weekly Plan Summary Component
 * Shows reassuring overview of post mix
 */
interface WeeklyPlanSummaryProps {
  totalPosts: number
  targetedPosts: number
  broadAppealPosts: number
  className?: string
}

export function WeeklyPlanSummary({ 
  totalPosts, 
  targetedPosts, 
  broadAppealPosts,
  className = ''
}: WeeklyPlanSummaryProps) {
  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">Din uge ({totalPosts} posts)</h3>
        <span className="text-sm text-gray-600">Alle tidspunkter dækket</span>
      </div>
      
      <div className="space-y-2">
        {targetedPosts > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">🎯</span>
            <span className="text-gray-700">
              {targetedPosts} målrettet{targetedPosts !== 1 ? 'e' : ''} post{targetedPosts !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {broadAppealPosts > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">⚡</span>
            <span className="text-gray-700">
              {broadAppealPosts} bred appel post{broadAppealPosts !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
        💡 Blandet strategi — begge typer arbejder for dig
      </p>
    </div>
  )
}
