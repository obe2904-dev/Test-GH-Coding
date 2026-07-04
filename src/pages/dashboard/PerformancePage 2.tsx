import { useTranslation } from 'react-i18next'

export function PerformancePage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.analytics')}</h2>
        <p className="text-gray-600">
          Performance analytics will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Post engagement metrics</li>
          <li>Reach and impression analytics</li>
          <li>Platform performance comparison</li>
          <li>Content performance insights</li>
        </ul>
      </div>
    </div>
  )
}