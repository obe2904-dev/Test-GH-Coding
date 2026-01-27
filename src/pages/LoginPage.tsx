import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthForm } from '../hooks/useAuthForm'
import { FormInput, Button, ErrorMessage } from '../components/ui'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { 
    email, 
    setEmail, 
    password, 
    setPassword, 
    error, 
    loading, 
    handleSignIn
  } = useAuthForm()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('📝 Form submitted')
    try {
      await handleSignIn()
      console.log('🎯 handleSignIn completed, navigating to dashboard...')
      navigate('/dashboard')
    } catch (err) {
      console.error('🚨 handleSubmit error:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Language switcher in top right */}
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.signIn')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.orText')}{' '}
            <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-500">
              {t('auth.createNew')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <ErrorMessage error={error} />
          
          <div className="rounded-md shadow-sm -space-y-px">
            <FormInput
              id="email"
              type="email"
              value={email}
              onChange={setEmail}
              translationKey="auth.email"
              autoComplete="email"
              required
              className="rounded-t-md"
            />
            <FormInput
              id="password"
              type="password"
              value={password}
              onChange={setPassword}
              translationKey="auth.password"
              autoComplete="current-password"
              required
              className="rounded-b-md"
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full"
          >
            {loading ? t('auth.signingIn') : t('auth.signInButton')}
          </Button>
          

        </form>
      </div>
    </div>
  )
}
