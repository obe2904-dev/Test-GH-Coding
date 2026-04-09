/**
 * Menu Status UI Mapping
 * 
 * Single source of truth for translating internal menu extraction states
 * to user-friendly Danish UI labels.
 * 
 * RULES:
 * - Never expose technical states (queued, processing, failed) to users
 * - Always provide clear next action on errors
 * - Keep Danish natural and café-friendly
 * - No technical jargon (job, queue, worker, edge function, parse)
 */

export type MenuSourceStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
export type MenuSourceType = 'url' | 'pdf' | 'text'

export type UIVariant = 'info' | 'success' | 'warning' | 'error'

export interface MenuStatusUI {
  title: string
  description: string
  variant: UIVariant
  icon: string
  showProgress: boolean
  primaryAction?: {
    label: string
    action: 'retry' | 'review' | 'upload' | 'manual' | 'cancel'
  }
  secondaryAction?: {
    label: string
    action: 'manual' | 'upload' | 'contact'
  }
}

/**
 * Get user-friendly UI state for menu source status
 * 
 * @param status - Internal database status
 * @param sourceType - Type of menu source (optional, for context-specific messaging)
 * @param errorCode - Optional error code for specific error messages
 * @returns User-friendly UI state with Danish labels
 */
export function getMenuStatusUI(
  status: MenuSourceStatus,
  sourceType?: MenuSourceType,
  errorCode?: string
): MenuStatusUI {
  switch (status) {
    case 'pending':
    case 'queued':
      return {
        title: 'Vi starter…',
        description: 'Vi gør klar til at læse dit menukort.',
        variant: 'info',
        icon: '⏳',
        showProgress: true
      }

    case 'processing':
      return {
        title: 'Vi læser menukortet…',
        description: getProcessingDescription(sourceType),
        variant: 'info',
        icon: '📖',
        showProgress: true
      }

    case 'completed':
      return {
        title: 'Menukort klar ✅',
        description: 'Du kan nu gennemgå og rette menuen.',
        variant: 'success',
        icon: '✅',
        showProgress: false,
        primaryAction: {
          label: 'Gennemgå menu',
          action: 'review'
        }
      }

    case 'failed':
      return getFailedStatusUI(sourceType, errorCode)

    default:
      return {
        title: 'Ukendt status',
        description: 'Noget gik galt. Kontakt support hvis problemet fortsætter.',
        variant: 'warning',
        icon: '⚠️',
        showProgress: false,
        primaryAction: {
          label: 'Prøv igen',
          action: 'retry'
        }
      }
  }
}

/**
 * Get context-specific processing message based on source type
 */
function getProcessingDescription(sourceType?: MenuSourceType): string {
  switch (sourceType) {
    case 'pdf':
      return 'Vi scanner PDF\'en. Det tager typisk under et minut.'
    case 'url':
      return 'Vi henter menuen fra hjemmesiden. Det tager typisk 10-30 sekunder.'
    case 'text':
      return 'Vi strukturerer dit menukort…'
    default:
      return 'Det tager typisk under et minut.'
  }
}

/**
 * Get user-friendly error state with contextual help
 */
function getFailedStatusUI(
  sourceType?: MenuSourceType,
  errorCode?: string
): MenuStatusUI {
  // Check for specific error codes first
  if (errorCode === 'no_text_extracted') {
    return {
      title: 'Vi kunne ikke læse menukortet',
      description: 'PDF\'en indeholder kun billeder. Prøv at scanne i højere kvalitet eller skriv menuen ind manuelt.',
      variant: 'error',
      icon: '❌',
      showProgress: false,
      primaryAction: {
        label: 'Upload ny fil',
        action: 'upload'
      },
      secondaryAction: {
        label: 'Tilføj manuelt',
        action: 'manual'
      }
    }
  }

  if (errorCode === 'url_not_found') {
    return {
      title: 'Vi kunne ikke finde menukortet',
      description: 'Linket virker ikke. Tjek at det er korrekt, eller prøv en anden side.',
      variant: 'error',
      icon: '❌',
      showProgress: false,
      primaryAction: {
        label: 'Prøv igen',
        action: 'retry'
      },
      secondaryAction: {
        label: 'Tilføj manuelt',
        action: 'manual'
      }
    }
  }

  if (errorCode === 'no_categories_found') {
    return {
      title: 'Vi fandt ingen kategorier',
      description: 'Menukortet ser ud til at mangle struktur. Prøv at organisere det tydeligere med kategorier.',
      variant: 'error',
      icon: '❌',
      showProgress: false,
      primaryAction: {
        label: 'Tilføj manuelt',
        action: 'manual'
      },
      secondaryAction: {
        label: 'Prøv igen',
        action: 'manual'
      }
    }
  }

  // Generic failure messages based on source type
  switch (sourceType) {
    case 'pdf':
      return {
        title: 'Vi kunne ikke læse PDF\'en',
        description: 'Prøv at scanne menukortet igen i bedre kvalitet — eller skriv det ind manuelt.',
        variant: 'error',
        icon: '❌',
        showProgress: false,
        primaryAction: {
          label: 'Upload ny fil',
          action: 'upload'
        },
        secondaryAction: {
          label: 'Tilføj manuelt',
          action: 'manual'
        }
      }

    case 'url':
      return {
        title: 'Vi kunne ikke læse menukortet',
        description: 'Linket virker måske ikke, eller siden har ikke noget menukort. Prøv en anden side eller upload en PDF.',
        variant: 'error',
        icon: '❌',
        showProgress: false,
        primaryAction: {
          label: 'Prøv andet link',
          action: 'retry'
        },
        secondaryAction: {
          label: 'Upload PDF',
          action: 'upload'
        }
      }

    case 'text':
      return {
        title: 'Vi kunne ikke strukturere menukortet',
        description: 'Prøv at organisere menuen tydeligere med kategorier (f.eks. BRUNCH, DRIKKEVARER).',
        variant: 'error',
        icon: '❌',
        showProgress: false,
        primaryAction: {
          label: 'Prøv igen',
          action: 'retry'
        }
      }

    default:
      return {
        title: 'Vi kunne ikke læse menukortet',
        description: 'Prøv en tydeligere PDF, et andet link, eller tilføj indholdet manuelt.',
        variant: 'error',
        icon: '❌',
        showProgress: false,
        primaryAction: {
          label: 'Prøv igen',
          action: 'retry'
        },
        secondaryAction: {
          label: 'Tilføj manuelt',
          action: 'manual'
        }
      }
  }
}

/**
 * Get progress percentage estimate based on status and source type
 * (for progress bars, if needed)
 */
export function getProgressEstimate(
  status: MenuSourceStatus,
  sourceType?: MenuSourceType
): number {
  switch (status) {
    case 'pending':
    case 'queued':
      return 10
    case 'processing':
      // Different sources take different time, so show different progress
      return sourceType === 'pdf' ? 50 : 60
    case 'completed':
      return 100
    case 'failed':
      return 0
    default:
      return 0
  }
}

/**
 * Get estimated time remaining message (optional, for long operations)
 */
export function getTimeEstimate(
  status: MenuSourceStatus,
  sourceType?: MenuSourceType
): string | null {
  if (status !== 'processing') return null

  switch (sourceType) {
    case 'pdf':
      return 'Ca. 30-60 sekunder tilbage'
    case 'url':
      return 'Ca. 10-20 sekunder tilbage'
    case 'text':
      return 'Ca. 5-10 sekunder tilbage'
    default:
      return null
  }
}
