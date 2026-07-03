# LAYER 9: WEEKLY PLAN OUTPUT SPECIFICATION

## Overview
Layer 9 generates complete weekly content plans with production-ready post specifications. Integrates all previous layers (5-8) into actionable output.

## Architecture

```
INPUTS (from Layers 5-8)
├─ Layer 5: Content opportunities (menu items, themes, compound patterns)
├─ Layer 6: Optimal day/time scheduling
├─ Layer 7: Media format & platform selection
└─ Layer 8: Caption & visual direction generation
    ↓
LAYER 9 PROCESSING
├─ Assemble 4 weekly posts (FSE/SBO) or 5-7 (MFV/MFD/QSR)
├─ Generate complete specifications
├─ Add alternatives & production notes
├─ Calculate total production time
└─ Format for display
    ↓
OUTPUT: WeeklyContentPlan
├─ Week metadata (dates, post count, total time)
├─ Post specifications (4-7 complete briefs)
├─ Learning feedback tracking
└─ Export/display formats
```

---

## 1. POST SPECIFICATION FORMAT

Each post contains:

### A. Timing Section
```typescript
timing: {
  day: string                    // "Monday", "Wednesday"
  date: string                   // "March 17, 2025"
  time: string                   // "11:00"
  rationale: string              // "Late morning for lunch awareness..."
}
```

### B. Platform & Format Section
```typescript
platformFormat: {
  platform: string               // "instagram", "facebook"
  format: string                 // "photo", "carousel", "reel"
  platformRationale: string      // "Visual dish beauty..."
  formatRationale: string        // "Quick production..."
}
```

### C. Post Type Section
```typescript
postType: {
  type: string                   // "menu_highlight", "behind_scenes"
  category: string               // "Seasonal Feature", "Signature Dish"
  priority: string               // "High", "Medium", "Low"
  priorityReasons: string[]      // ["seasonal", "location match", "weather boost"]
}
```

### D. Content Subject Section
```typescript
contentSubject: {
  dish: string                   // "Pan-Seared Salmon with Asparagus"
  whyThisDish: string[]          // Bullet points explaining selection
  /* Examples:
     - "Seasonal ingredients (Spring: asparagus, new potatoes)"
     - "Signature preparation (high past performance)"
     - "Weather appropriate (light, fresh for sunny weather)"
     - "Location match (seafood + waterfront = strong fit)"
     - "Not posted in last 21 days"
  */
}
```

### E. Caption Section
```typescript
caption: {
  text: string                   // Full caption draft
  characterCount: number         // 280
  tone: string                   // "casual-refined tone"
  emojiCount: number            // 1
  ctaType: string               // "soft CTA"
}
```

### F. Visual Direction Section
```typescript
visualDirection: {
  subject: string                // "Plated salmon dish"
  angle: string                  // "45-degree angle showing full plate"
  setting: string                // "Terrace table, water view blurred"
  lighting: string               // "Natural daylight, warm spring tones"
  styling: string                // "Bright, fresh, green asparagus prominent"
  context: string                // "Optional wine glass for lifestyle feel"
  technicalSpecs: {
    dimensions: string
    aspectRatio: string
    fileFormat: string
  }
  altText: string                // Accessibility description
}
```

### G. Production Notes Section
```typescript
productionNotes: {
  estimatedTime: string          // "5-10 minutes"
  logistics: string[]            // ["Shoot during lunch service", "Need wine glass prop"]
  timing: string                 // "Best shot: 11:30-12:30 natural light"
}
```

### H. Alternatives Section
```typescript
alternatives: [
  { priority: 1, description: "New potato side dish feature" },
  { priority: 2, description: "Spring ingredient story (asparagus sourcing)" }
]
```

### I. Media Management Section
```typescript
media: {
  status: 'pending' | 'uploaded' | 'approved' | 'rejected'
  uploadedFiles: {
    url: string
    uploadedAt: string
    uploadedBy: string
  }[]
  selectedFile?: string          // URL of chosen image/video
  photographerBrief?: string     // Exported PDF URL
}
```

### J. Approval Status Section
```typescript
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
```

---

## 2. WEEKLY PLAN STRUCTURE

```typescript
interface WeeklyContentPlan {
  id: string
  userId: string
  businessId: string
  
  // Week metadata
  weekNumber: number             // 12
  weekStart: string              // "2025-03-17"
  weekEnd: string                // "2025-03-23"
  generatedAt: string            // "2025-03-15T10:30:00Z"
  
  // Posts (4-7 depending on business type)
  posts: PostSpecification[]
  
  // Summary
  summary: {
    totalPosts: number           // 4
    totalProductionTime: string  // "90 minutes"
    postsByPlatform: {
      instagram: number
      facebook: number
    }
    postsByFormat: {
      photo: number
      carousel: number
      reel: number
    }
  }
  
  // Learning tracking
  learningData?: {
    userEdits: number
    captionEditsCount: number
    timingChangesCount: number
    platformSwapsCount: number
  }
}
```

---

## 3. GENERATION LOGIC

### Step-by-Step Process:

**1. Determine Post Count**
```typescript
const postCount = {
  FSE: 4,  // Fine Dining
  SBO: 4,  // Small Business
  MFV: 5,  // Multiple Locations
  MFD: 6,  // Multiple per Day
  QSR: 7,  // Quick Service (high volume)
}[businessType]
```

**2. Generate Content Opportunities (Layer 5)**
```typescript
// Select 4-7 best opportunities for the week
const opportunities = await selectWeeklyOpportunities({
  count: postCount,
  excludeRecentDays: 21,
  diversityRules: true,
})
```

**3. Assign Day/Time Slots (Layer 6)**
```typescript
// Optimize posting schedule
const scheduledPosts = await optimizePostSlots({
  opportunities,
  businessHours,
  historicalPerformance,
})
```

**4. Select Format & Platform (Layer 7)**
```typescript
// Determine photo/carousel/reel and platform
const withFormats = await selectMediaFormats({
  posts: scheduledPosts,
  recentFormats,
  platformBalancing: true,
})
```

**5. Generate Captions & Visuals (Layer 8)**
```typescript
// Create production-ready briefs
const completeBriefs = await generateContentBriefs({
  posts: withFormats,
  brandVoice,
  seasonalContext,
  locationContext,
})
```

**6. Add Production Notes & Alternatives**
```typescript
// Enhance with practical details
const finalPosts = addProductionDetails(completeBriefs)
```

**7. Assemble Weekly Plan**
```typescript
// Package everything together
const weeklyPlan = {
  weekNumber,
  posts: finalPosts,
  summary: calculateSummary(finalPosts),
}
```

---

## 4. DISPLAY FORMAT

### Weekly Overview Card
```
┌─────────────────────────────────────────────────────┐
│ Uge 12: 17. marts - 23. marts 2025                  │
│ 4 Opslag • Est. 90 min produktion                   │
│ [Generer ny plan] [Eksporter PDF]                   │
├─────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │ MON 17   │ │ WED 19   │ │ THU 20   │ │ SAT 22   ││
│ │ 11:00    │ │ 14:30    │ │ 17:00    │ │ 09:00    ││
│ │────────  │ │────────  │ │────────  │ │────────  ││
│ │ 📸 Menu  │ │ 📸 Menu  │ │ 🌅 Atmos │ │ 🎬 Behind││
│ │ Salmon   │ │ Burger   │ │ Terrace  │ │ Market   ││
│ │────────  │ │────────  │ │────────  │ │────────  ││
│ │ Instagram│ │ Facebook │ │ Instagram│ │ Instagram││
│ │ Photo    │ │ Photo    │ │ Photo    │ │ Carousel ││
│ │────────  │ │────────  │ │────────  │ │────────  ││
│ │ 5-10 min │ │ 5-10 min │ │ 10-15min │ │ 15-20min ││
│ │ [Kladde] │ │ [Kladde] │ │ [Kladde] │ │ [Kladde] ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
└─────────────────────────────────────────────────────┘
```

### Detailed Post Modal
(Opens when clicking a post card)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 POST 1 SPECIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 TIMING
Day: Mandag
Date: 17. marts 2025
Time: 11:00
Rationale: Late morning for lunch awareness...

📱 PLATFORM & FORMAT
Platform: Instagram
Format: Single Photo
[Edit Platform] [Edit Format]

💬 CAPTION
[Editable text area with draft caption]
280 chars • casual-refined tone • 1 emoji
[Copy Caption]

📸 VISUAL DIRECTION
Subject: Plated salmon dish
Angle: 45-degree angle showing full plate
[Full visual details...]

📦 MEDIA
Status: Pending Upload
[Upload Photo/Video]
[Request Photo from Photographer]

✅ ACTIONS
[Mark as Approved] [Save Edits] [Export Brief]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. USER EDIT TRACKING

When user modifies any field, track for learning:

### Caption Edits
```typescript
interface CaptionEdit {
  originalCaption: string
  editedCaption: string
  changes: {
    tonalShift?: 'more_casual' | 'more_refined' | 'more_playful'
    emojiChange?: 'added' | 'removed' | 'changed'
    lengthChange?: 'shorter' | 'longer'
    ctaChange?: 'softer' | 'stronger' | 'removed'
    structureChange?: 'reordered' | 'simplified'
  }
}
```

### Timing Changes
```typescript
interface TimingEdit {
  originalDay: string
  originalTime: string
  newDay: string
  newTime: string
  reasonGiven?: string
}
```

### Content Swaps
```typescript
interface ContentSwap {
  originalDish: string
  replacementDish: string
  reasonGiven?: string
}
```

### Learning Application
After 10+ edits, automatically:
- Adjust caption tone in Layer 8
- Update posting time preferences in Layer 6
- Learn content preferences in Layer 5
- Notify user: "AI har lært fra dine redigeringer"

---

## 6. EXPORT FORMATS

### PDF Brief for Photographer
```
┌─────────────────────────────────────┐
│ FOTOGRAF BRIEF                      │
│ Post: Mandag 17. marts, 11:00      │
├─────────────────────────────────────┤
│ MOTIV: Pan-seared salmon            │
│                                      │
│ VINKEL: 45-grader, vis hele tallerk │
│                                      │
│ SETTING: Terrassebord, vandvisning  │
│                                      │
│ LYS: Naturligt dagslys, varme toner │
│                                      │
│ STYLING: Lyse farver, grøn asparges │
│                                      │
│ TEKNISK: 1080x1080, JPG, RGB        │
│                                      │
│ TID: Bedst 11:30-12:30              │
└─────────────────────────────────────┘
```

### Weekly Plan PDF
Complete 4-post overview with all details for printing/sharing.

---

## 7. DATABASE SCHEMA

### Table: weekly_content_plans
```sql
CREATE TABLE weekly_content_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  business_id UUID REFERENCES businesses(id),
  
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  posts JSONB NOT NULL,  -- Array of PostSpecification
  summary JSONB,
  learning_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_plans_user ON weekly_content_plans(user_id);
CREATE INDEX idx_weekly_plans_week ON weekly_content_plans(week_start);
```

### Table: post_approvals
```sql
CREATE TABLE post_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES weekly_content_plans(id),
  post_index INT NOT NULL,  -- 0-6 (position in weekly plan)
  
  status TEXT CHECK (status IN ('draft', 'approved', 'scheduled', 'posted')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  media_uploads JSONB,  -- Array of uploaded files
  selected_media TEXT,  -- URL of chosen image/video
  
  edit_history JSONB,   -- Array of edit records
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## STATUS: Ready for Implementation ✅

Next steps:
1. ✅ Create weekly-plan-generator.ts (backend assembler)
2. ✅ Create AI-Ugentlig-Plan page component (frontend)
3. ✅ Create PostCard component (card display)
4. ✅ Create PostDetailModal component (detailed view)
5. ✅ Create media upload handler
6. ✅ Create edit tracking system
7. ✅ Create test suite
8. ✅ Integrate with existing sidebar navigation
