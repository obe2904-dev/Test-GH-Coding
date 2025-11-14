import { useAuthStore } from '../stores/authStore'

export function DashboardPage() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome! 👋</h2>
          <p className="text-gray-600 mb-6">
            Your social media management dashboard will appear here.
          </p>
          
          {/* Placeholder for 3-Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-primary-50 rounded-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Reach</p>
              <p className="text-3xl font-bold text-gray-900">—</p>
              <p className="text-sm text-gray-500 mt-2">Coming soon</p>
            </div>
            <div className="bg-primary-50 rounded-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Engagement Rate</p>
              <p className="text-3xl font-bold text-gray-900">—</p>
              <p className="text-sm text-gray-500 mt-2">Coming soon</p>
            </div>
            <div className="bg-primary-50 rounded-lg p-6">
              <p className="text-sm text-gray-600 mb-2">Link Clicks</p>
              <p className="text-3xl font-bold text-gray-900">—</p>
              <p className="text-sm text-gray-500 mt-2">Coming soon</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Next Steps:</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Connect your social media accounts</li>
              <li>Create your first post</li>
              <li>Schedule content for the week</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
