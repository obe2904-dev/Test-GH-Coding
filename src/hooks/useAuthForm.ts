import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { isValidEmail, validatePassword } from '../lib/utils'

interface UseAuthFormReturn {
  email: string
  setEmail: (email: string) => void
  password: string
  setPassword: (password: string) => void
  error: string
  loading: boolean
  handleSignIn: () => Promise<void>
  handleSignUp: () => Promise<void>
  clearError: () => void
  isValidForm: boolean
}

export function useAuthForm(): UseAuthFormReturn {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn, signUp } = useAuthStore()

  const clearError = () => setError('')

  const isValidForm = isValidEmail(email) && validatePassword(password).isValid

  const handleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err) {
      if (err instanceof Error) {
        // Map Supabase errors to user-friendly messages
        if (err.message.includes('Invalid login credentials')) {
          setError('Forkerte loginoplysninger. Tjek din email og adgangskode.')
        } else if (err.message.includes('Email not confirmed')) {
          setError('Din email er ikke bekræftet. Tjek din email for bekræftelseslink og klik på det.')
        } else if (err.message.includes('Email not found')) {
          setError('Denne email findes ikke. Prøv at oprette en konto først.')
        } else {
          setError(`Login fejl: ${err.message}`)
        }
      } else {
        setError('Ukendt login fejl. Prøv igen.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setError('')
    setLoading(true)

    // Client-side validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0])
      setLoading(false)
      return
    }

    try {
      await signUp(email, password)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('User already registered')) {
          setError('emailExists')
        } else {
          setError('generic')
        }
      } else {
        setError('generic')
      }
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    handleSignIn,
    handleSignUp,
    clearError,
    isValidForm
  }
}