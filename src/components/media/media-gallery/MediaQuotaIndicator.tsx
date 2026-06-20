/**
 * MediaQuotaIndicator Component
 * 
 * Visual storage quota indicator with:
 * - Progress bar by tier
 * - Used/total display
 * - Warning states (>90%, 100%)
 * - Upgrade prompt for free tier
 */

import type { StorageQuota } from '../../../api/mediaLibrary'

interface MediaQuotaIndicatorProps {
  quota: StorageQuota | null
  isLoading?: boolean
  onUpgrade?: () => void
  showDetails?: boolean
  compact?: boolean
}

export function MediaQuotaIndicator({
  quota,
  isLoading = false,
  onUpgrade,
  showDetails = true,
  compact = false,
}: MediaQuotaIndicatorProps) {
  if (isLoading || !quota) {
    return (
      <div className={`bg-white rounded-lg ${compact ? 'p-2' : 'p-4'} border border-gray-200`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const tierNames = {
    free: 'Free',
    standardplus: 'Standard Plus',
    premium: 'Premium',
  }

  const getProgressColor = () => {
    if (quota.isOverLimit) return 'bg-red-500'
    if (quota.isNearLimit) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const getTextColor = () => {
    if (quota.isOverLimit) return 'text-red-600'
    if (quota.isNearLimit) return 'text-yellow-600'
    return 'text-gray-700'
  }

  return (
    <div className={`bg-white rounded-lg ${compact ? 'p-3' : 'p-4'} border border-gray-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className={`font-medium ${getTextColor()} ${compact ? 'text-sm' : 'text-base'}`}>
          Storage: {quota.usedMB}MB / {quota.limitMB}MB
        </div>
        {!compact && (
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {tierNames[quota.tier]}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`${getProgressColor()} h-full transition-all duration-300`}
          style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
        />
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-3 space-y-2">
          {/* Percentage Used */}
          <div className={`text-xs ${getTextColor()} flex items-center gap-1`}>
            <span>{quota.percentUsed.toFixed(1)}% used</span>
            {quota.isOverLimit && (
              <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                Over Limit
              </span>
            )}
            {quota.isNearLimit && !quota.isOverLimit && (
              <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                Almost Full
              </span>
            )}
          </div>

          {/* Remaining Space */}
          <div className="text-xs text-gray-500">
            {(quota.remaining / (1024 * 1024)).toFixed(1)}MB remaining
          </div>

          {/* Warning Messages */}
          {quota.isOverLimit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              <p className="font-medium mb-1">Storage full!</p>
              <p>Delete old media or upgrade to continue uploading.</p>
              {quota.tier === 'free' && (
                <button 
                  onClick={() => window.location.href = '/dashboard/settings/subscription'}
                  className="mt-2 text-blue-600 underline hover:text-blue-700 font-medium"
                >
                  Upgrade to 1GB storage →
                </button>
              )}
            </div>
          )}

          {quota.isNearLimit && !quota.isOverLimit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
              <p className="font-medium mb-1">Storage almost full!</p>
              <p>You're using {quota.percentUsed.toFixed(0)}% of your storage space.</p>
              {quota.tier === 'free' && (
                <button 
                  onClick={() => window.location.href = '/dashboard/settings/subscription'}
                  className="mt-2 text-blue-600 underline hover:text-blue-700 font-medium"
                >
                  Upgrade to 1GB storage →
                </button>
              )}
            </div>
          )}

          {/* Upgrade Button for Free Tier */}
          {quota.tier === 'free' && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="w-full mt-2 bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              Upgrade to {tierNames.standardplus} (1GB)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
