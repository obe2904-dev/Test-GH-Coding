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

const AlertTriangle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

// Mock data for recent and future posts with enhanced information
const mockRecentPosts = [
  { 
    id: 1, 
    time: 'Wed, 2 days ago, 14:00', 
    title: 'Summer sale announcement', 
    platform: 'Facebook',
    snippet: 'Check out our amazing summer deals...',
    engagement: { views: 1540, likes: 127, comments: 23, shares: 8 },
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&fit=crop',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  { 
    id: 2, 
    time: 'Sun, 5 days ago, 10:30', 
    title: 'New menu items', 
    platform: 'Instagram',
    snippet: 'Introducing our fresh seasonal menu...',
    engagement: { views: 2840, likes: 342, comments: 45, shares: 12 },
    thumbnail: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  }
]

const mockFuturePosts = [
  { 
    id: 3, 
    time: 'Sat, Tomorrow, 16:00', 
    title: 'Weekend special offer', 
    platform: 'Facebook',
    snippet: 'Limited time weekend promo...',
    timeUntil: 'in 18 hours',
    thumbnail: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=100&h=100&fit=crop',
    date: new Date(Date.now() + 18 * 60 * 60 * 1000) // 18 hours from now
  },
  { 
    id: 4, 
    time: 'Fri, 12:00', 
    title: 'Weekly highlights', 
    platform: 'Instagram',
    snippet: 'This week\'s best moments...',
    timeUntil: 'in 4 days',
    thumbnail: 'https://images.unsplash.com/photo-1611095790444-1dfa35e37b52?w=100&h=100&fit=crop',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // 4 days from now
  }
]

// Platform badge component
const PlatformBadge = ({ platform, size = 'sm' }: { platform: string, size?: 'xs' | 'sm' | 'md' }) => {
  const config = {
    Facebook: { 
      bg: 'bg-blue-600', 
      text: 'text-white', 
      border: 'border-blue-700',
      icon: '📘'
    },
    Instagram: { 
      bg: 'bg-gradient-to-r from-purple-600 to-pink-600', 
      text: 'text-white', 
      border: 'border-pink-700',
      icon: '📸'
    }
  }
  
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1'
  }
  
  const style = config[platform as keyof typeof config] || config.Facebook
  
  return (
    <span className={`${sizeClasses[size]} ${style.bg} ${style.text} rounded-full border ${style.border} font-bold shadow-sm inline-flex items-center gap-1`}>
      <span>{style.icon}</span>
      <span>{platform}</span>
    </span>
  )
}

// Platform Indicator component (simpler version for timeline)
const PlatformIndicator = ({ platform }: { platform: string }) => {
  const config = {
    Facebook: { dot: 'bg-blue-600', symbol: 'f' },
    Instagram: { dot: 'bg-pink-600', symbol: 'i' }
  }
  
  const style = config[platform as keyof typeof config] || config.Facebook
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className="text-xs font-medium text-slate-700">{platform}</span>
    </div>
  )
}

export function PublishStep({ onNext, onBack, onStepClick }: PublishStepProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { selectedPlatforms, postContent } = usePostCreationStore()
  const { 
    currentTier, 
    getTierLimits, 
    canSchedulePost, 
    incrementScheduledPost, 
    quotaUsage 
  } = useTierStore()

  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<string>('14')
  const [selectedMinute, setSelectedMinute] = useState<string>('00')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isPublishing, setIsPublishing] = useState(false)
  const [schedulingConflicts, setSchedulingConflicts] = useState<string[]>([])
  
  // Combine hour and minute into time string
  const selectedTime = `${selectedHour}:${selectedMinute}`

  // AI-suggested times
  const aiSuggestions = [
    {
      id: 1,
      time: 'Today, 18:00',
      date: new Date(new Date().setHours(18, 0, 0, 0)),
      reason: t('publish.suggestion1', 'Peak evening engagement'),
      expectedReach: 'High',
      icon: Sun,
      color: 'emerald'
    },
    {
      id: 2,
      time: 'Tomorrow, 10:00',
      date: new Date(new Date().setDate(new Date().getDate() + 1)),
      reason: t('publish.suggestion2', 'Morning coffee scroll time'),
      expectedReach: 'Medium',
      icon: Users,
      color: 'amber'
    },
    {
      id: 3,
      time: 'Friday, 12:00',
      date: new Date(new Date().setDate(new Date().getDate() + 3)),
      reason: t('publish.suggestion3', 'Lunch break browsing'),
      expectedReach: 'High',
      icon: TrendingUp,
      color: 'emerald'
    }
  ]

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    // Convert Sunday (0) to 6, and shift other days back by 1 to start week on Monday
    return day === 0 ? 6 : day - 1
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
    // If clicking a day from prev/next month, update the current month view
    if (date.getMonth() !== currentMonth.getMonth()) {
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  const handleSuggestionClick = (suggestion: typeof aiSuggestions[0]) => {
    setSelectedSuggestion(suggestion.id)
    setSelectedDate(suggestion.date)
    const time = suggestion.time.split(', ')[1]
    const [hour, minute] = time.split(':')
    setSelectedHour(hour)
    setSelectedMinute(minute)
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  // Combine and sort all posts chronologically
  const getSortedPosts = () => {
    const allPosts: Array<{
      id: string | number
      date: Date
      type: 'recent' | 'selected' | 'future'
      data?: any
    }> = []

    // Add recent posts
    mockRecentPosts.forEach(post => {
      allPosts.push({
        id: post.id,
        date: post.date,
        type: 'recent',
        data: post
      })
    })

    // Add selected post if exists and is not in the past
    if (selectedDate) {
      const selectedDateTime = new Date(selectedDate)
      selectedDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute))
      
      // Only add if the selected time is in the future
      if (selectedDateTime >= new Date()) {
        allPosts.push({
          id: 'selected',
          date: selectedDateTime,
          type: 'selected'
        })
      }
    }

    // Add future posts
    mockFuturePosts.forEach(post => {
      allPosts.push({
        id: post.id,
        date: post.date,
        type: 'future',
        data: post
      })
    })

    // Sort by date (oldest to newest)
    return allPosts.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  // Time interval setting (can be changed in settings later)
  const timeInterval = 15 // minutes

  const handlePublish = async () => {
    if (publishMode === 'schedule') {
      if (!canSchedulePost()) {
        alert(t('publish.scheduleQuotaExceeded', `You've reached your monthly limit. ${currentTier === 'free' ? 'Upgrade to StandardPlus for unlimited scheduling!' : 'Try publishing now instead.'}`))
        return
      }
      
      // Check if selected time is in the past
      if (selectedDate) {
        const selectedDateTime = new Date(selectedDate)
        selectedDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute))
        if (selectedDateTime < new Date()) {
          alert(t('publish.cannotSchedulePast', 'Cannot schedule a post in the past. Please select a future date and time.'))
          return
        }
      }
    }
    
    setIsPublishing(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('Publishing to:', selectedPlatforms)
    console.log('Mode:', publishMode)
    if (publishMode === 'schedule') {
      console.log('Scheduled for:', selectedDate, selectedTime)
      incrementScheduledPost()
    }
    
    setIsPublishing(false)
    onNext()
  }

  const canPublish = () => {
    if (publishMode === 'now') return true
    if (publishMode === 'schedule' && selectedDate && selectedTime) {
      // Check if the selected time is in the future
      const selectedDateTime = new Date(selectedDate)
      selectedDateTime.setHours(parseInt(selectedHour), parseInt(selectedMinute))
      return selectedDateTime >= new Date()
    }
    return false
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // Week starts on Monday

  // Generate hour and minute options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const minutes = Array.from({ length: 60 / timeInterval }, (_, i) => (i * timeInterval).toString().padStart(2, '0'))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {t('publish.title', 'Schedule & Publish')}
        </h1>
        <p className="text-base text-slate-600">
          {t('publish.subtitle', 'Choose when to publish your post')}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={3} totalSteps={3} onStepClick={onStepClick} />

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
                    {t('publish.publishNow', 'Publish Now')}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {t('publish.publishNowDesc', 'Post immediately')}
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
                    {t('publish.schedule', 'Schedule')}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {t('publish.scheduleDesc', 'Best time')}
                  </p>
                  {currentTier === 'free' && (
                    <p className="text-xs text-purple-600 mt-0.5 font-semibold">
                      {quotaUsage.scheduledPostsThisMonth}/{getTierLimits(currentTier).scheduledPostsPerMonth} {t('publish.used', 'used')}
                    </p>
                  )}
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
              
              {/* AI Suggestions - HORIZONTAL ROW */}
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {t('publish.aiSuggestions', 'AI-Suggested Times')}
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
                    {t('publish.calendar', 'Calendar & Timeline')}
                  </h3>
                </div>

                {/* Two-column layout: Calendar on left, Timeline on right */}
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
                            {t('publish.selectTime', 'Time')}
                          </p>
                        </div>

                        {/* Hour Dropdown */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                            {t('publish.hour', 'Hour')}
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
                            {t('publish.minute', 'Min')}
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
                                📅 {selectedDate.toLocaleDateString(t('locale', 'en-US'), { 
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
                                  ⚠️ {t('publish.timeInPast', 'Time is in the past')}
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
                        {t('publish.postsTimeline', 'Posts Timeline')}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        ⏰ Chronological order
                      </p>
                    </div>
                    
                    {/* Timeline without scrolling */}
                    <div className="space-y-2">
                      {getSortedPosts().map(item => {
                        // Recent/Posted Post
                        if (item.type === 'recent' && item.data) {
                          const post = item.data
                          return (
                            <div key={post.id} className="p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                              <div className="flex gap-2">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                  {post.thumbnail ? (
                                    <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                      📷
                                    </div>
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <PlatformIndicator platform={post.platform} />
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                      Published
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">{post.title}</p>
                                  <p className="text-[10px] text-slate-500 mb-1">{post.time}</p>
                                  
                                  {/* Engagement metrics */}
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
                        
                        // Selected/Current Post - IN CHRONOLOGICAL POSITION
                        if (item.type === 'selected') {
                          return (
                            <div key="selected" className="p-2 bg-purple-50 rounded-lg border-2 border-purple-400">
                              <div className="flex gap-2">
                                {/* Thumbnail placeholder */}
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-purple-100 flex-shrink-0 flex items-center justify-center">
                                  <span className="text-purple-500 text-lg">📍</span>
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {selectedPlatforms.map(platform => (
                                        <PlatformIndicator key={platform} platform={platform.charAt(0).toUpperCase() + platform.slice(1)} />
                                      ))}
                                    </div>
                                    <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                                      Selected
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-purple-900 mb-0.5">Your New Post</p>
                                  <p className="text-[10px] text-purple-700 mb-0.5">
                                    {selectedDate && (
                                      <>
                                        {selectedDate.toLocaleDateString(t('locale', 'en-US'), { weekday: 'short', month: 'short', day: 'numeric' })} at {selectedTime}
                                      </>
                                    )}
                                  </p>
                                  {postContent?.headline && (
                                    <p className="text-[10px] text-slate-700 line-clamp-1">
                                      {postContent.headline}
                                    </p>
                                  )}
                                  
                                  {/* Conflict indicator */}
                                  {schedulingConflicts.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                      <p className="text-[9px] text-amber-800 font-semibold">
                                        Close to {schedulingConflicts.length} other post{schedulingConflicts.length > 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                        
                        // Future/Scheduled Post
                        if (item.type === 'future' && item.data) {
                          const post = item.data
                          return (
                            <div key={post.id} className="p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                              <div className="flex gap-2">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                  {post.thumbnail ? (
                                    <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                      📷
                                    </div>
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <PlatformIndicator platform={post.platform} />
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                      Scheduled
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">{post.title}</p>
                                  <p className="text-[10px] text-slate-500">{post.time}</p>
                                  
                                  {/* Time until */}
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

              {/* Platform Summary */}
              <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-200">
                <p className="text-xs text-indigo-800">
                  📤 {t('publish.postingTo', 'Posting to')}:{' '}
                  <span className="font-semibold">
                    {selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                  </span>
                </p>
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
          <span>{t('publish.back', 'Back')}</span>
        </button>
        
        <button
          onClick={handlePublish}
          disabled={!canPublish() || isPublishing}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-xs shadow-md flex items-center gap-1.5"
        >
          {isPublishing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{publishMode === 'now' ? t('publish.publishing', 'Publishing...') : t('publish.scheduling', 'Scheduling...')}</span>
            </>
          ) : (
            <>
              <span>{publishMode === 'now' ? t('publish.publishButton', 'Publish Now') : t('publish.scheduleButton', 'Schedule Post')}</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
