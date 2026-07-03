import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'

interface SignUpFormProps {
  redirectOnSuccess?: boolean
  onClose?: () => void
}

export function SignUpForm({ redirectOnSuccess = true, onClose }: SignUpFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signUp, signInWithProvider } = useAuthStore()

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [providerLoading, setProviderLoading] = useState<null | 'google' | 'azure'>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!termsAccepted) {
      setError(t('auth.acceptTerms', 'Please accept the terms to continue'))
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort', 'Password must be at least 6 characters'))
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch', 'Passwords do not match'))
      setLoading(false)
      return
    }

    try {
      await signUp(email, password, {
        fullName,
        marketingOptIn,
      })
      setSuccess(true)
      if (redirectOnSuccess) {
        setTimeout(() => navigate('/login'), 3000)
      }
    } catch (err) {
      console.error('❌ Signup error:', err)
      const errorMessage = err instanceof Error ? err.message : t('auth.signUpError', 'Failed to create account')
      
      // Check for common issues
      if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
        setError('Email rate limit exceeded. Please wait 1 hour and try again, or contact support.')
      } else if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
        setError('This email is already registered. Try logging in instead.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleProviderSignUp = async (provider: 'google' | 'azure') => {
    setError('')
    setProviderLoading(provider)

    try {
      await signInWithProvider(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signUpError', 'Failed to create account'))
    } finally {
      setProviderLoading(null)
    }
  }

  if (success) {
    return (
      <div className="max-w-md w-full space-y-4">
        <div className="rounded-md bg-green-50 p-4">
          <h3 className="text-lg font-medium text-green-800 mb-2">
            {t('auth.accountCreated', 'Account created!')}
          </h3>
          <p className="text-sm text-green-700">
            {t('auth.checkEmail', 'Please check your email to verify your account before signing in.')}
          </p>
        </div>
        {!redirectOnSuccess && (
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition"
          >
            {t('common.close', 'Close')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md w-full space-y-8">
      {!showEmailForm ? (
        <>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              {t('auth.modalTitle', 'Start creating posts for free')}
            </h2>
            <p className="text-sm text-slate-600">
              {t('auth.modalNoBinding', 'No commitment')}
            </p>
            <p className="text-sm text-slate-500">
              {t('auth.modalNoCard', 'No credit card required')}
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleProviderSignUp('google')}
              disabled={!!providerLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {providerLoading === 'google'
                ? t('common.loading', 'Loading...')
                : t('auth.signUpWithGoogle', 'Sign up with Google')}
            </button>
            <button
              type="button"
              onClick={() => handleProviderSignUp('azure')}
              disabled={!!providerLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {providerLoading === 'azure'
                ? t('common.loading', 'Loading...')
                : t('auth.signUpWithMicrosoft', 'Sign up with Microsoft')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmailForm(true)
                setError('')
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-text-inverse bg-cta rounded-md hover:bg-cta-hover transition"
            >
              {t('auth.signUpWithEmail', 'Sign up with email')}
            </button>
          </div>

          <p className="text-center text-sm text-slate-600">
            {t('auth.alreadyHave', 'Already have an account?')}{' '}
            <Link to="/login" className="font-medium text-cta hover:text-cta-text">
              {t('auth.signInButton', 'Sign in')}
            </Link>
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setShowEmailForm(false)
              setError('')
            }}
            className="text-sm text-cta hover:text-cta-text"
          >
            {`< ${t('common.back', 'Back')}`}
          </button>

          <div>
            <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
              {t('auth.signUp', 'Create your account')}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {t('auth.alreadyHave', 'Already have an account?')}{' '}
              <Link to="/login" className="font-medium text-cta hover:text-cta-text">
                {t('auth.signInButton', 'Sign in')}
              </Link>
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-slate-700">
                  {t('auth.fullName', 'Name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="full-name"
                  name="full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta"
                  placeholder={t('auth.fullNamePlaceholder', 'Your name')}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  {t('auth.email', 'Email address')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta"
                  placeholder={t('auth.email', 'Email address')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  {t('auth.passwordMin', 'Password (min. 6 characters)')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta"
                  placeholder={t('auth.passwordMin', 'Password (min. 6 characters)')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
                  {t('auth.confirmPassword', 'Confirm password')}
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta"
                  placeholder={t('auth.confirmPassword', 'Confirm password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-cta focus:ring-cta"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                  />
                  <span>
                    {t(
                      'auth.marketingOptIn',
                      'Yes, send me helpful emails with tips and partner offers. Unsubscribe anytime.'
                    )}
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-cta focus:ring-cta"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                  />
                  <span className="text-sm text-slate-600">
                    <Trans
                      i18nKey="auth.acceptTermsLabel"
                      components={{
                        termsLink: (
                          <a
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cta hover:text-cta-text underline"
                          />
                        ),
                        dataLink: (
                          <a
                            href="/data-processing"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cta hover:text-cta-text underline"
                          />
                        ),
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-text-inverse bg-cta hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('auth.creatingAccount', 'Creating account...') : t('auth.signUpButton', 'Create account')}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

export default SignUpForm