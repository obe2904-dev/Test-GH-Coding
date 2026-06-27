/**
 * PostActionModal - Modal dialog for post actions (publish now or schedule)
 * Opens when user clicks on a draft or scheduled post in the timeline
 */

import { X } from 'lucide-react'

interface PostActionModalProps {
  isOpen: boolean
  onClose: () => void
  onPublishNow?: () => void
  onSchedule?: () => void
  isPublishing?: boolean
  canSave?: boolean
  saveDisabledReason?: string
  publishNowLabel?: string
  scheduleLabel?: string
  hasUnconnectedPlatforms?: boolean
  manualPostingRequiredLabel?: string
  postPreview?: {
    headline?: string
    text?: string
  }
}

export function PostActionModal({
  isOpen,
  onClose,
  onPublishNow,
  onSchedule,
  isPublishing = false,
  canSave = true,
  saveDisabledReason,
  publishNowLabel = 'Udgiv nu',
  scheduleLabel = 'Planlæg',
  hasUnconnectedPlatforms = false,
  manualPostingRequiredLabel,
  postPreview,
}: PostActionModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Opslags handlinger
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Luk"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Post Preview (if available) */}
            {postPreview && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                {postPreview.headline && (
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                    {postPreview.headline}
                  </p>
                )}
                {postPreview.text && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                    {postPreview.text}
                  </p>
                )}
              </div>
            )}

            {/* Warning Messages */}
            {!canSave && saveDisabledReason && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <span>⏰</span> {saveDisabledReason}
                </p>
              </div>
            )}

            {hasUnconnectedPlatforms && manualPostingRequiredLabel && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <span>⚠️</span> {manualPostingRequiredLabel}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {onPublishNow && (
                <button
                  onClick={() => {
                    onPublishNow()
                    onClose()
                  }}
                  disabled={isPublishing}
                  className="w-full px-4 py-3 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-base">⚡</span>
                  )}
                  <span>{publishNowLabel}</span>
                </button>
              )}

              {onSchedule && (
                <button
                  onClick={() => {
                    onSchedule()
                    onClose()
                  }}
                  disabled={!canSave || isPublishing}
                  title={!canSave ? saveDisabledReason : undefined}
                  className="w-full px-4 py-3 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-base">💾</span>
                  )}
                  <span>{scheduleLabel}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
