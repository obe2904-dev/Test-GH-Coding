import { useTranslation } from 'react-i18next'

export function DashboardOverviewPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('dashboard.welcome')}</h2>
        <p className="text-gray-600 mb-6">
          {t('dashboard.description')}
        </p>
        
        {/* Placeholder for 3-Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-cta-surface rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">{t('dashboard.metrics.reach')}</p>
            <p className="text-3xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500 mt-2">{t('dashboard.metrics.comingSoon')}</p>
          </div>
          <div className="bg-cta-surface rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">{t('dashboard.metrics.engagementRate')}</p>
            <p className="text-3xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500 mt-2">{t('dashboard.metrics.comingSoon')}</p>
          </div>
          <div className="bg-cta-surface rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">{t('dashboard.metrics.linkClicks')}</p>
            <p className="text-3xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500 mt-2">{t('dashboard.metrics.comingSoon')}</p>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-2">{t('dashboard.nextSteps')}</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>{t('dashboard.steps.connect')}</li>
            <li>{t('dashboard.steps.firstPost')}</li>
            <li>{t('dashboard.steps.schedule')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}