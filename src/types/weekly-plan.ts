// Weekly Plan Types

export interface PostSpecification {
  id?: string
  // Selection Rationale - Why this post was chosen
  selectionRationale?: string
  
  // Timing
  timing: {
    day: string
    date: string
    time: string
    rationale: string
  }
  
  // Platform & Format
  platformFormat: {
    platform: string
    format: string
    platformRationale: string
    formatRationale: string
  }
  
  // Post Type
  postType: {
    type: string
    category: string
    goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
    priority: 'High' | 'Medium' | 'Low'
    priorityReasons: string[]
  }
  
  // Content Subject
  contentSubject: {
    dish: string
    whyThisDish: string[]
    menuItemId?: string           // UUID for menu_items_normalized (ID-based lookup)
    menuItemName?: string
    menuItemDescription?: string
  }
  
  // Caption
  caption: {
    text: string
    characterCount: number
    tone: string
    emojiCount: number
    ctaType: string
    firstLine: string
    hashtags?: string[]
    isAIGenerated?: boolean
    aiMetadata?: {
      model: string
      generationTime?: number
      tone?: string
      qualityScore?: number
    }
  }
  
  // Visual Direction
  visualDirection: {
    subject: string
    angle: string
    setting: string
    lighting: string
    styling: string
    context: string
    technicalSpecs: {
      dimensions: string
      aspectRatio: string
      fileFormat: string
      duration?: string
      videoCodec?: string
      frameRate?: string
    }
    altText: string
    sceneBreakdown?: {
      scene: number
      duration: string
      action: string
    }[]
  }
  
  // Production Notes
  productionNotes: {
    estimatedTime: string
    logistics: string[]
    timing?: string
  }
  
  // Alternatives
  alternatives: {
    priority: number
    description: string
  }[]
  
  // Media Management
  media: {
    status: 'pending' | 'uploaded' | 'approved' | 'rejected'
    uploadedFiles: {
      url: string
      uploadedAt: string
      uploadedBy: string
    }[]
    selectedFile?: string
    photographerBrief?: string
  }
  
  // Approval Status
  approval: {
    status: 'draft' | 'approved' | 'scheduled' | 'posted'
    approvedAt?: string
    approvedBy?: string
    scheduledFor?: string
    postedAt?: string
    editHistory: {
      field: string
      oldValue: string
      newValue: string
      editedAt: string
      editedBy: string
    }[]
  }

  // Layer 0 strategic context (present when strategy-driven)
  strategicContext?: {
    cta_intent?: string
    suggested_media?: { type: string; direction?: string; description?: string; why?: string; photo_count?: number }
    strategic_fit?: number
    weather_dependent?: boolean
    weather_flag?: string
    estimated_performance?: 'high' | 'medium' | 'low'
    goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
    content_category?: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people'
    slot_id?: string
    rationale?: string
    owner_note_applied?: boolean
    drink_pairing?: string | null
    strategy_brief?: string | null
    media_direction?: string | null
    scene_spec?: string | null
    strategic_intent?: string | null
    // Booking nudge display metadata (optional — only present on booking nudge posts)
    nudge_rationale?: string | null
    peak_day?: string | null                    // ISO date of targeted visit day
    lead_days_used?: number | null              // 1-5: actual lead time chosen by AI
    booking_nudge_warranted?: boolean | null    // AI decision this week
  }

  // Frontend compatibility fields
  idea_id?: number
  title?: string
  cta_text?: string
  visual_direction?: string
  suggested_day?: string
  suggested_time?: string

  // Holiday context (present when post falls on a public holiday)
  holiday_context?: {
    name: string
    strategic_angle: string
    marketing_hook?: string
  }
}

export interface WeeklyContentPlan {
  id: string
  userId: string
  businessId: string
  
  // Week metadata
  weekNumber: number
  weekStart: string
  weekEnd: string
  generatedAt: string
  
  // Posts
  posts: PostSpecification[]
  
  // Summary
  summary: {
    totalPosts: number
    totalProductionTime: string
    postsByPlatform: Record<string, number>
    postsByFormat: Record<string, number>
  }
  
  // Strategy narrative (PATH A only — when plan was generated from a strategy)
  strategyNarrative?: {
    headline: string
    overview: string
    continuation_note?: string
    strategy_reasoning?: {
      primary_angle: string
    }
  }
  strategyId?: string

  // Strategic rationale — why this week's content mix was chosen
  strategicRationale?: string | null

  // Weather forecast for the week (from week_context_snapshot in weekly_strategies)
  weatherDays?: {
    date: string
    temp_min: number
    temp_max: number
    condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog'
    precipitation_chance: number
    wind_speed: number
  }[]

  // Calendar events for the week (holidays, cultural occasions, school vacations)
  calendarEvents?: {
    name: string
    date: string        // YYYY-MM-DD start
    date_end: string | null  // YYYY-MM-DD end (null = single day)
    type: string        // 'holiday' | 'cultural' | 'school_vacation' | 'season' | ...
    commercial_weight: number | null
  }[]

  // Context summary derived from WeekContext (TypeScript-computed, backend-assembled)
  weekSummary?: {
    archetype?: string
    primaryOccasion?: string
    weatherOpportunity?: string
    economicSignal?: string
    topPriority?: string
  }

  // Learning data
  learningData?: {
    userEdits: number
    captionEditsCount: number
    timingChangesCount: number
    platformSwapsCount: number
  }
}
