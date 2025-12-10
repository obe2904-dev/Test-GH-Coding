import { useTranslation } from 'react-i18next'

export function MyProfilePage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.profile')}</h2>
        <p className="text-gray-600">
          User profile settings will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Personal information</li>
          <li>Account preferences</li>
          <li>Password management</li>
          <li>Profile customization</li>
        </ul>
      </div>
    </div>
  )
}