/**
 * MenuStatusCard
 * 
 * Reusable component for displaying menu extraction status
 * with user-friendly Danish labels and clear actions.
 * 
 * NEVER shows technical states - always translates to friendly language.
 */

import { getMenuStatusUI, type MenuSourceStatus, type MenuSourceType } from '@/lib/menu/statusUi'

interface MenuStatusCardProps {
  /** Internal database status (never shown to user) */
  status: MenuSourceStatus
  /** Type of menu source for context-specific messaging */
  sourceType?: MenuSourceType
  /** Optional error code for specific error messages */
  errorCode?: string
  /** Custom error message from backend (takes precedence over generic messages) */
  errorMessage?: string
  /** Menu label (e.g., "Brunch", "Cocktails") */
  menuLabel?: string
  /** Callback when user clicks retry */
  onRetry?: () => void
  /** Callback when user clicks review/view menu */
  onReview?: () => void
  /** Callback when user wants to add source manually or upload */
  onAddSource?: () => void
  /** Callback for manual entry */
  onManualEntry?: () => void
  /** Show compact version (for list items) */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

export function MenuStatusCard({
  status,
  sourceType,
  errorCode,
  errorMessage,
  menuLabel,
  onRetry,
  onReview,
  onAddSource,
  onManualEntry,
  compact = false,
  className = ''
}: MenuStatusCardProps) {
  // Get user-friendly UI state from mapping
  const uiState = getMenuStatusUI(status, sourceType, errorCode, errorMessage)

  // Map actions to callbacks
  const handlePrimaryAction = () => {
    if (!uiState.primaryAction) return

    switch (uiState.primaryAction.action) {
      case 'retry':
        onRetry?.()
        break
      case 'review':
        onReview?.()
        break
      case 'upload':
        onAddSource?.()
        break
      case 'manual':
        onManualEntry?.()
        break
    }
  }

  const handleSecondaryAction = () => {
    if (!uiState.secondaryAction) return

    switch (uiState.secondaryAction.action) {
      case 'manual':
        onManualEntry?.()
        break
      case 'upload':
        onAddSource?.()
        break
    }
  }

  // Variant-based styling
  const variantStyles = {
    info: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    error: 'border-red-200 bg-red-50'
  }

  const textStyles = {
    info: 'text-blue-900',
    success: 'text-green-900',
    warning: 'text-yellow-900',
    error: 'text-red-900'
  }

  const descriptionStyles = {
    info: 'text-blue-700',
    success: 'text-green-700',
    warning: 'text-yellow-700',
    error: 'text-red-700'
  }

  const buttonStyles = {
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    error: 'bg-red-600 hover:bg-red-700 text-white'
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {/* Icon + Spinner */}
        <div className="flex items-center gap-2">
          {uiState.showProgress ? (
            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <span className="text-lg">{uiState.icon}</span>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${textStyles[uiState.variant]}`}>
            {menuLabel && <span className="text-gray-900">{menuLabel}: </span>}
            {uiState.title}
          </div>
        </div>

        {/* Primary Action (inline) */}
        {uiState.primaryAction && (
          <button
            onClick={handlePrimaryAction}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${buttonStyles[uiState.variant]}`}
          >
            {uiState.primaryAction.label}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`border rounded-lg p-4 ${variantStyles[uiState.variant]} ${className}`}>
      <div className="flex items-start gap-4">
        {/* Icon + Spinner */}
        <div className="flex-shrink-0">
          {uiState.showProgress ? (
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <span className="text-2xl">{uiState.icon}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`text-lg font-semibold ${textStyles[uiState.variant]}`}>
            {menuLabel && <span className="text-gray-900">{menuLabel} — </span>}
            {uiState.title}
          </h3>

          {/* Description */}
          <p className={`mt-1 text-sm ${descriptionStyles[uiState.variant]}`}>
            {uiState.description}
          </p>

          {/* Actions */}
          {(uiState.primaryAction || uiState.secondaryAction) && (
            <div className="mt-4 flex gap-3">
              {uiState.primaryAction && (
                <button
                  onClick={handlePrimaryAction}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${buttonStyles[uiState.variant]}`}
                >
                  {uiState.primaryAction.label}
                </button>
              )}

              {uiState.secondaryAction && (
                <button
                  onClick={handleSecondaryAction}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {uiState.secondaryAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Inline status badge for compact display in tables/lists
 */
export function MenuStatusBadge({
  status,
  sourceType,
  className = ''
}: {
  status: MenuSourceStatus
  sourceType?: MenuSourceType
  className?: string
}) {
  const uiState = getMenuStatusUI(status, sourceType)

  const badgeStyles = {
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeStyles[uiState.variant]} ${className}`}
    >
      {uiState.showProgress ? (
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <span>{uiState.icon}</span>
      )}
      {uiState.title}
    </span>
  )
}

/**
 * Progress indicator for showing extraction progress
 */
export function MenuStatusProgress({
  status,
  sourceType,
  className = ''
}: {
  status: MenuSourceStatus
  sourceType?: MenuSourceType
  className?: string
}) {
  const uiState = getMenuStatusUI(status, sourceType)

  if (!uiState.showProgress) {
    return null
  }

  // Simple indeterminate progress bar for active states
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{uiState.title}</span>
        <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      {/* Indeterminate progress bar */}
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 animate-pulse rounded-full w-2/3" />
      </div>
      
      <p className="text-xs text-gray-600">{uiState.description}</p>
    </div>
  )
}
