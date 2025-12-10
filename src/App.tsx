import { useEffect, lazy, Suspense } from 'react'
import { unstable_HistoryRouter as HistoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useConnectionsStore } from './stores/connectionsStore'
import { useBusinessTier } from './hooks/useBusinessTier'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import './lib/i18n' // Initialize internationalization
import { routerHistory } from './lib/history'

const DashboardLayout = lazy(() =>
  import('./components/layout/DashboardLayout').then((module) => ({ default: module.DashboardLayout }))
)

const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage }))
)

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)

const SignUpPage = lazy(() =>
  import('./pages/SignUpPage').then((module) => ({ default: module.SignUpPage }))
)

const PublicTermsPage = lazy(() =>
  import('./pages/TermsPage').then((module) => ({ default: module.TermsPage }))
)

const PublicPrivacyPage = lazy(() =>
  import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage }))
)

const PublicDataProcessingPage = lazy(() =>
  import('./pages/DataProcessingPage').then((module) => ({ default: module.DataProcessingPage }))
)

const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
)

const DashboardOverviewPage = lazy(() =>
  import('./pages/dashboard/DashboardOverviewPage').then((module) => ({ default: module.DashboardOverviewPage }))
)

const CreatePostPage = lazy(() =>
  import('./pages/dashboard/CreatePostPage').then((module) => ({ default: module.CreatePostPage }))
)

const BusinessProfilePage = lazy(() =>
  import('./pages/dashboard/BusinessProfilePage').then((module) => ({ default: module.default }))
)

const CalendarPage = lazy(() =>
  import('./pages/dashboard/CalendarPage').then((module) => ({ default: module.CalendarPage }))
)

const AllPostsPage = lazy(() =>
  import('./pages/dashboard/AllPostsPage').then((module) => ({ default: module.AllPostsPage }))
)

const PerformancePage = lazy(() =>
  import('./pages/dashboard/PerformancePage').then((module) => ({ default: module.PerformancePage }))
)

const TeamPage = lazy(() =>
  import('./pages/dashboard/TeamPage').then((module) => ({ default: module.TeamPage }))
)

const SettingsPage = lazy(() =>
  import('./pages/dashboard/SettingsPage').then((module) => ({ default: module.SettingsPage }))
)

const HelpPage = lazy(() =>
  import('./pages/dashboard/HelpPage').then((module) => ({ default: module.HelpPage }))
)

const ContactPage = lazy(() =>
  import('./pages/dashboard/ContactPage').then((module) => ({ default: module.ContactPage }))
)

const PrivacyPage = lazy(() =>
  import('./pages/dashboard/PrivacyPage').then((module) => ({ default: module.PrivacyPage }))
)

const TermsPage = lazy(() =>
  import('./pages/dashboard/TermsPage').then((module) => ({ default: module.TermsPage }))
)

const MyProfilePage = lazy(() =>
  import('./pages/dashboard/MyProfilePage').then((module) => ({ default: module.MyProfilePage }))
)

const PlansPage = lazy(() =>
  import('./pages/dashboard/PlansPage').then((module) => ({ default: module.PlansPage }))
)

function App() {
  const { initialize, user, loading } = useAuthStore()
  const { loadPlatformsFromDatabase } = useConnectionsStore()
  
  // Fetch and sync business tier from database
  useBusinessTier()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Load platform selections when user is authenticated
  useEffect(() => {
    if (user) {
      loadPlatformsFromDatabase()
    }
  }, [user, loadPlatformsFromDatabase])

  // Show loading screen while auth initializes
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-[#0F2E32] border-t-[#88F2D7] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <HistoryRouter history={routerHistory}>
      <ErrorBoundary fallback={<LoadingScreen />}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/terms" element={<PublicTermsPage />} />
            <Route path="/privacy" element={<PublicPrivacyPage />} />
            <Route path="/data-processing" element={<PublicDataProcessingPage />} />
            
            {/* Onboarding Route */}
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Nested routes within dashboard layout */}
              <Route index element={<DashboardOverviewPage />} />
              <Route path="create" element={<CreatePostPage />} />
              <Route path="profile" element={<BusinessProfilePage />} />
              <Route path="my-profile" element={<MyProfilePage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="posts" element={<AllPostsPage />} />
              <Route path="analytics" element={<PerformancePage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="plans" element={<PlansPage />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HistoryRouter>
  )
}

export default App
