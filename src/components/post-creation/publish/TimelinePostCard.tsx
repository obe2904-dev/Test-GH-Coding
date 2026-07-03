import type { ReactNode } from 'react'
import { PlatformIndicator } from './PlatformIndicator'

interface TimelinePostCardProps {
  platform: string
  isConnected: boolean
  statusLabel: string
  statusClassName: string
  title: string
  time: string
  thumbnail?: string
  onClick?: () => void
  children?: ReactNode
}

const renderThumbnail = (thumbnail?: string) => (
  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
    {thumbnail ? (
      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
        📷
      </div>
    )}
  </div>
)

export function TimelinePostCard({
  platform,
  isConnected,
  statusLabel,
  statusClassName,
  title,
  time,
  thumbnail,
  onClick,
  children,
}: TimelinePostCardProps) {
  return (
    <div
      className={`relative p-2 bg-white rounded-lg border border-slate-200 ${onClick ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-2 pr-16">
        {renderThumbnail(thumbnail)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PlatformIndicator platform={platform} isConnected={isConnected} />
          </div>

          <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">
            {title}
          </p>
          <p className="text-xs text-slate-500 mb-1">{time}</p>

          {children}
        </div>

        <span
          className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium ${statusClassName}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  )
}