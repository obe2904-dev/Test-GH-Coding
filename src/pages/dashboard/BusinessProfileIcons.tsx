// Preserved icons and utilities from BusinessProfilePage refactoring
// These were removed during cleanup to eliminate unused variables but may be needed for future features
//
// CONTEXT: During the dashboard refactoring, these icons and utilities were removed from
// BusinessProfilePage.tsx because they weren't being used and were causing TypeScript
// unused variable warnings. They've been preserved here for future business profile features.
//
// SAVED COMPONENTS:
// - Clock, Coffee, MapPin, Phone, Mail icons (for opening hours, contact info features)
// - Week days structure for opening hours functionality
// - Business profile tab types for future tabbed interface

// Custom SVG Icons for Business Profile features
export const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
)

export const Coffee = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 8h1a4 4 0 010 8h-1"/>
    <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/>
    <line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
)

export const MapPin = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

export const Phone = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
  </svg>
)

export const Mail = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

// Two-arrow circular analyze icon (reusable, can spin when analyzing)
export const AnalyzeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5H19.418M20 9a8 8 0 10-16 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4h6M15 20H9" opacity="0.9" />
  </svg>
)

// Utility functions and data structures for future business profile features

// Week days structure for opening hours functionality
export const getWeekDaysStructure = (t: (key: string) => string) => [
  { key: 'monday', label: t('business.openingHours.monday') },
  { key: 'tuesday', label: t('business.openingHours.tuesday') },
  { key: 'wednesday', label: t('business.openingHours.wednesday') },
  { key: 'thursday', label: t('business.openingHours.thursday') },
  { key: 'friday', label: t('business.openingHours.friday') },
  { key: 'saturday', label: t('business.openingHours.saturday') },
  { key: 'sunday', label: t('business.openingHours.sunday') }
]

// Tab state management for business profile sections
export type BusinessProfileTab = 'categories' | 'signature' | 'dietary'

// Example usage:
// import { Clock, Coffee, MapPin, Phone, Mail, getWeekDaysStructure, BusinessProfileTab } from './BusinessProfileIcons'