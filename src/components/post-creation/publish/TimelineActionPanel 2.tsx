/**
 * TimelineActionPanel - Control panel for publish/schedule actions
 * Displays above the timeline to keep timeline cards uniform
 */

interface TimelineActionPanelProps {
  onPublishNow?: () => void
  onSave?: () => void
  isPublishing?: boolean
  canSave?: boolean
  saveDisabledReason?: string
  saveLabel?: string
  publishNowLabel?: string
  hasUnconnectedPlatforms?: boolean
  manualPostingRequiredLabel?: string
}

export function TimelineActionPanel({
  onPublishNow,
  onSave,
  isPublishing = false,
  canSave = true,
  saveDisabledReason,
  saveLabel = 'Planlæg',
  publishNowLabel = 'Udgiv nu',
  hasUnconnectedPlatforms = false,
  manualPostingRequiredLabel,
}: TimelineActionPanelProps) {
  if (!onSave && !onPublishNow) {
    return null
  }

  return (
    <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-3 space-y-2">
      {/* Action Buttons */}
      <div className="flex gap-2">
        {onPublishNow && (
          <button
            onClick={onPublishNow}
            disabled={isPublishing}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPublishing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-base">⚡</span>
            )}
            <span>{publishNowLabel}</span>
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            disabled={!canSave || isPublishing}
            title={!canSave ? saveDisabledReason : undefined}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPublishing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-base">💾</span>
            )}
            <span>{saveLabel}</span>
          </button>
        )}
      </div>

      {/* Warning Messages */}
      {!canSave && saveDisabledReason && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <span>⏰</span> {saveDisabledReason}
        </p>
      )}

      {hasUnconnectedPlatforms && manualPostingRequiredLabel && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <span>⚠️</span> {manualPostingRequiredLabel}
        </p>
      )}
    </div>
  )
}
