import React from 'react'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string
  iconClassName?: string
  children: React.ReactNode
}

export function IconButton({ ariaLabel, iconClassName = 'w-4 h-4', children, className = '', ...rest }: IconButtonProps) {
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        className: `${(children as any).props?.className ?? ''} ${iconClassName}`.trim()
      })
    : children

  return (
    <button
      aria-label={ariaLabel}
      {...rest}
      className={`min-w-10 min-h-10 inline-flex items-center justify-center rounded-full ${className}`}
    >
      {child}
    </button>
  )
}

export default IconButton
