import { useTranslation } from 'react-i18next'

export function TeamPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.team')}</h2>
        <p className="text-gray-600">
          Team management will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Invite team members</li>
          <li>Manage user roles and permissions</li>
          <li>Collaborative content planning</li>
          <li>Team activity tracking</li>
        </ul>
      </div>
    </div>
  )
}