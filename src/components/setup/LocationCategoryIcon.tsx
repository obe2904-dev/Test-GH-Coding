import { LocationCategoryId } from '@/types/location';

interface Props {
  categoryId: LocationCategoryId;
  className?: string;
}

export function LocationCategoryIcon({ categoryId, className = 'w-8 h-8' }: Props) {
  const svg = {
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'none',
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    stroke: 'currentColor',
    className,
  };

  switch (categoryId) {
    case 'city_centre':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      );

    case 'residential':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );

    case 'tourist':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0" />
        </svg>
      );

    case 'office':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );

    case 'transport_hub':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      );

    case 'student':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      );

    case 'waterfront':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12c1.5-2 3.5-3 5.5-3s4 1 5.5 3 3.5 3 5.5 3M3 17c1.5-2 3.5-3 5.5-3s4 1 5.5 3 3.5 3 5.5 3M3 7c1.5-2 3.5-3 5.5-3s4 1 5.5 3 3.5 3 5.5 3" />
        </svg>
      );

    case 'nature_park':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 17L12 5l7 12H5zM10 17v4h4v-4" />
        </svg>
      );

    case 'shopping_district':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );

    case 'mixed_use':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l4-3 4 3 4-3 4 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" />
        </svg>
      );

    case 'destination':
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0" />
        </svg>
      );

    default:
      return (
        <svg {...svg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0" />
        </svg>
      );
  }
}
