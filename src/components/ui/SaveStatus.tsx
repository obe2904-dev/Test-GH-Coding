interface SaveStatusProps {
  isSaving: boolean
  lastSaved: Date | null
  hasUnsavedChanges: boolean
}

export function SaveStatus({ isSaving, lastSaved, hasUnsavedChanges }: SaveStatusProps) {
  const getStatusText = () => {
    if (isSaving) {
      return 'Gemmer...'
    }
    if (hasUnsavedChanges) {
      return 'Ikke gemt'
    }
    if (lastSaved) {
      return 'Gemt'
    }
    return ''
  }

  const getStatusColor = () => {
    if (isSaving) {
      return 'text-blue-600'
    }
    if (hasUnsavedChanges) {
      return 'text-gray-400'
    }
    if (lastSaved) {
      return 'text-green-600'
    }
    return 'text-gray-400'
  }

  return (
    <span className={`text-xs ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  )
}
