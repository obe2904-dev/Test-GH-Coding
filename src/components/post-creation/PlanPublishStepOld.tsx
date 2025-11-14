import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'

export function PlanPublishStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { t } = useTranslation()
  const { 
    selectedPlatforms, 
    selectedIdea
  } = usePostCreationStore()
  const { isConnected } = useConnectionsStore()

  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState('14:30')
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 10, 1))
  const [copiedText, setCopiedText] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)

  // Icon components
  const Check = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )

  const Sparkles = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
    </svg>
  )

  const TrendingUp = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )

  const Image = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )

  const Instagram = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )

  const Facebook = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )

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

  const AlertCircle = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )

  const Copy = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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

  // Platform data - checking actual connection status from Business Profile
  const platforms = [
    { 
      name: 'facebook', 
      displayName: 'Facebook', 
      icon: Facebook, 
      color: 'bg-blue-500', 
      connected: isConnected('facebook')
    },
    { 
      name: 'instagram', 
      displayName: 'Instagram', 
      icon: Instagram, 
      color: 'bg-pink-500', 
      connected: isConnected('instagram')
    }
  ]

  // Current post data from store
  const currentPost = {
    text: selectedIdea || t('planPublish.sampleText', 'Your amazing post content will appear here!'),
    hasImage: false, // We'll implement image support later
    selectedPlatforms: selectedPlatforms
  }

  // AI Suggestions
  const aiSuggestions = [
    {
      id: 1,
      day: t('planPublish.friday', 'Friday'),
      date: 'Nov 15',
      fullDate: '2025-11-15',
      time: '2:30 PM',
      timeValue: '14:30',
      reason: t('planPublish.peakActivity', 'Peak audience activity'),
      details: t('planPublish.fridayDetails', 'Your followers are most active on Friday afternoons. Historical data shows 45% higher engagement during this time.'),
      icon: TrendingUp,
      badge: t('planPublish.best', 'Best'),
      badgeColor: 'bg-emerald-500'
    },
    {
      id: 2,
      day: t('planPublish.saturday', 'Saturday'),
      date: 'Nov 16',
      fullDate: '2025-11-16',
      time: '10:00 AM',
      timeValue: '10:00',
      reason: t('planPublish.weekendReach', 'Weekend morning reach'),
      details: t('planPublish.saturdayDetails', 'Saturday mornings capture relaxed audiences browsing social media with their coffee. Great for engagement.'),
      icon: Sun,
      badge: t('planPublish.good', 'Good'),
      badgeColor: 'bg-purple-500'
    },
    {
      id: 3,
      day: t('planPublish.monday', 'Monday'),
      date: 'Nov 18',
      fullDate: '2025-11-18',
      time: '3:00 PM',
      timeValue: '15:00',
      reason: t('planPublish.afternoonBreak', 'Mid-afternoon break'),
      details: t('planPublish.mondayDetails', 'People check social media during afternoon breaks. Solid engagement window for business content.'),
      icon: Users,
      badge: t('planPublish.ok', 'OK'),
      badgeColor: 'bg-blue-500'
    }
  ]

  // Mock recent and upcoming posts
  const recentPosts = [
    {
      id: 1,
      date: '2025-11-10',
      dateDisplay: 'Nov 10',
      time: '2:00 PM',
      text: t('planPublish.recentPost1', 'Latest success story from our clients!'),
      platforms: ['facebook', 'instagram'],
      engagement: { likes: 245, comments: 18 }
    }
  ]

  const upcomingPosts = [
    {
      id: 1,
      date: '2025-11-16',
      dateDisplay: 'Nov 16',
      time: '3:00 PM',
      text: t('planPublish.upcomingPost1', 'Weekend special offer for followers! 🎉'),
      platforms: ['facebook', 'instagram']
    }
  ]

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const getPostsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const recent = recentPosts.filter(p => p.date === dateStr)
    const upcoming = upcomingPosts.filter(p => p.date === dateStr)
    return [...recent, ...upcoming]
  }

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false
    return date.toDateString() === selectedDate.toDateString()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedSuggestion(null)
  }

  const handleSuggestionClick = (suggestion: typeof aiSuggestions[0]) => {
    setSelectedSuggestion(suggestion.id)
    setSelectedDate(new Date(suggestion.fullDate))
    setSelectedTime(suggestion.timeValue)
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const getSelectedInfo = () => {
    if (!selectedDate) return null
    const dateFormatted = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const timeFormatted = new Date(`2000-01-01T${selectedTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return { dateFormatted, timeFormatted }
  }

  const selectedInfo = getSelectedInfo()

  const connectedPlatforms = currentPost.selectedPlatforms.filter(p => 
    platforms.find(plat => plat.name === p && plat.connected)
  )
  const disconnectedPlatforms = currentPost.selectedPlatforms.filter(p => 
    !platforms.find(plat => plat.name === p && plat.connected)
  )

  const copyToClipboard = (content: string, type: 'text' | 'image') => {
    navigator.clipboard.writeText(content)
    if (type === 'text') {
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    } else {
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    }
  }

  const PlatformIcon = ({ name, size = "w-3 h-3" }: { name: string; size?: string }) => {
    if (name === 'facebook') return <Facebook className={size} />
    if (name === 'instagram') return <Instagram className={size} />
    return null
  }

  const handleSchedulePost = () => {
    // Here you would implement the actual scheduling logic
    console.log('Scheduling post for:', selectedDate, selectedTime)
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Post Preview - Always Open */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-2">
            {currentPost.selectedPlatforms.map((platformName, idx) => {
              const platform = platforms.find(p => p.name === platformName)
              const isConnectedPlatform = platform?.connected
              return (
                <div key={idx} className="relative">
                  <div className={`${platform?.color || 'bg-gray-500'} p-2 rounded-lg text-white`}>
                    <PlatformIcon name={platformName} size="w-4 h-4" />
                  </div>
                  {!isConnectedPlatform && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                      <AlertCircle className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{t('planPublish.yourPost', 'Your Post')}</p>
            <p className="text-xs text-slate-600">{t('planPublish.readyToSchedule', 'Ready to schedule')}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {currentPost.hasImage && (
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Image className="w-7 h-7 text-indigo-400" />
            </div>
          )}
          <p className="text-slate-700 text-sm leading-relaxed">{currentPost.text}</p>
        </div>

        {disconnectedPlatforms.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-start gap-2 text-xs bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-amber-900 font-semibold">
                  {disconnectedPlatforms.map(p => platforms.find(plat => plat.name === p)?.displayName).join(', ')} {t('planPublish.notConnected', 'not connected')}
                </span>
                <p className="text-amber-800 mt-1">{t('planPublish.manualCopyRequired', 'You\'ll need to copy and paste manually after scheduling.')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Suggestions with Enhanced Context */}
      <div>
        <h3 className="text-base font-bold text-slate-800 mb-3">{t('planPublish.aiRecommendations', 'AI Recommendations')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {aiSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`suggestion-card relative bg-white rounded-lg p-4 border-2 text-left transition-all hover:shadow-md ${
                selectedSuggestion === suggestion.id
                  ? 'border-indigo-600 shadow-lg ring-2 ring-indigo-100'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className={`absolute top-2 right-2 ${suggestion.badgeColor} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                {suggestion.badge}
              </div>

              {selectedSuggestion === suggestion.id && (
                <div className="absolute top-2 left-2 bg-indigo-600 text-white rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}

              <div className="mb-3 mt-1">
                <div className="inline-flex p-2 bg-indigo-50 rounded-lg">
                  <suggestion.icon className="w-5 h-5 text-indigo-600" />
                </div>
              </div>

              <div className="mb-2">
                <div className="text-lg font-bold text-slate-800">{suggestion.day}</div>
                <div className="text-sm text-slate-600">{suggestion.date}</div>
              </div>

              <div className="text-2xl font-bold text-indigo-600 mb-2">
                {suggestion.time}
              </div>

              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-800 mb-1">{suggestion.reason}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{suggestion.details}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Calendar and Timeline Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left: Calendar */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={previousMonth}
              className="p-1.5 hover:bg-slate-100 rounded transition"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            
            <h3 className="text-base font-bold text-slate-800">{monthName}</h3>
            
            <button 
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 rounded transition"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <div key={idx} className="text-center text-xs font-semibold text-slate-500 py-1">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              const date = new Date(year, month, day)
              const posts = getPostsForDate(date)
              const selected = isSelectedDate(date)
              const today = isToday(date)

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(date)}
                  className={`calendar-day aspect-square rounded-lg p-1 border transition-all text-xs font-medium hover:scale-105 ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : today
                      ? 'bg-blue-50 border-blue-300 text-slate-800'
                      : posts.length > 0
                      ? 'bg-emerald-50 border-emerald-200 text-slate-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>{day}</div>
                  {!selected && posts.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(posts.length, 3) }).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-emerald-600"></div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Time Picker */}
          {selectedDate && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  {t('planPublish.selectTime', 'Select Time')}
                </div>
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Right: Vertical Timeline */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <h3 className="text-base font-bold text-slate-800 mb-3">{t('planPublish.yourSchedule', 'Your Schedule')}</h3>
          
          <div className="space-y-3">
            {/* Selected/New Post */}
            {selectedDate && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">{t('planPublish.yourNewPost', 'Your New Post')}</div>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-3 border-2 border-indigo-400 shadow-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="p-1 bg-white/20 rounded flex-shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">
                        {selectedInfo?.dateFormatted} at {selectedInfo?.timeFormatted}
                      </div>
                      <p className="text-xs text-purple-100 mt-1">{currentPost.text.substring(0, 60)}...</p>
                      <div className="flex gap-1 mt-2">
                        {currentPost.selectedPlatforms.map((platform, idx) => (
                          <div key={idx} className="bg-white/20 backdrop-blur p-1 rounded">
                            <PlatformIcon name={platform} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Posts */}
            {recentPosts.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">{t('planPublish.recentPosts', 'Recent Posts')}</div>
                <div className="space-y-2">
                  {recentPosts.map((post) => (
                    <div key={post.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="p-1 bg-emerald-100 rounded flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800">{post.dateDisplay} at {post.time}</div>
                          <p className="text-xs text-slate-600 mt-1">{post.text}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex gap-1">
                              {post.platforms.map((platform, idx) => (
                                <div key={idx} className="bg-slate-200 p-1 rounded">
                                  <PlatformIcon name={platform} />
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-slate-500">
                              ❤️ {post.engagement.likes}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Posts */}
            {upcomingPosts.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">{t('planPublish.upcomingPosts', 'Upcoming Posts')}</div>
                <div className="space-y-2">
                  {upcomingPosts.map((post) => (
                    <div key={post.id} className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="p-1 bg-indigo-100 rounded flex-shrink-0">
                          <Clock className="w-3 h-3 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800">{post.dateDisplay} at {post.time}</div>
                          <p className="text-xs text-slate-600 mt-1">{post.text}</p>
                          <div className="flex gap-1 mt-2">
                            {post.platforms.map((platform, idx) => (
                              <div key={idx} className="bg-indigo-200 p-1 rounded">
                                <PlatformIcon name={platform} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Copy Section for Disconnected Platforms */}
      {disconnectedPlatforms.length > 0 && selectedDate && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h4 className="text-base font-bold text-amber-900 mb-3 flex items-center gap-2">
            <Copy className="w-4 h-4" />
            {t('planPublish.manualPostingRequired', 'Manual Posting Required')}
          </h4>
          <p className="text-xs text-amber-800 mb-3">
            {t('planPublish.copyContent', 'Copy your content for')} <strong>{disconnectedPlatforms.map(p => platforms.find(plat => plat.name === p)?.displayName).join(', ')}</strong> {t('planPublish.postManually', 'and post manually:')}
          </p>
          
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-amber-900">{t('planPublish.postText', 'Post Text')}</label>
                <button
                  onClick={() => copyToClipboard(currentPost.text, 'text')}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded flex items-center gap-1 transition"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3 h-3" />
                      {t('planPublish.copied', 'Copied!')}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      {t('planPublish.copyText', 'Copy Text')}
                    </>
                  )}
                </button>
              </div>
              <div className="bg-white rounded p-2 border border-amber-200 text-xs text-slate-700 max-h-20 overflow-y-auto">
                {currentPost.text}
              </div>
            </div>

            {currentPost.hasImage && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-amber-900">{t('planPublish.image', 'Image')}</label>
                  <button
                    onClick={() => copyToClipboard('image-url-here', 'image')}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded flex items-center gap-1 transition"
                  >
                    {copiedImage ? (
                      <>
                        <Check className="w-3 h-3" />
                        {t('planPublish.copied', 'Copied!')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        {t('planPublish.copyLink', 'Copy Link')}
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-white rounded p-2 border border-amber-200 flex items-center justify-center h-16">
                  <Image className="w-8 h-8 text-amber-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Button and Confirmation */}
      {selectedDate && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
            <p className="text-indigo-900 font-medium text-sm">
              {t('planPublish.schedulingFor', 'Scheduling for')} {selectedInfo?.dateFormatted} {t('planPublish.at', 'at')} {selectedInfo?.timeFormatted}
            </p>
            {connectedPlatforms.length > 0 && (
              <p className="text-indigo-700 text-xs mt-1">
                {t('planPublish.autoPostingTo', 'Auto-posting to')}: {connectedPlatforms.map(p => platforms.find(plat => plat.name === p)?.displayName).join(', ')}
              </p>
            )}
          </div>

          <div className="text-center">
            <button 
              onClick={handleSchedulePost}
              className="px-10 py-3 rounded-lg text-base font-bold shadow-lg transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {t('planPublish.schedulePost', 'Schedule Post')}
              </div>
            </button>
          </div>
        </>
      )}

      {!selectedDate && (
        <div className="text-center">
          <p className="text-sm text-slate-500">{t('planPublish.selectDateTime', 'Select a date and time to schedule your post')}</p>
        </div>
      )}

      {/* Back Button */}
      <div className="py-6">
        <div className="flex justify-start">
          <button 
            onClick={onBack}
            className="px-8 py-3 text-base font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('planPublish.backToPreview', 'Back to Preview')}
          </button>
        </div>
      </div>
    </div>
  )
}