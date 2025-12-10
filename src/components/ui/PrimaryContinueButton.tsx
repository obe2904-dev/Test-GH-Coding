import React from 'react'

interface Props {
  onClick?: () => void
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

export function PrimaryContinueButton({ onClick, disabled, children, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        `px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${className}`
      }
    >
      {children}
    </button>
  )
}

export default PrimaryContinueButton
