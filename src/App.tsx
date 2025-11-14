import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './components/layout'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage'
import { CreatePostPage, BusinessProfilePage, CalendarPage, AllPostsPage } from './pages/dashboard'
import './lib/i18n' // Initialize internationalization

function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        
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
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="posts" element={<AllPostsPage />} />
        </Route>
        
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
