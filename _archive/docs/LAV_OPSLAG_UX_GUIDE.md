# Lav Opslag - UX/UI Guide
## Post2Grow Intelligent Post Creation System

**Last Updated:** 14. januar 2026  
**Version:** 5.0 (Phase 5 Complete)

---

## 📋 Overview

"Lav Opslag" (Create Post) er Post2Grow's killer feature - et AI-drevet system der genererer strategisk tilpassede social media posts baseret på virksomhedens **samlede viden**:

- 🎯 **Forretningsmål** (hvad skal promoveres)
- 🎨 **Brand profil** (tone, stemme, bannede ord)
- 📍 **Lokationsintelligens** (nabolag, landmarks, hooks)
- 🍽️ **Menu metadata** (filosofi, signatur-retter, certificeringer)
- ⏰ **Driftsdata** (åbningstider, travle/stille perioder)
- 📸 **Visuel identitet** (fotostil, farvepalette, komposition)

**Resultat:** Hver post er autentisk, målrettet og optimeret til at drive specifikke forretningsresultater.

---

## 🎭 Three Phases of "Lav Opslag"

### **FASE 1: Generer Idéer** ✨
AI-drevet post-generering baseret på virksomhedens viden

### **FASE 2: Gennemgå & Godkend** ✅
Manuel gennemgang med visuelle anbefalinger

### **FASE 3: Planlæg & Post** 🚀
Optimeret timing og platform-publicering

---

## 📱 FASE 1: Generer Idéer

### **Formål**
At give brugeren 3-5 færdiglavede post-idéer der er strategisk tilpasset deres vigtigste forretningsmål.

### **Entry Point**
```
Navigation: Dashboard → Post Idéer
Route: /dashboard/posts
```

### **UI Layout**

#### **Header Section**
```
┌─────────────────────────────────────────────────────────────┐
│ Post Idéer                           [🤖 Smart] / [⭐ Pro]  │
│ AI-genererede posts baseret på dine forretningsmål          │
│                                                               │
│ Smart-planen giver 3 post-idéer. Opgrader til Pro for flere.│
│                                           [✨ Generer nye idéer]│
└─────────────────────────────────────────────────────────────┘
```

**Komponenter:**
- **Title:** "Post Idéer" (H1, bold, 4xl)
- **Tier Badge:** Smart (🤖 blue) / Pro (⭐ purple)
- **Subtitle:** Forklarende tekst om AI-generering
- **Tier Message:** Smart limit / Pro unlimited
- **Generate Button:** Blå gradient, høj kontrast, disabled state mens generating

#### **Generation Button States**

**Default State:**
```css
✨ Generer nye idéer
Background: bg-blue-600
Hover: bg-blue-700
Shadow: shadow-lg
```

**Generating State:**
```css
Genererer posts...
Background: bg-gray-400 (disabled)
Cursor: not-allowed
Icon: Loading spinner
```

**Success State:**
```
(Shows success message, then displays posts)
```

**Error State:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Kunne ikke generere posts. Prøv igen.                   │
│                                                               │
│ Du har ingen aktive mål. Opret et mål først for at          │
│ generere målrettede posts.                                   │
└─────────────────────────────────────────────────────────────┘
Red border, red text, informative message
```

### **Empty State**

Når brugeren endnu ikke har genereret posts:

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                          📝                                   │
│                                                               │
│              Ingen post-idéer endnu.                         │
│        Klik 'Generer nye idéer' for at komme i gang.        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Design:**
- Large emoji (6xl size)
- Gray text (text-gray-600)
- Centered layout
- Padding: py-16 px-4

### **AI Generation Process**

#### **Backend Flow (Invisible to User)**
```
1. Knowledge Gatherer → Hent alle business data
2. Goal Analyzer → Prioriter mål (critical > high > medium > low)
3. Post Generator → GPT-4o generering med massiv kontekst
4. Scheduler → Optimer posting tidspunkter
5. Database Saver → Gem til post_ideas tabel
```

#### **Frontend Flow (Visible to User)**
```
1. User clicks "Generer nye idéer"
2. Button disables with "Genererer posts..." text
3. Edge Function called (3-10 seconds)
4. Success: Posts appear in list
5. Error: Error message shown with helpful context
```

### **Tier Differentiation**

#### **Smart Plan (DKK 249/md)**
```javascript
numberOfPosts = 3
Message: "Smart-planen giver 3 post-idéer. Opgrader til Pro for flere."
```

#### **Pro Plan (DKK 399/md)**
```javascript
numberOfPosts = 5
Message: "Pro-planen giver ubegrænsede post-idéer."
```

**Why This Matters:**
- Smart users få fokuserede, kvalitet idéer (ikke overvældende)
- Pro users får flere variationer til A/B testing
- Clear value proposition for upgrade

---

## 📋 FASE 2: Gennemgå & Godkend

### **Formål**
At give brugeren mulighed for at gennemgå AI-genererede posts, se visuelle anbefalinger, og godkende/afvise baseret på kvalitet.

### **Posts List Layout**

Posts grupperes efter status:

```
┌─────────────────────────────────────────────────────────────┐
│ Kladder (3)                                                  │
├─────────────────────────────────────────────────────────────┤
│  [Post Card 1]              [Post Card 2]                   │
│  [Post Card 3]                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Godkendte (2)                                                │
├─────────────────────────────────────────────────────────────┤
│  [Post Card 4]              [Post Card 5]                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Andre (1)                                                    │
├─────────────────────────────────────────────────────────────┤
│  [Post Card 6]                                               │
└─────────────────────────────────────────────────────────────┘
```

**Grid Layout:**
- Desktop (lg): 2 columns
- Mobile: 1 column
- Gap: 6 (gap-6)
- Responsive: grid grid-cols-1 lg:grid-cols-2

### **Post Card Anatomy**

#### **Card Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ [📷 Instagram] [Kladde]                           [🗑️]      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tilpasset mål                                           │ │
│ │ Fyld onsdag frokost: 18 → 32 bordreservationer          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ Tekst:                                                       │
│ Onsdag frokost? 🌿 Vores økologiske smørrebrød med         │
│ Bornholm-ost og lokale urter venter på dig. Kun få         │
│ borde ledige! Book nu 👉                                    │
│                                                               │
│ Hashtags:                                                    │
│ [#københavnfood] [#økologisk] [#smørrebrød]                │
│ [#nyhavnkbh] [#frokostkbh]                                  │
│                                                               │
│ Foreslået tidspunkt:                                         │
│ tirsdag den 14. januar 2026 kl. 16:00                       │
│                                                               │
│ [▶ Foto-tips]                                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│          [✓ Godkend]                    [✕ Afvis]          │
└─────────────────────────────────────────────────────────────┘
```

#### **Card Header**

**Platform Badge:**
```
Instagram: [📷 Instagram] 
  - bg-gradient-to-r from-purple-500 to-pink-500
  - text-white

Facebook: [👥 Facebook]
  - bg-blue-600
  - text-white

Begge: [📱 Begge]
  - bg-gradient-to-r from-blue-600 to-purple-500
  - text-white
```

**Status Badge:**
```
Kladde:    bg-gray-100 text-gray-700
Godkendt:  bg-green-100 text-green-700
Planlagt:  bg-blue-100 text-blue-700
Postet:    bg-purple-100 text-purple-700
Afvist:    bg-red-100 text-red-700
```

**Delete Button:**
```
🗑️ Icon button
text-gray-400 hover:text-red-600
Position: top-right
Confirmation: "Er du sikker på at du vil slette denne post-idé?"
```

#### **Goal Alignment Section**

Hvis post er alignet med et mål:
```
┌─────────────────────────────────────────────────────────────┐
│ Tilpasset mål                                                │
│ Fyld onsdag frokost: 18 → 32 bordreservationer              │
└─────────────────────────────────────────────────────────────┘
Blue border, blue background (bg-blue-50)
Small font for label (text-xs)
Larger font for goal description (text-sm)
```

**Why This Matters:**
- Users see **hvorfor** denne post er vigtig
- Direct connection mellem content og business outcomes
- Builds trust in AI recommendations

#### **Caption Section**

```
Tekst:
Onsdag frokost? 🌿 Vores økologiske smørrebrød med 
Bornholm-ost og lokale urter venter på dig. Kun få 
borde ledige! Book nu 👉
```

**Design:**
- Label: "Tekst" (text-xs, text-gray-500)
- Content: text-gray-900, leading-relaxed
- Character count visible on hover (Instagram: 80-150, Facebook: 100-200)

**Content Quality Indicators:**
- ✅ Authentic brand voice (from brand profile tone)
- ✅ Local hooks (Bornholm-produceret)
- ✅ Call-to-action (Book nu 👉)
- ✅ Emoji for visual appeal
- ✅ Specific menu item (økologiske smørrebrød)
- ✅ Urgency (Kun få borde ledige!)

#### **Hashtags Section**

```
Hashtags:
[#københavnfood] [#økologisk] [#smørrebrød]
[#nyhavnkbh] [#frokostkbh] [#bornholmproduceret]
```

**Design:**
- Label: "Hashtags" (text-xs, text-gray-500)
- Badges: text-sm, text-blue-600, bg-blue-50, px-2 py-1, rounded
- Flex wrap: gap-2
- Count: 5-8 hashtags (optimized for Danish market)

**Hashtag Strategy:**
- Location-based: #københavnfood, #nyhavnkbh
- Product-based: #smørrebrød, #økologisk
- Occasion-based: #frokostkbh
- Origin-based: #bornholmproduceret

#### **Suggested Post Time**

```
Foreslået tidspunkt:
tirsdag den 14. januar 2026 kl. 16:00
```

**Design:**
- Label: "Foreslået tidspunkt" (text-xs, text-gray-500)
- Time: text-sm, text-gray-700
- Format: Danish locale (weekday, day, month, year, time)

**Time Optimization Logic:**
```javascript
if (goal has target days) {
  postTime = 1 day before target day at 10:00
  // Example: Wednesday goal → Post Tuesday 10:00
}
else if (slow periods detected) {
  postTime = day before slow period at 16:00
  // Example: Wednesday slow → Post Tuesday 16:00
}
else {
  postTime = next day at 10:00
}
```

**Why This Matters:**
- Posts før slow periods → Driver trafik når mest nødvendigt
- Posts 1 dag før target dag → Giver tid til at nå målgruppen
- Consistent morning times → Når folk planlægger deres dag

#### **Visual Suggestions (Expandable)**

**Collapsed State:**
```
[▶ Foto-tips]
```

**Expanded State:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📸 Foto-tips                                                 │
├─────────────────────────────────────────────────────────────┤
│ Komposition:                                                 │
│ Close-up af smørrebrød med Nyhavn både i baggrunden         │
│                                                               │
│ Belysning:                                                   │
│ Naturligt vindues-lys fra venstre side                      │
│                                                               │
│ Motiv:                                                       │
│ Signatur smørrebrød på traditionel tallerken, kaffekop      │
│ i hjørnet                                                    │
│                                                               │
│ Farver:                                                      │
│ [Varm brun] [Creme] [Grøn friske urter]                    │
└─────────────────────────────────────────────────────────────┘
Purple border and background (bg-purple-50, border-purple-200)
```

**Design:**
- Toggle button: text-sm, text-purple-600, font-medium
- Arrow: ▶ (collapsed) / ▼ (expanded)
- Content sections: composition, lighting, subject, color_palette
- Color badges: text-xs, bg-white, border-purple-200

**Why This Matters:**
- Users uden foto-erfaring får konkret guidance
- Aligned med business' visual identity (from Phase 4B)
- Ensures brand consistency across all posts
- Increases likelihood of high-quality user-generated content

#### **Action Buttons**

**For Draft Posts:**
```
┌─────────────────────────────────────────────────────────────┐
│          [✓ Godkend]                    [✕ Afvis]          │
└─────────────────────────────────────────────────────────────┘
```

**Approve Button:**
```css
flex-1 (takes available space)
bg-green-600 text-white font-medium
hover:bg-green-700
rounded-lg px-4 py-2
Icon: ✓
```

**Reject Button:**
```css
bg-gray-200 text-gray-700 font-medium
hover:bg-gray-300
rounded-lg px-4 py-2
Icon: ✕
```

**For Approved Posts:**
```
┌─────────────────────────────────────────────────────────────┐
│          [📅 Planlæg]                   [🚀 Post nu]        │
└─────────────────────────────────────────────────────────────┘
```

**Schedule Button:**
```css
flex-1
bg-blue-600 text-white
Icon: 📅
```

**Post Now Button:**
```css
bg-purple-600 text-white
Icon: 🚀
```

### **User Interaction Flow**

```
1. User lands on page → Sees grouped posts
2. User reads caption → Evaluates quality
3. User sees goal alignment → Understands "why"
4. User checks hashtags → Verifies relevance
5. User expands visual tips → Gets photography guidance
6. User approves → Post moves to "Godkendte" section
   OR
   User rejects → Post moves to "Andre" section (rejected)
7. User can delete unwanted posts → Confirmation prompt
```

### **Empty State Handling**

If no posts in a status group, that section is hidden:

```javascript
// Only show sections with posts
{draftPosts.length > 0 && <DraftSection />}
{approvedPosts.length > 0 && <ApprovedSection />}
{otherPosts.length > 0 && <OtherSection />}
```

---

## 🚀 FASE 3: Planlæg & Post

### **Formål**
At give brugeren mulighed for at schedule godkendte posts til optimale tidspunkter og publicere direkte til Instagram/Facebook.

### **Status: Future Implementation**

**Planned Features:**

#### **Scheduling Calendar View**
```
┌─────────────────────────────────────────────────────────────┐
│                    Januar 2026                               │
├─────────────────────────────────────────────────────────────┤
│  MA   TI   ON   TO   FR   LØ   SØ                          │
│        14   15   16   17   18   19                          │
│  📷   📷        📱                                            │
│  10:00 16:00  10:00                                          │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag-and-drop rescheduling
- Visual timeline of all scheduled posts
- Platform icons on calendar days
- Time slots with post previews
- Bulk scheduling actions

#### **Direct Posting Integration**

**Instagram Graph API Integration:**
```javascript
// For Instagram Business Accounts
POST /instagram-business-account-id/media
{
  image_url: uploadedPhotoUrl,
  caption: postCaption,
  hashtags: hashtagArray
}
```

**Facebook Pages API Integration:**
```javascript
// For Facebook Pages
POST /page-id/feed
{
  message: postCaption,
  link: businessWebsite,
  scheduled_publish_time: unixTimestamp
}
```

#### **Post Performance Tracking**

Once posted, track metrics in post_ideas table:
```sql
-- Performance fields
reach INTEGER DEFAULT 0
engagement INTEGER DEFAULT 0  
clicks INTEGER DEFAULT 0
```

**Analytics Dashboard:**
```
┌─────────────────────────────────────────────────────────────┐
│ Post Performance                                             │
├─────────────────────────────────────────────────────────────┤
│ [Post Caption Preview]                                       │
│                                                               │
│ Reach: 1,247                                                 │
│ Engagement: 87 (7.0%)                                        │
│ Clicks: 23 (1.8%)                                            │
│                                                               │
│ Goal Impact: +14 reservations (78% of target)               │
└─────────────────────────────────────────────────────────────┘
```

#### **A/B Testing (Pro Feature)**

Generate variant posts for the same goal:
```
Variant A: "Onsdag frokost? 🌿 Vores økologiske smørrebrød..."
Variant B: "Bornholm på bordet! 🌿 Kom og smag vores..."

Compare performance → Learn what works best
```

---

## 🎨 Design System & Visual Hierarchy

### **Color Palette**

#### **Primary Actions**
```
Blue: #2563EB (bg-blue-600) - Generate, Schedule
Green: #059669 (bg-green-600) - Approve
Purple: #7C3AED (bg-purple-600) - Post Now
```

#### **Status Colors**
```
Draft:     Gray    bg-gray-100 text-gray-700
Approved:  Green   bg-green-100 text-green-700
Scheduled: Blue    bg-blue-100 text-blue-700
Posted:    Purple  bg-purple-100 text-purple-700
Rejected:  Red     bg-red-100 text-red-700
```

#### **Platform Gradients**
```
Instagram: from-purple-500 to-pink-500
Facebook:  bg-blue-600 (solid)
Both:      from-blue-600 to-purple-500
```

### **Typography**

```
Page Title:        text-4xl font-bold (Post Idéer)
Section Headers:   text-lg font-semibold (Kladder (3))
Card Labels:       text-xs font-medium text-gray-500
Card Content:      text-sm text-gray-900
Buttons:           font-medium (not bold, not regular)
```

### **Spacing**

```
Page Container:    max-w-7xl mx-auto px-4 py-8
Card Padding:      p-6
Section Gap:       space-y-8
Grid Gap:          gap-6
Button Gap:        gap-2
```

### **Interactive States**

```
Buttons:
  Default:  bg-blue-600 hover:bg-blue-700
  Disabled: bg-gray-400 cursor-not-allowed
  Active:   bg-blue-700 (pressed)

Cards:
  Default:  border-gray-200
  Hover:    border-blue-300
  Selected: border-blue-500

Links:
  Default:  text-blue-600
  Hover:    text-blue-700 underline
```

---

## 📱 Responsive Design

### **Breakpoints**

```css
Mobile:  < 1024px (lg breakpoint)
Desktop: >= 1024px
```

### **Layout Changes**

**Mobile (< 1024px):**
```
┌───────────────────┐
│ Header            │
│ [Generate Button] │
├───────────────────┤
│ [Post Card 1]     │
│                   │
├───────────────────┤
│ [Post Card 2]     │
│                   │
├───────────────────┤
│ [Post Card 3]     │
│                   │
└───────────────────┘
```
- Single column layout
- Full-width cards
- Stacked action buttons

**Desktop (>= 1024px):**
```
┌─────────────────────────────────────────────────────┐
│ Header                             [Generate Button]│
├─────────────────────────────────────────────────────┤
│ [Post Card 1]         [Post Card 2]                 │
│                                                       │
├─────────────────────────────────────────────────────┤
│ [Post Card 3]         [Post Card 4]                 │
│                                                       │
└─────────────────────────────────────────────────────┘
```
- Two column grid
- Side-by-side action buttons
- More compact spacing

---

## 🔐 Access Control & Permissions

### **Tier-Based Features**

#### **Smart Plan (DKK 249/md)**
```
✅ Generate 3 post ideas
✅ View visual suggestions
✅ Approve/reject posts
✅ See goal alignment
❌ Generate 5+ posts (Pro only)
❌ Bulk scheduling (Pro only)
❌ A/B testing (Pro only)
❌ Advanced analytics (Pro only)
```

#### **Pro Plan (DKK 399/md)**
```
✅ Generate 5+ post ideas
✅ All Smart features
✅ Bulk scheduling
✅ A/B testing
✅ Advanced analytics
✅ Priority support
```

### **RLS Policies**

All database access enforces business ownership:

```sql
-- Select policy
SELECT * FROM post_ideas
WHERE business_id IN (
  SELECT id FROM businesses WHERE owner_id = auth.uid()
);

-- Insert policy
INSERT INTO post_ideas
WHERE business_id IN (
  SELECT id FROM businesses WHERE owner_id = auth.uid()
);

-- Update policy
UPDATE post_ideas
WHERE business_id IN (
  SELECT id FROM businesses WHERE owner_id = auth.uid()
);

-- Delete policy
DELETE FROM post_ideas
WHERE business_id IN (
  SELECT id FROM businesses WHERE owner_id = auth.uid()
);
```

---

## 🧪 Testing Checklist

### **Phase 1: Generation**

- [ ] Click "Generer nye idéer" button
- [ ] Verify loading state (disabled button, "Genererer posts...")
- [ ] Wait for Edge Function response (3-10 seconds)
- [ ] Verify posts appear in list
- [ ] Check Smart tier generates 3 posts
- [ ] Check Pro tier generates 5 posts
- [ ] Test error handling (no goals scenario)
- [ ] Verify error message is helpful

### **Phase 2: Review**

- [ ] Verify posts grouped by status (Draft, Approved, Other)
- [ ] Check platform badges display correctly (Instagram, Facebook, Both)
- [ ] Verify status badges show correct color/text
- [ ] Check goal alignment section displays when present
- [ ] Verify caption is readable and formatted
- [ ] Check hashtags display as blue badges
- [ ] Verify suggested time in Danish format
- [ ] Test visual suggestions toggle (expand/collapse)
- [ ] Check visual suggestions content (composition, lighting, subject, colors)
- [ ] Test approve action (post moves to Approved section)
- [ ] Test reject action (post moves to Other section)
- [ ] Test delete action (confirmation prompt, then removal)
- [ ] Verify empty sections are hidden
- [ ] Test mobile responsive layout (1 column)
- [ ] Test desktop layout (2 columns)

### **Phase 3: Scheduling (Future)**

- [ ] Verify calendar view shows scheduled posts
- [ ] Test drag-and-drop rescheduling
- [ ] Test direct Instagram posting
- [ ] Test direct Facebook posting
- [ ] Verify performance tracking updates
- [ ] Test analytics dashboard
- [ ] Test A/B testing variant generation (Pro only)

---

## 🎯 Success Metrics

### **User Engagement**

```
Goal: 80% of users generate posts within first week
Metric: (users_who_generated / total_users) * 100
```

### **Approval Rate**

```
Goal: 70% of generated posts get approved
Metric: (approved_posts / total_generated_posts) * 100
```

### **Time Savings**

```
Traditional: 20-30 min per post
With AI: 2-5 min per post (review + approve)
Savings: 85% time reduction
```

### **Goal Achievement**

```
Goal: 60% of posts contribute to goal completion
Metric: (posts_with_goal_impact / total_posted) * 100
```

---

## 🚦 Error Handling & Edge Cases

### **No Active Goals**

```
Error: "No active goals found"
Message: "Du har ingen aktive mål. Opret et mål først for at 
         generere målrettede posts."
Action: Link to Goals page
```

### **OpenAI API Failure**

```
Error: "Generation failed"
Message: "Kunne ikke generere posts. Prøv igen om lidt."
Action: Retry button
```

### **Missing Business Data**

```
Warning: "Incomplete business profile"
Message: "Udfyld din brand profil, menu og visuel identitet 
         for bedre post kvalitet."
Action: Links to relevant pages
Fallback: Generate with available data
```

### **Network Timeout**

```
Error: "Request timeout"
Message: "Genereringen tog for lang tid. Prøv igen."
Action: Retry with exponential backoff
```

### **Database Write Failure**

```
Error: "Failed to save posts"
Message: "Posts blev genereret men ikke gemt. Kontakt support."
Action: Show generated posts, offer manual save retry
```

---

## 💡 Best Practices & Recommendations

### **For Users**

1. **Udfyld din profil først:**
   - Brand profil → Autentisk stemme
   - Menu metadata → Specifikt indhold
   - Visuel identitet → Bedre foto-anbefalinger
   - Forretningsmål → Målrettet content

2. **Gennemgå altid før godkendelse:**
   - Tjek at caption matcher din stemme
   - Verificer hashtags er relevante
   - Ekspander visuelle tips for foto-guidance

3. **Post konsistent:**
   - Følg suggested post times
   - Post før slow periods for bedst effekt
   - Brug visual suggestions til at tage bedre fotos

4. **Analyser resultater:**
   - Track hvilke posts driver mest engagement
   - Note hvilke mål bliver opfyldt
   - Juster strategi baseret på data

### **For Developers**

1. **Keep prompts up-to-date:**
   - Review GPT-4o prompts monthly
   - A/B test different prompt variations
   - Monitor generation quality metrics

2. **Monitor API costs:**
   - GPT-4o costs ~$0.02 per generation
   - Implement rate limiting (max 10 generations/day)
   - Cache common responses where appropriate

3. **Optimize load times:**
   - Lazy load post cards
   - Implement virtual scrolling for large lists
   - Prefetch next page data

4. **Ensure data quality:**
   - Validate all inputs before GPT-4o call
   - Sanitize outputs (remove banned words)
   - Log generation failures for debugging

---

## 📚 Technical Dependencies

### **Frontend**

```typescript
React 18.2.0
TypeScript 5.2.2
Tailwind CSS 3.4.0
i18next 25.6.0 (translations)
react-i18next 16.1.4
zustand (state management)
```

### **Backend**

```typescript
Supabase Edge Functions (Deno)
OpenAI API (GPT-4o, GPT-4 Vision)
PostgreSQL (Supabase)
```

### **Database Tables**

```sql
post_ideas              -- Generated posts
business_goals          -- Goal alignment
business_brand_profile  -- Tone, voice, banned words
business_location_intelligence -- Local hooks
business_menu_metadata  -- Menu content
business_operations     -- Timing optimization
business_visual_identity -- Photography guidance
```

---

## 🔮 Future Enhancements

### **Phase 6: Direct Posting (Q2 2026)**
- Instagram Graph API integration
- Facebook Pages API integration
- Automatic image generation with DALL-E
- Multi-image carousel posts

### **Phase 7: Advanced Analytics (Q2 2026)**
- Performance tracking dashboard
- Goal impact measurement
- ROI calculation
- Competitive benchmarking

### **Phase 8: Smart Scheduling (Q3 2026)**
- AI-optimized posting calendar
- Automatic rescheduling based on engagement patterns
- Bulk scheduling for entire month
- Template library for recurring posts

### **Phase 9: Multi-Language Support (Q3 2026)**
- English market expansion
- Swedish market expansion
- Automatic translation of generated posts
- Localized hashtag strategies

### **Phase 10: Advanced AI Features (Q4 2026)**
- Video script generation
- Story sequence generation
- Influencer collaboration suggestions
- Trend prediction and auto-adaptation

---

## 📞 Support & Documentation

### **User Help Resources**

- **In-app tooltips:** Hover over ⓘ icons for context
- **Video tutorials:** Embedded in dashboard
- **Help center:** help.post2grow.dk
- **Live chat:** Available for Pro users

### **Developer Resources**

- **API documentation:** docs.post2grow.dk/api
- **Edge Functions guide:** docs.post2grow.dk/edge-functions
- **Database schema:** docs.post2grow.dk/database
- **Component library:** storybook.post2grow.dk

---

## ✅ Conclusion

"Lav Opslag" er **fundamentet** for Post2Grow's værdiproposition:

**Traditional social media tools:**
❌ Generic scheduling
❌ No business context
❌ Manual content creation
❌ Time-consuming

**Post2Grow "Lav Opslag":**
✅ **Goal-driven** content (every post serves a purpose)
✅ **Brand-authentic** voice (tone, hooks, banned words)
✅ **Location-aware** context (local landmarks, neighborhood vibe)
✅ **Menu-integrated** content (specific dishes, philosophy)
✅ **Time-optimized** scheduling (post before slow periods)
✅ **Visual-guided** photography (composition, lighting, style)

**Result:** Brugerne sparer 85% af tiden på content creation og får bedre resultater fordi hver post er strategisk tilpasset deres faktiske business needs.

---

**Document Version:** 1.0  
**Last Updated:** 14. januar 2026  
**Authors:** Post2Grow Development Team  
**Status:** Phase 1-2 Implemented, Phase 3 Planned
