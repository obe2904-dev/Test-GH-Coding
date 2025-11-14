import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useTierStore } from '../../stores/tierStore'
import { ProgressStepper } from '../ui/ProgressStepper'

interface PublishStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
}

interface PlatformConnection {
  platform: string
  isConnected: boolean
  canAutoPost: boolean
  canTrackPerformance: boolean
}

// Icon Components
const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const Calendar = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const Send = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/>
  </svg>
)

const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const Sun = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const Users = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

// const AlertTriangle = ({ className }: { className?: string }) => (
//   <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
//     <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
//     <line x1="12" y1="9" x2="12" y2="13"/>
//     <line x1="12" y1="17" x2="12.01" y2="17"/>
//   </svg>
// )

const Copy = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const ExternalLink = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const Link2 = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

// Mock data with connection status
const mockRecentPosts = [
  { 
    id: 1, 
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    time: '2 hours ago', 
    title: 'Summer sale announcement', 
    platform: 'Facebook',
    snippet: 'Check out our amazing summer deals...',
    engagement: { views: 1540, likes: 127, comments: 23, shares: 8 },
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&fit=crop'
  },
  { 
    id: 2, 
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    time: '5 hours ago', 
    title: 'New menu items', 
    platform: 'Instagram',
    snippet: 'Introducing our fresh seasonal menu...',
    engagement: { views: 2840, likes: 342, comments: 45, shares: 12 },
    thumbnail: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'
  }
]

const mockFuturePosts = [
  { 
    id: 3, 
    date: new Date(Date.now() + 18 * 60 * 60 * 1000),
    time: 'Tomorrow, 16:00', 
    title: 'Weekend special offer', 
    platform: 'Facebook',
    snippet: 'Limited time weekend promo...',
    timeUntil: 'in 18 hours',
    thumbnail: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=100&h=100&fit=crop'
  },
  { 
    id: 4, 
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    time: 'Friday, 12:00', 
    title: 'Weekly highlights', 
    platform: 'Instagram',
    snippet: 'This week\'s best moments...',
    timeUntil: 'in 4 days',
    thumbnail: 'https://images.unsplash.com/photo-1611095790444-1dfa35e37b52?w=100&h=100&fit=crop'
  }
]

// Simple platform indicator with connection status
const PlatformIndicator = ({ 
  platform, 
  isConnected 
}: { 
  platform: string
  isConnected: boolean
}) => {
  const config = {
    Facebook: { dot: 'bg-blue-600', symbol: 'f' },
    Instagram: { dot: 'bg-pink-600', symbol: 'i' }
  }
  
  const style = config[platform as keyof typeof config] || config.Facebook
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className="text-xs font-medium text-slate-700">{platform}</span>
      {isConnected ? (
        <span className="text-[10px]" title="Connected">✓</span>
      ) : (
        <span className="text-[10px] text-amber-600" title="Not connected">⚠</span>
      )}
    </div>
  )
}

export function PublishStep({ onNext, onBack, onStepClick }: PublishStepProps) {
  const { t: tPublish, i18n } = useTranslation(undefined, { keyPrefix: 'publish' })
  const { postContent, selectedPlatforms, photoContent } = usePostCreationStore()
  const { 
    canSchedulePost, 
    incrementScheduledPost
  } = useTierStore()

  // Helper function to get post title (headline or first words of text)
  const getPostTitle = (): string => {
    if (postContent?.headline && postContent.headline.trim()) {
      return postContent.headline
    }
    if (postContent?.text && postContent.text.trim()) {
      // Get first 50 characters of text
      const firstWords = postContent.text.trim().substring(0, 50)
      return firstWords.length < postContent.text.trim().length ? `${firstWords}...` : firstWords
    }
    return 'Your New Post'
  }

  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<string>('14')
  const [selectedMinute, setSelectedMinute] = useState<string>('00')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isPublishing, setIsPublishing] = useState(false)
  // const [schedulingConflicts, setSchedulingConflicts] = useState<string[]>([])
  const [showManualPostModal, setShowManualPostModal] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)
  
  // Platform connection state (mock - would come from API in real app)
  const [platformConnections] = useState<PlatformConnection[]>([
    { 
      platform: 'Facebook', 
      isConnected: false, // Set to true if user has connected
      canAutoPost: false, 
      canTrackPerformance: false 
    },
    { 
      platform: 'Instagram', 
      isConnected: false, // Set to true if user has connected
      canAutoPost: false, 
      canTrackPerformance: false 
    }
  ])
  
  // Combine hour and minute into time string
  const selectedTime = `${selectedHour}:${selectedMinute}`
  const timeInterval = 15 // minutes

  // Check if platform is connected
  const isPlatformConnected = (platform: string) => {
    const conn = platformConnections.find(p => p.platform === platform)
    return conn?.isConnected || false
  }

  // Get unconnected platforms from selected
  const getUnconnectedPlatforms = () => {
    return selectedPlatforms.filter(platform => {
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1)
      return !isPlatformConnected(platformName)
    })
  }

  const monthNamesRaw = tPublish('monthNames', { returnObjects: true })
  const monthNames = Array.isArray(monthNamesRaw)
    ? monthNamesRaw
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const dayNamesRaw = tPublish('dayNames', { returnObjects: true })
  const dayNames = Array.isArray(dayNamesRaw)
    ? dayNamesRaw
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Helper function to format relative date/time
  const formatRelativeDateTime = (date: Date): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    
    if (targetDate.getTime() === today.getTime()) {
      return `${tPublish('today', 'Today')}, ${timeStr}`
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return `${tPublish('tomorrow', 'Tomorrow')}, ${timeStr}`
    } else {
      // Use day name from translations
      const dayName = dayNames[date.getDay()]
      return `${dayName}, ${timeStr}`
    }
  }

  // AI-suggested times (dynamically generated to use current translations)
  const createAiSuggestions = () => {
    const today6pm = new Date()
    today6pm.setHours(18, 0, 0, 0)
    
    const tomorrow10am = new Date()
    tomorrow10am.setDate(tomorrow10am.getDate() + 1)
    tomorrow10am.setHours(10, 0, 0, 0)
    
    // Find next Friday at noon
    const nextFriday = new Date()
    const daysUntilFriday = (5 - nextFriday.getDay() + 7) % 7 || 7 // 5 = Friday
    nextFriday.setDate(nextFriday.getDate() + daysUntilFriday)
    nextFriday.setHours(12, 0, 0, 0)
    
    return [
      {
        id: 1,
        time: formatRelativeDateTime(today6pm),
        date: today6pm,
        reason: tPublish('suggestion1', 'Peak evening engagement'),
        expectedReach: 'High',
        icon: Sun,
        color: 'emerald'
      },
      {
        id: 2,
        time: formatRelativeDateTime(tomorrow10am),
        date: tomorrow10am,
        reason: tPublish('suggestion2', 'Morning coffee scroll time'),
        expectedReach: 'Medium',
        icon: Users,
        color: 'amber'
      },
      {
        id: 3,
        time: formatRelativeDateTime(nextFriday),
        date: nextFriday,
        reason: tPublish('suggestion3', 'Lunch break browsing'),
        expectedReach: 'High',
        icon: TrendingUp,
        color: 'emerald'
      }
    ]
  }
  
  const aiSuggestions = createAiSuggestions()

  // Detect scheduling conflicts
  // useEffect(() => {
  //   if (!selectedDate) {
  //     setSchedulingConflicts([])
  //     return
  //   }

  //   const selectedDateTime = new Date(selectedDate)
  //   selectedDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute))

  //   const conflicts: string[] = []
  //   const hourInMs = 60 * 60 * 1000
  //   const conflictWindow = 2 * hourInMs

  //   mockFuturePosts.forEach(post => {
  //     const timeDiff = Math.abs(selectedDateTime.getTime() - post.date.getTime())
  //     if (timeDiff < conflictWindow) {
  //       const hoursDiff = Math.round(timeDiff / hourInMs * 10) / 10
  //       if (selectedDateTime.getTime() > post.date.getTime()) {
  //         conflicts.push(`Scheduled ${hoursDiff}h after "${post.title}"`)
  //       } else {
  //         conflicts.push(`Scheduled ${hoursDiff}h before "${post.title}"`)
  //       }
  //     }
  //   })

  //   setSchedulingConflicts(conflicts)
  // }, [selectedDate, selectedHour, selectedMinute])

  // Get sorted posts chronologically
  const getSortedPosts = () => {
    const allPosts: Array<{
      id: string | number
      date: Date
      type: 'recent' | 'selected' | 'future'
      data?: any
    }> = []

    mockRecentPosts.forEach(post => {
      allPosts.push({
        id: post.id,
        date: post.date,
        type: 'recent',
        data: post
      })
    })

    if (selectedDate) {
      const selectedDateTime = new Date(selectedDate)
      selectedDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute))
      
      allPosts.push({
        id: 'selected',
        date: selectedDateTime,
        type: 'selected'
      })
    }

    mockFuturePosts.forEach(post => {
      allPosts.push({
        id: post.id,
        date: post.date,
        type: 'future',
        data: post
      })
    })

    return allPosts.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = []

    // Get previous month's last days
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const daysInPrevMonth = getDaysInMonth(prevMonth)
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      days.push({
        day,
        isCurrentMonth: false,
        date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day)
      })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
      })
    }

    // Next month days to fill the grid (up to 42 cells = 6 rows)
    const remainingCells = 42 - days.length
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i)
      })
    }

    return days
  }

  const isSelectedDay = (date: Date) => {
    if (!selectedDate) return false
    return (
      selectedDate.getDate() === date.getDate() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getFullYear() === date.getFullYear()
    )
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      today.getDate() === date.getDate() &&
      today.getMonth() === date.getMonth() &&
      today.getFullYear() === date.getFullYear()
    )
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < today
  }

  const isPastDateTime = (date: Date, hour: string, minute: string) => {
    const dateTime = new Date(date)
    dateTime.setHours(parseInt(hour), parseInt(minute), 0, 0)
    return dateTime < new Date()
  }

  const isDateTimeInPast = (date: Date) => {
    // If it's not today, just check if the date is in the past
    if (!isToday(date)) {
      return isPastDate(date)
    }
    
    // If it's today, check the selected time
    return isPastDateTime(date, selectedHour, selectedMinute)
  }

  const handleDayClick = (date: Date) => {
    // Don't allow selecting past dates
    if (isPastDate(date)) return
    
    // Check if the clicked date is in a different month than currently displayed
    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
      // Navigate to the month of the clicked date
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
    
    // If it's today, check if the selected time is not in the past
    if (isToday(date) && isPastDateTime(date, selectedHour, selectedMinute)) {
      // Set time to next available time (current time + 15 minutes rounded up)
      const now = new Date()
      const currentMinutes = now.getMinutes()
      const nextInterval = Math.ceil(currentMinutes / timeInterval) * timeInterval
      
      if (nextInterval >= 60) {
        setSelectedHour((now.getHours() + 1).toString().padStart(2, '0'))
        setSelectedMinute('00')
      } else {
        setSelectedHour(now.getHours().toString().padStart(2, '0'))
        setSelectedMinute(nextInterval.toString().padStart(2, '0'))
      }
    }
    
    setSelectedDate(date)
    setSelectedSuggestion(null)
  }

  const handleSuggestionClick = (suggestion: typeof aiSuggestions[0]) => {
    setSelectedSuggestion(suggestion.id)
    setSelectedDate(suggestion.date)
    const timeParts = suggestion.time.split(', ')[1].split(':')
    setSelectedHour(timeParts[0])
    setSelectedMinute(timeParts[1])
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  // Get formatted content for platform
  const getFormattedContent = (platform: string) => {
    // This would format content specifically for each platform
    // For now, return post content with platform-specific hashtags
    const baseContent = postContent?.headline || 'Your post content here'
    
    if (platform === 'Facebook') {
      return `${baseContent}\n\n#YourBrand #Facebook`
    } else if (platform === 'Instagram') {
      return `${baseContent}\n\n#YourBrand #Instagram #InstaGood`
    }
    return baseContent
  }

  // Copy to clipboard
  const copyToClipboard = async (platform: string) => {
    const content = getFormattedContent(platform)
    try {
      await navigator.clipboard.writeText(content)
      setCopiedPlatform(platform)
      setTimeout(() => setCopiedPlatform(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Open platform
  const openPlatform = (platform: string) => {
    const urls = {
      Facebook: 'https://www.facebook.com',
      Instagram: 'https://www.instagram.com'
    }
    window.open(urls[platform as keyof typeof urls], '_blank')
  }

  // Handle connect platform
  const handleConnectPlatform = (platform: string) => {
    // In real app, this would trigger OAuth flow
    console.log('Connect platform:', platform)
    // Show the manual post modal which includes connection options
    setShowManualPostModal(true)
  }

  const handlePublish = async () => {
    const unconnected = getUnconnectedPlatforms()
    
    if (unconnected.length > 0) {
      // Show manual post modal
      setShowManualPostModal(true)
    } else {
      // Auto-post to connected platforms
      if (publishMode === 'schedule' && !canSchedulePost()) {
        alert(tPublish('scheduleQuotaExceeded', 'Reached monthly limit'))
        return
      }
      
      setIsPublishing(true)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log('Auto-posting to:', selectedPlatforms)
      if (publishMode === 'schedule') {
        incrementScheduledPost()
      }
      
      setIsPublishing(false)
      onNext()
    }
  }

  const canPublish = publishMode === 'now' || (publishMode === 'schedule' && selectedDate && selectedTime)

  // Get locale for displaying dates - use current language (da-DK or en-GB) combined with date format preference
  const locale = (() => {
    const currentLang = i18n.language // 'en' or 'da'
    
    // Get user's date format preference (US or EU)
    try {
      const prefs = localStorage.getItem('userPreferences')
      if (prefs) {
        const parsed = JSON.parse(prefs)
        const dateFormat = parsed.dateFormat // 'en-US' or 'en-GB'
        
        // If user wants US format, use en-US regardless of language
        // Otherwise use language-specific locale (da-DK or en-GB)
        if (dateFormat === 'en-US') {
          return 'en-US'
        }
      }
    } catch (e) {
      console.error('Error reading date format preference:', e)
    }
    
    // Default to language-specific locale with EU format
    return currentLang === 'da' ? 'da-DK' : 'en-GB'
  })()

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const minutes = Array.from({ length: 60 / timeInterval }, (_, i) => (i * timeInterval).toString().padStart(2, '0'))

  const unconnectedPlatforms = getUnconnectedPlatforms()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {tPublish('title', 'Schedule & Publish')}
        </h1>
        <p className="text-base text-slate-600">
          {tPublish('subtitle', 'Choose when to publish your post')}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={3} totalSteps={3} onStepClick={onStepClick} />

      {/* Connection Notice (Gentle, at top) */}
      {unconnectedPlatforms.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-2">
            <Link2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                {tPublish('manualPosting', 'Manual Posting')}
              </p>
              <p className="text-xs text-amber-800 leading-relaxed mb-2">
                {tPublish('manualPostingDesc', "We'll prepare your content for copy-paste to {platforms}. Connect accounts anytime for automatic posting (it's free!).", {
                  platforms: unconnectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' & ')
                })}
              </p>
              <button 
                onClick={() => handleConnectPlatform(unconnectedPlatforms[0])}
                className="text-xs text-amber-900 font-bold hover:text-amber-950 flex items-center gap-1"
              >
                {tPublish('continueToConnect', 'Continue to Copy Content')} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Controls */}
      <div className="space-y-3">
        
        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPublishMode('now')}
            className={`relative p-3 rounded-lg border transition-all ${
              publishMode === 'now'
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`p-2 rounded-full ${publishMode === 'now' ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                <Send className={`w-5 h-5 ${publishMode === 'now' ? 'text-indigo-600' : 'text-slate-600'}`} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-0.5">
                  {tPublish('publishNow', 'Publish Now')}
                </h3>
                <p className="text-xs text-slate-600">
                  {unconnectedPlatforms.length > 0 ? 'Manual post' : 'Post immediately'}
                </p>
              </div>
              {publishMode === 'now' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </button>

          <button
            onClick={() => setPublishMode('schedule')}
            className={`relative p-3 rounded-lg border transition-all ${
              publishMode === 'schedule'
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`p-2 rounded-full ${publishMode === 'schedule' ? 'bg-purple-100' : 'bg-slate-100'}`}>
                <Calendar className={`w-5 h-5 ${publishMode === 'schedule' ? 'text-purple-600' : 'text-slate-600'}`} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-0.5">
                  {tPublish('schedule', 'Schedule')}
                </h3>
                <p className="text-xs text-slate-600">
                  {unconnectedPlatforms.length > 0 ? 'Schedule manual' : 'Best time'}
                </p>
              </div>
              {publishMode === 'schedule' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Schedule Options */}
        {publishMode === 'schedule' && (
          <div className="space-y-3">
            
            {/* AI Suggestions */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {tPublish('aiSuggestions', 'AI-Suggested Times')}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {aiSuggestions.map((suggestion) => {
                  const Icon = suggestion.icon
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`p-2 rounded-lg border transition-all ${
                        selectedSuggestion === suggestion.id
                          ? 'border-purple-500 bg-purple-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <Icon className={`w-5 h-5 ${selectedSuggestion === suggestion.id ? 'text-purple-600' : 'text-slate-600'}`} />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{suggestion.time}</p>
                          <p className="text-xs text-slate-600 leading-tight">{suggestion.reason}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          suggestion.expectedReach === 'High' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {suggestion.expectedReach}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Calendar with Timeline */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {tPublish('calendar', 'Calendar & Timeline')}
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* LEFT: Calendar & Time Selection */}
                <div>
                  {/* Calendar and Time Side by Side */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Calendar Grid - 2/3 width */}
                    <div className="col-span-2 space-y-2">
                      {/* Calendar Month Navigator */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={handlePreviousMonth}
                          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <h4 className="text-sm font-bold text-slate-800">
                          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h4>
                        <button
                          onClick={handleNextMonth}
                          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {dayNames.map(day => (
                          <div key={day} className="text-center text-[10px] font-semibold text-slate-600">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar days */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {generateCalendarDays().map((dayObj, index) => {
                          const isPast = isPastDate(dayObj.date)
                          const isTodayDate = isToday(dayObj.date)
                          const isSelectedDate = isSelectedDay(dayObj.date)
                          const isTimeInPast = isTodayDate && isPastDateTime(dayObj.date, selectedHour, selectedMinute)
                          
                          return (
                            <button
                              key={index}
                              onClick={() => handleDayClick(dayObj.date)}
                              disabled={isPast}
                              className={`aspect-square flex items-center justify-center text-[10px] font-medium rounded transition-all ${
                                isPast
                                  ? 'bg-transparent text-slate-300 cursor-not-allowed'
                                  : isSelectedDate
                                  ? isTimeInPast
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : 'bg-purple-600 text-white shadow-md'
                                  : isTodayDate
                                  ? 'bg-indigo-100 text-indigo-700 font-bold'
                                  : dayObj.isCurrentMonth
                                  ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-500'
                              }`}
                            >
                              {dayObj.day}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Time Selection - 1/3 width */}
                    <div className="col-span-1 space-y-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-600" />
                        <p className="text-[10px] font-semibold text-slate-700">
                          {tPublish('selectTime', 'Time')}
                        </p>
                      </div>

                      {/* Hour Dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                          {tPublish('hour', 'Hour')}
                        </label>
                        <select
                          value={selectedHour}
                          onChange={(e) => setSelectedHour(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-[10px] bg-white"
                        >
                          {hours.map(hour => (
                            <option key={hour} value={hour}>
                              {hour}:00
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Minute Dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                          {tPublish('minute', 'Min')}
                        </label>
                        <select
                          value={selectedMinute}
                          onChange={(e) => setSelectedMinute(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-[10px] bg-white"
                        >
                          {minutes.map(minute => (
                            <option key={minute} value={minute}>
                              :{minute}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Selected Time Display */}
                      {selectedDate && (
                        <>
                          <div className={`p-1.5 rounded border ${
                            isDateTimeInPast(selectedDate)
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-purple-50 border-purple-200'
                          }`}>
                            <p className={`text-[10px] font-bold leading-tight ${
                              isDateTimeInPast(selectedDate) ? 'text-amber-900' : 'text-purple-900'
                            }`}>
                              📅 {selectedDate.toLocaleDateString(locale, { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                            <p className={`text-[10px] ${
                              isDateTimeInPast(selectedDate) ? 'text-amber-800' : 'text-purple-800'
                            }`}>
                              🕐 {selectedTime}
                            </p>
                          </div>
                          {isDateTimeInPast(selectedDate) && (
                            <div className="p-1.5 bg-red-50 border border-red-200 rounded">
                              <p className="text-[9px] text-red-700 font-semibold">
                                ⚠️ {tPublish('timeInPast', 'Time is in the past')}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT: Posts Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-700">
                      {tPublish('postsTimeline', 'Posts Timeline')}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ⏰ {tPublish('chronological', 'Chronological')}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    {getSortedPosts().map(item => {
                      if (item.type === 'recent' && item.data) {
                        const post = item.data
                        return (
                          <div key={post.id} className="p-2 bg-white rounded-lg border border-slate-200">
                            <div className="flex gap-2">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                {post.thumbnail ? (
                                  <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                    📷
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <PlatformIndicator platform={post.platform} isConnected={isPlatformConnected(post.platform)} />
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                    published
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">{post.title}</p>
                                <p className="text-[10px] text-slate-500 mb-1">{post.time}</p>
                                
                                <div className="flex gap-3 text-[10px] text-slate-600">
                                  <span>👁 {post.engagement.views}</span>
                                  <span>❤️ {post.engagement.likes}</span>
                                  <span>💬 {post.engagement.comments}</span>
                                  <span>↗️ {post.engagement.shares}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      if (item.type === 'selected') {
                        const hasUnconnected = unconnectedPlatforms.length > 0
                        return (
                          <div key="selected" className="p-2 bg-purple-50 rounded-lg border-2 border-purple-400">
                            <div className="flex gap-2">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
                                {photoContent?.uploadedMedia?.[0]?.url ? (
                                  <img 
                                    src={photoContent.uploadedMedia[0].url} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-purple-500 text-lg">📍</span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {selectedPlatforms.map(platform => {
                                    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1)
                                    return (
                                      <PlatformIndicator 
                                        key={platform} 
                                        platform={platformName}
                                        isConnected={isPlatformConnected(platformName)}
                                      />
                                    )
                                  })}
                                  <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                                    selected
                                  </span>
                                </div>
                                
                                <p className="text-xs font-bold text-purple-900 mb-0.5">{getPostTitle()}</p>
                                <p className="text-[10px] text-purple-700 mb-1">
                                  {selectedDate && `${selectedDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })} at ${selectedTime}`}
                                </p>
                                
                                {postContent?.text && (
                                  <p className="text-[10px] text-slate-700 line-clamp-1">
                                    {postContent.text}
                                  </p>
                                )}
                                
                                {hasUnconnected && (
                                  <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                                    <span>⚠️</span> {tPublish('manualPostingRequired', 'Manual post required')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      if (item.type === 'future' && item.data) {
                        const post = item.data
                        return (
                          <div key={post.id} className="p-2 bg-white rounded-lg border border-slate-200">
                            <div className="flex gap-2">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                {post.thumbnail ? (
                                  <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                    📷
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <PlatformIndicator platform={post.platform} isConnected={isPlatformConnected(post.platform)} />
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                    scheduled
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">{post.title}</p>
                                <p className="text-[10px] text-slate-500">{post.time}</p>
                                
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                                  <span className="text-[10px] text-slate-600">{post.timeUntil}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      return null
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2 pb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{tPublish('back', 'Back')}</span>
        </button>
        
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-xs shadow-md flex items-center gap-1.5"
        >
          {isPublishing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{unconnectedPlatforms.length > 0 ? 'Preparing...' : (publishMode === 'now' ? 'Publishing...' : 'Scheduling...')}</span>
            </>
          ) : (
            <>
              <span>{unconnectedPlatforms.length > 0 ? 'Continue' : (publishMode === 'now' ? 'Publish Now' : 'Schedule Post')}</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Manual Post Modal */}
      {showManualPostModal && unconnectedPlatforms.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal content continues in next message due to length */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-900">📋 Ready to Post</h2>
                <button 
                  onClick={() => setShowManualPostModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Your post is ready! Copy and paste to {unconnectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' & ')}.
              </p>

              {/* Platform-specific content */}
              {unconnectedPlatforms.map(platform => {
                const platformName = platform.charAt(0).toUpperCase() + platform.slice(1)
                return (
                  <div key={platform} className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <PlatformIndicator platform={platformName} isConnected={false} />
                      <span className="text-[10px] text-slate-500">{tPublish('manualPostingRequired', 'Manual post required')}</span>
                    </div>
                    
                    <div className="p-2 bg-white rounded border border-slate-200 mb-2 max-h-32 overflow-y-auto">
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">
                        {getFormattedContent(platformName)}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => copyToClipboard(platformName)}
                        className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedPlatform === platformName ? 'Copied!' : 'Copy Post'}
                      </button>
                      <button 
                        onClick={() => openPlatform(platformName)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open {platformName}
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Gentle upsell */}
              <div className="mt-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">
                      Want to save time?
                    </h3>
                    <p className="text-xs text-slate-700 mb-2 leading-relaxed">
                      Connect your platforms to post automatically and track performance.
                    </p>
                    
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="text-emerald-600">✓</span>
                        <span>One-click posting (no copy-paste)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="text-emerald-600">✓</span>
                        <span>Automatic performance tracking</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="text-emerald-600">✓</span>
                        <span>AI learns what works for YOUR audience</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleConnectPlatform(unconnectedPlatforms[0])}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect Platforms
                      </button>
                      <button 
                        onClick={() => setShowManualPostModal(false)}
                        className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800"
                      >
                        Maybe later
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 text-center">
                <button 
                  onClick={() => {
                    setShowManualPostModal(false)
                    onNext()
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  I've posted manually →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
