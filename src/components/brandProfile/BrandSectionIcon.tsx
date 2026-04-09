import React from 'react';

interface BrandSectionIconProps {
  id: 'voice' | 'pillars' | 'limits' | 'strategy' | 'sparkles' | 'palette' | 'businessType';
  className?: string;
}

export function BrandSectionIcon({ id, className = 'w-6 h-6 text-text' }: BrandSectionIconProps) {
  const shared = {
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (id) {
    case 'voice':
      return (
        <svg {...shared}>
          <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case 'pillars':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case 'limits':
      return (
        <svg {...shared}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'strategy':
      return (
        <svg {...shared}>
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...shared}>
          <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'businessType':
      return (
        <svg {...shared}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'palette':
      return (
        <svg {...shared}>
          <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2v-.5c0-.28-.11-.53-.29-.71a.99.99 0 010-1.58A1 1 0 0116 18h1c2.76 0 5-2.24 5-5 0-6.07-4.47-11-10-11zm-5 11a2 2 0 110-4 2 2 0 010 4zm2-5a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4zm3 5a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      );
    default:
      return null;
  }
}
