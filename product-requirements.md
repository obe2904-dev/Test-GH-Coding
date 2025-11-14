# Social Media SaaS for Small Businesses
## Product Requirements Document

**Version:** 1.0  
**Date:** October 22, 2025  
**Target:** Small businesses with limited resources (time, money, expertise)

---

## 1. MVP Feature Backlog

### Priority Matrix
Features prioritized by **Impact** (addresses core pain) × **Effort** (time to build)

#### 🔴 P0 - Critical MVP (Launch Blockers)

| Feature | Design Criteria Mapping | Business Impact | Effort |
|---------|------------------------|-----------------|--------|
| **Post Scheduler** | Automation Focus (1.1) | Saves 5-10 hrs/week | Medium |
| **Platform Connection** (FB, IG, LinkedIn) | Platform Guidance (2.3) | Core functionality | Medium |
| **AI Content Prompts & Templates** | Intelligent Content (2.1) | Solves expertise gap | High |
| **Simplified 3-Metric Dashboard** | Simplified Reporting (3.1) | Proves ROI quickly | Medium |
| **Guided Onboarding (5 min)** | Low Learning Curve (1.2) | Reduces churn | Low |
| **Mobile-Responsive Web App** | Mobile-First (1.4) | 60% of users on mobile | Medium |

#### 🟡 P1 - High Value (Launch Window: +2 weeks)

| Feature | Design Criteria Mapping | Business Impact | Effort |
|---------|------------------------|-----------------|--------|
| **Unified Inbox** (all comments/DMs) | Unified Inbox (4.1) | Improves engagement | High |
| **Evergreen Content Library** | Automation Focus (1.1) | Enables auto-repost | Medium |
| **Stock Photo/Video Library** | Visual Asset Library (2.2) | Removes design barrier | Low* |
| **Free Tier (1 platform, 10 posts/mo)** | Affordable Tiering (1.3) | Drives acquisition | Low |

*Assumes 3rd-party API integration (Unsplash/Pexels)

#### 🟢 P2 - Nice to Have (Post-Launch, Month 2-3)

| Feature | Design Criteria Mapping | Business Impact | Effort |
|---------|------------------------|-----------------|--------|
| **Negative Feedback Alerts** | Negative Feedback (4.2) | Crisis management | Medium |
| **UGC Reshare Tool** | UGC Integration (4.3) | Builds trust | Medium |
| **Industry Benchmarking** | Benchmarking (3.3) | Competitive insight | High |
| **3rd-Party Content Curation** | Automation Focus (1.1) | Fills content gaps | Medium |
| **Goal Setting & Tracking** | Goal Setting (3.3) | Increases retention | Low |

---

## 2. User Stories & Acceptance Criteria

### Epic 1: Quick Setup & Onboarding

#### US-001: Fast Platform Connection
**As a** small business owner  
**I want to** connect my social media accounts in under 2 minutes  
**So that** I can start scheduling without technical hassle

**Acceptance Criteria:**
- OAuth flow for Facebook, Instagram, LinkedIn
- Maximum 3 clicks per platform
- Clear permission explanations (no jargon)
- Error messages suggest fixes, not error codes

**Success Metric:** 80% complete connection on first attempt

---

#### US-002: Guided First Post
**As a** new user with no social media experience  
**I want** step-by-step guidance to create my first post  
**So that** I feel confident using the tool

**Acceptance Criteria:**
- Onboarding wizard prompts for business type (dropdown)
- Suggests 3 platform-specific templates based on industry
- Preview shows how post looks on each platform
- One-click "Schedule for Best Time"

**Success Metric:** 70% publish first post within 10 minutes of signup

---

### Epic 2: Content Creation Automation

#### US-003: AI Content Suggestions
**As a** bakery owner with no marketing background  
**I want** AI to generate post ideas and captions  
**So that** I don't stare at a blank screen

**Acceptance Criteria:**
- Input: business type, platform, topic/product
- Output: 3 caption variations (short, medium, long) + 5 hashtags
- "Tone" selector: Professional, Friendly, Playful
- Edit inline before scheduling

**Success Metric:** 60% of users use AI suggestions weekly

---

#### US-004: Template Library
**As a** service business owner  
**I want** ready-made post templates for common scenarios  
**So that** I can post consistently without starting from scratch

**Acceptance Criteria:**
- 20+ templates per category: Promotion, Tip, Behind-the-Scenes, Testimonial
- Platform-specific formats (Reels script vs LinkedIn carousel)
- Customizable placeholders for [Business Name], [Offer], etc.
- Preview with stock images

**Success Metric:** 50% of posts use templates in first month

---

#### US-005: Stock Media Library
**As a** solo entrepreneur  
**I want** free stock photos and basic video clips  
**So that** my posts look professional without hiring a designer

**Acceptance Criteria:**
- Search by keyword (integrated Unsplash/Pexels API)
- Filter by platform format (square, portrait, landscape)
- Basic crop/filter tools (brightness, contrast, 3 filters)
- No watermarks on free tier (attribution handled automatically)

**Success Metric:** 40% of posts include stock media

---

### Epic 3: Scheduling & Automation

#### US-006: Smart Scheduler
**As a** busy retailer  
**I want** to schedule a week of posts in 30 minutes  
**So that** I maintain presence without daily effort

**Acceptance Criteria:**
- Bulk upload (up to 10 posts at once)
- "Auto-schedule" suggests optimal times based on platform data
- Calendar view shows all scheduled posts
- Drag-and-drop to reschedule

**Success Metric:** Average 8 posts scheduled per session

---

#### US-007: Evergreen Content Reposting
**As a** consultant  
**I want** my best-performing posts to auto-reshare every 90 days  
**So that** I maximize content ROI without manual tracking

**Acceptance Criteria:**
- Mark any post as "Evergreen"
- Set repost interval (30/60/90 days)
- Slight variation in caption (AI rephrases)
- Performance threshold: only repost if >10 engagements

**Success Metric:** 30% of posts marked evergreen by power users

---

### Epic 4: Engagement & Inbox

#### US-008: Unified Inbox
**As a** restaurant owner active on 3 platforms  
**I want** all comments and DMs in one place  
**So that** I never miss a customer question

**Acceptance Criteria:**
- Real-time sync from FB, IG, LinkedIn (polling every 5 min)
- Prioritize: Unanswered > Questions > Mentions
- Reply from app (posts back to original platform)
- Mark as read/archived

**Success Metric:** 90% of messages answered within 24 hours

---

#### US-009: Negative Sentiment Alert
**As a** brand-conscious business  
**I want** urgent alerts for negative comments  
**So that** I can respond before it escalates

**Acceptance Criteria:**
- Keyword detection: "bad," "terrible," "refund," "disappointed," etc.
- Push notification + email within 15 minutes
- Suggested response templates for common issues
- Escalation flag for manual review

**Success Metric:** 80% of negative comments addressed within 2 hours

---

### Epic 5: Performance Insights

#### US-010: Simple Dashboard
**As a** small business owner  
**I want** to see 3 numbers that prove social media is working  
**So that** I justify my time investment

**Acceptance Criteria:**
- Display only: Reach, Engagement Rate, Link Clicks
- Week-over-week % change with green/red arrows
- One-sentence insight: "Your posts on Tuesday get 2× engagement"
- Export to PDF for stakeholder reports

**Success Metric:** 70% check dashboard weekly

---

#### US-011: Goal Tracking
**As a** growth-focused entrepreneur  
**I want** to set a monthly engagement goal  
**So that** I stay motivated and measure progress

**Acceptance Criteria:**
- Set goal: "Increase followers by 50" or "Get 100 link clicks"
- Progress bar on dashboard
- Weekly reminder if <50% toward goal
- Celebrate when goal hit (confetti animation + suggestion to set new goal)

**Success Metric:** 40% of users set goals, 25% achieve them

---

#### US-012: Platform Recommendation
**As a** B2B service provider unsure where to focus  
**I want** the app to tell me which platform fits my business  
**So that** I don't waste time on ineffective channels

**Acceptance Criteria:**
- Quiz during onboarding: Industry, Audience (B2B/B2C), Content type
- Output: Ranked list (1. LinkedIn, 2. Facebook) with reasoning
- Suggest content cadence per platform
- Option to skip and connect all

**Success Metric:** 60% follow recommendation for primary platform

---

## 3. Tech Stack & Architecture

### Frontend
- **Web:** React (Vite) + TypeScript
- **Mobile:** React Native (code reuse with web components)
- **State:** Zustand (lightweight vs Redux)
- **UI:** Tailwind CSS + Radix UI (accessible components)

### Backend
- **API:** Node.js (Express) or Python (FastAPI)  
  *Recommendation:* **FastAPI** for async social API calls + simpler AI integration
- **Database:** PostgreSQL (structured data) + Redis (job queue for scheduling)
- **File Storage:** AWS S3 or Cloudflare R2 (cheaper egress)

### Integrations
- **Social APIs:** Meta Graph API, LinkedIn API
- **AI:** OpenAI GPT-4o-mini (cost-effective for content generation)
- **Stock Media:** Unsplash API (free tier) + Pexels API
- **Auth:** Clerk or Auth0 (OAuth handling)
- **Payments:** Stripe (subscription billing)

### Infrastructure
- **Hosting:** Vercel (frontend) + Railway or Render (backend)
- **Scheduling:** BullMQ (Redis-based job queue)
- **Monitoring:** Sentry (errors) + PostHog (product analytics)

### Data Model Highlights

```
Users
├── id, email, created_at
├── business_type (enum: retail, food, services, etc.)
├── onboarding_completed (boolean)

ConnectedAccounts
├── user_id (FK)
├── platform (enum: facebook, instagram, linkedin)
├── access_token (encrypted)
├── account_id, account_name

Posts
├── id, user_id (FK)
├── content, media_urls[]
├── scheduled_time, published_time
├── platforms[] (multi-post)
├── is_evergreen, repost_interval
├── status (enum: draft, scheduled, published, failed)

Templates
├── id, category, platform
├── content_template, preview_image_url
├── industry_tags[]

Inbox
├── id, user_id (FK), account_id (FK)
├── platform_message_id (unique)
├── message_type (comment, dm, mention)
├── sender_name, content
├── sentiment_score (-1 to 1)
├── is_read, replied_at

Analytics (aggregated daily)
├── user_id, account_id, date
├── reach, impressions, engagement_count
├── link_clicks, follower_count
```

---

## 4. UI Flows & Key Screens

### Flow 1: Onboarding (5 minutes)

```
1. Sign Up (Email/Google)
   ↓
2. "What kind of business?" (Dropdown: Bakery, Salon, Consulting, etc.)
   ↓
3. Connect Platforms (Cards: FB, IG, LinkedIn - skip allowed)
   ↓
4. "Let's create your first post"
   → AI suggests 3 templates for [Bakery]
   → User picks one, edits caption
   → Preview on right panel
   ↓
5. "When should we post?" (Auto-schedule vs Pick Time)
   ↓
6. Confirmation: "Your post is scheduled for Thursday at 10 AM!"
   → CTA: "Go to Dashboard" or "Schedule More"
```

**Wireframe Notes:**
- **Step 2:** Icon grid (visual selection, not just text dropdown)
- **Step 4:** Split screen - templates on left, live preview on right
- **Step 5:** Calendar picker with green "Recommended Times" badges

---

### Flow 2: Creating & Scheduling a Post

```
Dashboard → "New Post" Button
   ↓
Composer Screen
├── Platform selector (toggle FB/IG/LinkedIn)
├── Text editor with AI assist button
│   → Click AI: Modal opens "What's this post about?" → Generates 3 options
├── Media uploader OR "Browse Stock Photos"
├── Preview panel (shows platform-specific formatting)
├── Schedule options:
│   • Post Now
│   • Auto-Schedule (shows suggested time)
│   • Pick Date/Time (calendar)
│   • Add to Queue (publishes at next available slot)
└── Save Draft / Schedule
```

**Wireframe Notes:**
- **Platform selector:** Pill buttons with platform logos
- **AI assist:** Purple sparkle icon ✨ in toolbar
- **Preview:** Tabs for each selected platform (mobile mockups)

---

### Flow 3: Unified Inbox

```
Inbox Tab
├── Filter Bar: All / Unanswered / Urgent
├── Message List (left sidebar)
│   Each item shows:
│   • Platform icon
│   • Sender avatar + name
│   • Message preview (truncated)
│   • Timestamp
│   • Sentiment badge (⚠️ if negative)
│
└── Message Detail (right panel)
    ├── Full conversation thread
    ├── Reply box (posts back to original platform)
    ├── Quick Actions: Mark Read, Archive, Flag
    └── AI-suggested replies (for common questions)
```

**Wireframe Notes:**
- **Urgent filter:** Red dot badge with count
- **Sentiment badge:** Yellow/red if keywords detected
- **Quick replies:** Dropdown with "Thanks for your message!", "We're looking into this", etc.

---

### Flow 4: Dashboard (3-Metric View)

```
Dashboard Home
├── Header: "This Week's Performance"
├── 3 Big Numbers (cards):
│   1. Reach: 2,340 (+18% ↑)
│   2. Engagement Rate: 4.2% (-0.3% ↓)
│   3. Link Clicks: 87 (+22% ↑)
│
├── Insight Card: 
│   💡 "Your Tuesday posts get 2× more engagement. Schedule more then!"
│
├── Recent Posts (last 5)
│   Table: Post, Platform, Scheduled, Reach, Engagement
│
└── Quick Actions:
    • New Post
    • View Inbox (badge if unread)
    • Schedule This Week
```

**Wireframe Notes:**
- **Big Numbers:** Large font (48px), green/red arrows, tooltip for "vs last week"
- **Insight Card:** Light bulb icon, yellow background, actionable suggestion
- **Recent Posts:** Clickable rows (opens post detail with full analytics)

---

## 5. Pricing Tiers & KPIs

### Pricing Strategy

| Tier | Price | Limits | Target Audience |
|------|-------|--------|-----------------|
| **Free** | $0/mo | • 1 platform<br>• 10 scheduled posts/mo<br>• Basic templates<br>• 3-metric dashboard | Solo entrepreneurs testing the waters |
| **Starter** | $19/mo | • 3 platforms<br>• 50 posts/mo<br>• AI content (20 generations/mo)<br>• Unified inbox<br>• Stock photo access | Active small businesses |
| **Pro** | $49/mo | • Unlimited platforms<br>• Unlimited posts<br>• Unlimited AI<br>• Evergreen reposting<br>• Advanced analytics<br>• Priority support | Growth-focused businesses with team |

**Annual Discount:** 20% off (2 months free)

### Monetization Assumptions
- **Target:** 1,000 paying users in 12 months
- **Conversion Rate:** 15% free → Starter (industry avg: 10-20%)
- **MRR Goal (Month 12):** $25,000  
  - 700 Starter ($13,300) + 300 Pro ($14,700)

---

### Launch KPIs

#### Acquisition (Month 1-3)
- **Signups:** 500 (Month 1) → 1,500 (Month 3)
- **Channel Mix:** 40% organic (SEO, social), 30% partnerships, 30% paid
- **CAC Target:** <$30 (LTV:CAC ratio of 3:1)

#### Activation
- **Onboarding Completion:** 70% connect at least 1 platform
- **First Post Published:** 50% within 24 hours of signup
- **Aha Moment:** User schedules 3+ posts in first week

#### Engagement
- **WAU/MAU Ratio:** >40% (healthy stickiness)
- **Posts per Active User:** 8/month (Starter), 15/month (Pro)
- **Inbox Check Frequency:** 3x/week minimum

#### Retention
- **Day 7 Retention:** 40%
- **Day 30 Retention:** 25%
- **Churn Rate:** <7% monthly (SaaS benchmark: 5-7%)

#### Revenue
- **Free → Paid Conversion:** 15% within 30 days
- **MRR Growth:** 20% month-over-month
- **ARPU:** $28 (blended across Starter/Pro)

#### Support & Quality
- **NPS:** >40 (good for early-stage)
- **Support Ticket Volume:** <10% of MAUs
- **Uptime:** 99.5% (social posting is time-sensitive)

---

## 6. 3-Month Build Roadmap

### Month 1: Foundation (Weeks 1-4)

**Goal:** Functional MVP for internal testing

| Week | Engineering | Design | Outcome |
|------|-------------|--------|---------|
| 1 | Dev environment, DB schema, auth setup | Wireframes for all P0 screens | Clickable prototype |
| 2 | Platform OAuth (FB/IG/LinkedIn) | UI components library | Connect platforms works |
| 3 | Post composer + scheduler backend | Composer UI, calendar picker | Can schedule a basic post |
| 4 | AI content integration (OpenAI) | Template library design | AI generates 3 captions |

**Milestone:** Internal team can schedule posts to live accounts

---

### Month 2: Core Features (Weeks 5-8)

**Goal:** Beta-ready product with P0 + key P1 features

| Week | Engineering | Design | Outcome |
|------|-------------|--------|---------|
| 5 | Analytics pipeline (fetch + store platform data) | Dashboard UI (3 metrics) | Dashboard shows real data |
| 6 | Unified inbox sync + display | Inbox UI, reply composer | Read/reply to messages |
| 7 | Stock photo API, evergreen repost logic | Onboarding flow polish | Onboarding < 5 min |
| 8 | Mobile responsive web, bug fixes | Mobile UI testing | Works on iPhone/Android |

**Milestone:** 10 beta users (friends/family businesses) using daily

---

### Month 3: Polish & Launch (Weeks 9-12)

**Goal:** Public launch with 100 paying users

| Week | Engineering | Design | Outcome |
|------|-------------|--------|---------|
| 9 | Stripe integration, tiering logic | Pricing page, checkout flow | Users can subscribe |
| 10 | Performance optimization, load testing | Marketing site (homepage + features) | Site ready for traffic |
| 11 | Onboarding improvements from beta feedback | Tutorial videos, help docs | Reduced support load |
| 12 | Launch! Monitoring, rapid bug fixes | Social media launch campaign | 500 signups, 50 paid |

**Milestone:** Paying customers, positive feedback, <5% churn

---

### Post-Launch Priorities (Month 4+)

**Based on user feedback, prioritize:**
1. **Mobile app** (React Native) if >50% users request it
2. **Negative feedback alerts** (P2 feature) if reputation management is top ask
3. **Team collaboration** (multi-user accounts) if businesses outgrow solo plans
4. **More platform integrations** (TikTok, Pinterest) based on demand

---

## Next Steps for Development

### Immediate Actions (This Week)
1. **Set up project repository** (GitHub)
2. **Choose tech stack** (validate FastAPI vs Node.js based on team skills)
3. **Design system kickoff** (agree on colors, typography, component library)
4. **Create first API endpoint** (user registration + platform OAuth)

### Testing Philosophy
- **Test after each epic:** Don't wait until Month 3 to test
- **Weekly demos:** Show working features to potential users every Friday
- **Iterative refinement:** Expect 20-30% of features to change based on real usage

### Success Criteria for MVP Launch
- [ ] 5 beta users schedule 50+ posts without critical bugs
- [ ] Average onboarding time < 7 minutes
- [ ] AI content used in 60%+ of posts
- [ ] Dashboard insights drive at least 1 behavior change per user
- [ ] 3+ businesses willing to pay after free trial

---

**Document Owner:** Product Team  
**Review Cycle:** Weekly during build, monthly post-launch  
**Feedback:** Track feature requests in GitHub Issues, tag with user vote count
