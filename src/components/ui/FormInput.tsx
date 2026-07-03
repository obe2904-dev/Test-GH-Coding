import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface FormInputProps {
  id: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  required?: boolean
  autoComplete?: string
  translationKey: string
  className?: string
  disabled?: boolean
}

export function FormInput({
  id,
  type,
  value,
  onChange,
  required = false,
  autoComplete,
  translationKey,
  className = '',
  disabled = false
}: FormInputProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)

  const inputType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {t(translationKey)}
      </label>
      <input
        id={id}
        name={id}
        type={inputType}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className={`
          appearance-none relative block w-full px-3 py-2 border border-gray-300 
          placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-cta 
          focus:border-cta focus:z-10 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        placeholder={t(translationKey)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      
      {/* Password visibility toggle */}
      {type === 'password' && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}