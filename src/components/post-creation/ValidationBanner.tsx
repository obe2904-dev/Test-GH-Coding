import { useTranslation } from 'react-i18next'

interface ValidationIssue {
  id: string
  message: string
}

interface ValidationBannerProps {
  visible: boolean
  issues: ValidationIssue[]
}

export function ValidationBanner({ visible, issues }: ValidationBannerProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })

  if (!visible || issues.length === 0) {
    return null
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
        <span>⚠️</span>
        {t('generate.validationTitle', 'Please fix these before continuing')}
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {issues.map((issue) => (
          <li key={issue.id}>{issue.message}</li>
        ))}
      </ul>
    </div>
  )
}
