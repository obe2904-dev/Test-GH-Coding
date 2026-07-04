import { useTranslation } from 'react-i18next'

export function AllPostsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.allPosts')}</h2>
        <p className="text-gray-600">
          Post management dashboard will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>List of all posts (published, scheduled, drafts)</li>
          <li>Post performance analytics</li>
          <li>Bulk editing and management</li>
          <li>Search and filtering</li>
        </ul>
      </div>
    </div>
  )
}