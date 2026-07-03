# Sidebar Navigation by Subscription Tier

**Last Updated:** January 14, 2026  
**Document Purpose:** Overview of accessible pages in the sidebar for each subscription tier

---

## Overview

Post2Grow uses a tier-based access control system where different features are unlocked based on the user's subscription level. The sidebar navigation reflects these restrictions with visual indicators (🔒 lock icons) for locked features.

### Subscription Tiers

1. **Free Tier** - Basic features for getting started
2. **Smart Tier** - Mid-level features for growing businesses
3. **Pro Tier** - Full access to all features and unlimited usage

---

## Main Navigation Items

### 📝 Opret Opslag (Create Post)
**Route:** `/dashboard/create`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Create new social media posts manually

---

### 🌐 Virksomhedsprofil (Business Profile)
**Route:** `/dashboard/profile`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Manage business information

#### Free Tier Access:
- Business Name ✅
- Business Type ✅
- Postal Code & City ✅
- Country ✅
- Phone ✅
- Email ✅

#### Smart/Pro Tier Additional Access:
- Website URL & AI Analysis 🔓
- Opening Hours Schedule 🔓
- Business Description & About Text 🔓
- Services & Product Offerings 🔓
- Keywords & Tags 🔓
- Location Intelligence 🔓
- Operations Page 🔓
- Business Goals 🔓

---

### 📋 Menukort (Menu)
**Route:** `/dashboard/menu`  
**Access:** 🔒 Smart & Pro Only  
**Description:** Upload and manage menu items with AI-powered analysis  
**Free Tier:** Shows lock icon 🔒, clicking navigates to upgrade page

---

### ✨ Brand Profil (Brand Profile)
**Route:** `/dashboard/brand`  
**Access:** 🔒 Smart & Pro Only  
**Description:** AI-generated brand voice, content pillars, visual identity, and tone analysis  
**Free Tier:** Shows lock icon 🔒, clicking navigates to upgrade page

#### Smart Tier Access:
- View Brand Profile (read-only) ✅
- Initial Brand Profile Generation ✅
- Brand Voice Examples ✅
- Content Pillars ✅
- Visual Identity ✅

#### Pro Tier Additional Access:
- Regenerate Brand Profile 🔓
- Edit Brand Voice 🔓
- Edit Visual Identity 🔓
- Advanced Tone Model 🔓

---

### 📱 Social Medier (Social Media)
**Route:** `/dashboard/social-media`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Connect Instagram and Facebook accounts for posting

---

### 📅 Kalender (Calendar)
**Route:** `/dashboard/calendar`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** View and manage scheduled posts in calendar view

---

### 📄 Post Idéer (Post Ideas) **[NEW]**
**Route:** `/dashboard/posts`  
**Access:** ✅ Smart & Pro (with tier-based limits)  
**Badge:** "Alle Opslag" in sidebar  
**Description:** AI-generated intelligent post ideas with approve/reject workflow

#### Smart Tier:
- Generate 3 posts at a time ✅
- Approve/Reject workflow ✅
- Goal-aligned posts ✅
- Visual suggestions ✅
- Platform-specific content ✅

#### Pro Tier:
- Generate 5 posts at a time ✅
- Unlimited post history 🔓
- All Smart features ✅

---

### 📊 Performance (Analytics)
**Route:** `/dashboard/analytics`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Badge:** "NY" (New feature)  
**Description:** View post performance metrics and insights

#### Smart Tier:
- Basic analytics ✅
- Post engagement metrics ✅

#### Pro Tier:
- Advanced analytics 🔓
- Deep performance insights 🔓
- Custom reports 🔓

---

## Operations & Goals (Hidden Pages - Not in Main Sidebar)

### ⚙️ Operations Page
**Route:** `/dashboard/operations`  
**Access:** 🔒 Pro Only  
**Description:** Configure opening hours, special events, and operational details  
**Smart Tier:** Can view but cannot edit (read-only with upgrade prompt)

---

### 🎯 Goals Page
**Route:** `/dashboard/goals`  
**Access:** ✅ Smart & Pro (with limits)  
**Description:** Set and track business goals (revenue, followers, engagement)

#### Smart Tier:
- Create up to 3 goals ✅
- Track goal progress ✅
- Goal types: Revenue, Followers, Engagement ✅

#### Pro Tier:
- Unlimited goals 🔓
- Advanced goal tracking 🔓
- Goal-aligned post analytics 🔓

---

## Settings Section (Collapsible)

### 👥 Team & Brugere (Team & Users)
**Route:** `/dashboard/team`  
**Access:** 🔒 Pro Only  
**Badge:** ⭐ (shown for Free/Smart tiers)  
**Description:** Invite team members and manage user permissions

---

### ⚙️ Indstillinger (Settings)
**Route:** `/dashboard/settings`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** General account and business settings

---

### ❓ Hjælp & Support (Help & Support)
**Route:** `/dashboard/help`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Help documentation and support resources

---

### 📧 Kontakt (Contact)
**Route:** `/dashboard/contact`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Contact Post2Grow support

---

### 🔒 Privatliv (Privacy)
**Route:** `/dashboard/privacy`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Privacy policy and data handling information

---

### 📜 Vilkår (Terms)
**Route:** `/dashboard/terms`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Terms of service

---

## Special Pages (Not in Sidebar)

### 📋 Upgrade Plans
**Route:** `/dashboard/plans`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** View and upgrade subscription plans  
**Note:** Clicking locked features navigates here

---

### 👤 My Profile
**Route:** `/dashboard/my-profile`  
**Access:** ✅ All Tiers (Free, Smart, Pro)  
**Description:** Personal user profile settings

---

### 🧪 Brand Profile V5 (Testing)
**Route:** `/dashboard/brand-v5`  
**Access:** Internal testing only  
**Description:** New version of Brand Profile page (not in production sidebar)

---

## Tier Comparison Matrix

| Feature | Free | Smart | Pro |
|---------|------|-------|-----|
| **Create Post** | ✅ | ✅ | ✅ |
| **Business Profile (Basic)** | ✅ | ✅ | ✅ |
| **Business Profile (Full)** | ❌ | ✅ | ✅ |
| **Menu Upload** | ❌ | ✅ | ✅ |
| **Brand Profile** | ❌ | ✅ (View Only) | ✅ (Full Edit) |
| **Social Media Connections** | ✅ | ✅ | ✅ |
| **Calendar** | ✅ | ✅ | ✅ |
| **Post Ideas Generation** | ❌ | ✅ (3 posts) | ✅ (5 posts) |
| **Analytics** | ✅ (Basic) | ✅ (Basic) | ✅ (Advanced) |
| **Operations Page** | ❌ | ❌ (View Only) | ✅ (Full Edit) |
| **Business Goals** | ❌ | ✅ (Max 3) | ✅ (Unlimited) |
| **Team Management** | ❌ | ❌ | ✅ |
| **Settings** | ✅ | ✅ | ✅ |
| **Help & Support** | ✅ | ✅ | ✅ |

---

## Visual Indicators in Sidebar

### Active Page
- **Background:** Light purple (`#F4F1FE`)
- **Text:** Dark (`#0F2E32`)
- **Border:** Left border with purple accent (`#C7BAF7`)

### Locked Feature (Free Tier)
- **Icon:** 🔒 lock icon on the right
- **Opacity:** 60% (dimmed appearance)
- **Text:** Gray (`#9CA3AF`)
- **Hover:** Light background, normal cursor
- **Action:** Clicking navigates to `/dashboard/plans`

### New Features
- **Badge:** "NY" pill badge
- **Badge Style:** Gradient from indigo to purple
- **Text:** Indigo color

### Pro-Only Features
- **Badge:** ⭐ star icon (shown to Free/Smart users)

---

## User Experience Flow

### Free Tier User
1. Sees main navigation with 🔒 icons on Menu and Brand Profile
2. Clicking locked items shows upgrade prompt and navigates to `/dashboard/plans`
3. Business Profile shows simplified form with upgrade CTA for advanced features
4. Can create posts manually but cannot generate AI post ideas

### Smart Tier User
1. Full access to Menu and Brand Profile (view mode)
2. Can generate 3 AI post ideas at a time
3. Can create up to 3 business goals
4. Operations page is view-only with upgrade prompt
5. Team management shows ⭐ badge (Pro feature)

### Pro Tier User
1. Full access to all features
2. No locked icons or upgrade prompts
3. Can generate 5 AI post ideas at a time
4. Unlimited business goals
5. Full edit access to Operations page
6. Team management unlocked
7. Advanced analytics available

---

## Development Notes

### Tier Detection
- Tier is fetched from `businesses.subscription_tier` column
- Default tier: "smart" (if not specified)
- Hook: `useSubscriptionTier()` from `@/hooks/useSubscriptionTier.ts`

### Feature Gating
- Pro-only features check: `canAccessFeature(feature)`
- Features list: `edit_operations`, `unlimited_goals`, `edit_brand_profile`, `edit_location`, `edit_visual_identity`, `advanced_analytics`

### Sidebar Implementation
- File: `src/components/layout/Sidebar.tsx`
- Uses `useTierStore` for tier detection
- Conditional rendering based on `currentTier === 'free'`
- Lock icon and disabled state for locked features

---

## Future Enhancements

### Planned Features
1. **Dashboard Overview** - Tier-specific widgets and insights
2. **Content Calendar** - Smart scheduling based on operations
3. **Performance Reports** - Automated weekly/monthly reports (Pro)
4. **Multi-Language Posts** - Generate posts in multiple languages (Pro)
5. **Video Scripts** - AI-generated video content scripts (Pro)
6. **Story Ideas** - Instagram/Facebook Stories generation (Pro)

### Tier Evolution
- Free tier may receive limited AI post generation (1 post/week)
- Smart tier may unlock basic team collaboration (2-3 users)
- Pro tier may include white-label options for agencies

---

## Support & Documentation

### User Guides
- **Free Tier:** Focus on manual post creation and basic profile setup
- **Smart Tier:** AI post generation, menu analysis, brand voice
- **Pro Tier:** Advanced workflows, team collaboration, analytics

### Upgrade Incentives
- In-app prompts when attempting to use locked features
- Feature comparison table on plans page
- Success stories from upgraded users
- Trial period for Pro features (future consideration)

---

## Conclusion

The tier-based navigation system provides clear product differentiation while maintaining a smooth user experience. Free users can start with basic features, Smart tier users get AI-powered content generation, and Pro tier users unlock advanced business management tools.

**Key Takeaway:** Every tier provides value, but each upgrade unlocks significant new capabilities that help businesses grow their social media presence more effectively.
