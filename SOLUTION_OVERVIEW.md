# Solution Overview — Post-to-Go

## What is it?

Post-to-Go is an AI-powered social media assistant for local businesses. It learns who the business is, then helps generate and publish content — with as little or as much manual effort as the owner wants.

---

## Part 1 — All-in Setup (DIN FORRETNING)

The setup section collects everything the AI needs to write in the business's voice and context. It runs once during onboarding and can be updated at any time from the sidebar.

### 1.1 Virksomhedsprofil (Business Profile)

The starting point. The owner either pastes their website URL for automatic extraction, or fills in details manually.

**What gets captured:**
- Business name, category, and type (café, restaurant, salon, etc.)
- Short description of the business
- Contact details (phone, email, address)
- Operating platform connections (Facebook, Instagram)
- Whether the business offers takeaway, delivery, outdoor seating, etc.

The website analyzer uses an Edge Function to scrape and extract structured data automatically — saving the owner from filling out forms.

---

### 1.2 Det vi tilbyder (Menu / Offerings)

The menu section gives the AI concrete, factual content to reference — dishes, drinks, categories, signature items.

**What gets captured:**
- Menu categories and individual items (with names, descriptions, prices)
- Menu type detection (standard menu, happy hour, brunch, julefrokost, etc.)
- Support for multiple menus from multiple URLs (e.g., food menu + wine list)
- An AI-generated `menu_signal` summary: what kind of venue it is, signature items, dietary options

The system detects menu URLs from the main website and allows the owner to add, remove, or re-extract menus at any time. Each menu URL is crawled separately and stored as a `menu_result`.

---

### 1.3 Lokation (Location Intelligence)

Uses the business address to fetch publicly available data from Google Maps and transforms it into marketing-relevant insights.

**What gets generated automatically:**
- Category scores (how much of a café vs. restaurant vs. bar it is)
- Matched guest motivations (what people come here for — e.g., "working remotely", "date night")
- Marketing focus angles (strategic content directions derived from the location data)
- Typical opening times and crowd patterns

This section requires no input from the owner beyond the address being set. It enriches the brand profile generation with audience-grounded data.

---

### 1.4 Brand Profil (Brand Profile)

The brand profile is generated once by an AI pipeline and stored as the permanent identity anchor for all future content generation. It sits between location/menu data (raw facts) and post captions (finished content).

**It is organized into five groups:**

**Identitet** — who the business is
| Field | Description |
|---|---|
| Brand Essence | One sentence (max 12 words) that captures the core identity |
| Uddybning | 2–3 sentences of strategic elaboration |
| 3 identitetsord | Three identity keywords pulling in different directions (e.g. "Hygge · Uformel · Klassikere") |
| Emotionel kerne | What the experience is really about — the emotional driver |

**Stemme** — how the business writes
| Field | Description |
|---|---|
| Tone-regler | Pre-formatted writing rules for the AI |
| Tone-nøgleord | Chips summarising the writing style |
| Typisk åbning | An example of how to start a post |
| Humorlevel | Low / moderate / high |

**Content Pillars** — what to write about
Up to 5 content hooks with usage guidance (what angle to take and when to use it).

**Grænser** — what to avoid
A single `voice_constraints` principle sentence (not a list of banned words) explaining *why*, plus 2 concrete avoid-examples beneath it.

**Baggrundskontekst** — collapsed by default
Target audience description, example posts used as voice training input, and brand origin story.

> The brand profile is generated from location intelligence, menu summaries, and business category. It is **not regenerated on every post** — it is a stable identity anchor that is injected into every AI content run.

---

## Part 2 — The Three Ways to Create a Post (INDHOLD)

Once the setup is complete, the owner has three paths for creating content. They sit together in the sidebar as the primary daily workflow.

---

### 2.1 Skriv Selv (Write Yourself)

A blank-canvas post editor. The owner writes their own caption and uses the AI for assistance.

**Flow:**
1. Open Skriv Selv from the sidebar
2. Write a caption or headline manually
3. Upload or select a photo
4. Use AI tools for hashtag suggestions, emoji matching, and CTA generation
5. Preview on Instagram/Facebook
6. Publish or schedule

**When to use it:** For announcements, personal stories, or specific posts where the owner knows exactly what they want to say.

---

### 2.2 Dagens Forslag (Daily Suggestions)

The AI prepares a set of ready-to-use post ideas each day, grounded in the brand profile, menu, season, and current context.

**Flow:**
1. Open Dagens forslag from the sidebar
2. See a curated list of post ideas for today — each with a content angle, draft caption, and suggested photo direction
3. Tap an idea to open it
4. Edit the caption if needed, attach a photo
5. Preview and publish/schedule

**What drives the suggestions:**
- Brand voice and content pillars from the brand profile
- Menu items and signature offerings
- Day of week, season, and upcoming calendar events
- Previous posts (to avoid repetition)

**When to use it:** For daily social media activity when the owner wants the AI to do the thinking, but still wants to personalise before posting.

---

### 2.3 Ugentlig Plan (Weekly Plan)

The AI generates a full week of content in one go — a structured plan of posts spread across the week with a coherent theme and variety in content types.

**Flow:**
1. Open Ugentlig plan from the sidebar
2. Review the generated weekly plan — a calendar view with one post per selected day
3. Each post has: a content type (menu highlight, atmosphere, behind the scenes, etc.), a headline, and a draft caption
4. Click any post in the plan to open it in the editor
5. Edit caption, attach photo, then publish or schedule
6. Work through the week post by post, or publish several at once

**What drives the plan:**
- Brand essence, tone-of-voice rules, content pillars, and voice constraints
- Weather data for the coming week (posts are updated if weather changes significantly)
- Seasonal and calendar context
- Content type diversity (the plan avoids generating the same type of post twice in a row)

**Weather integration:** The plan includes a live weather block. If the weather forecast changes after the plan was generated, the system alerts the owner and can re-assess which posts are affected.

**When to use it:** For owners who want to plan ahead and batch their social media work once per week.

---

## How the three methods relate to setup

```
Business Profile ──┐
Menu              ──┤──▶ Brand Profile ──▶ Skriv Selv (manual, AI-assisted)
Location          ──┤                  ──▶ Dagens Forslag (daily AI ideas)
                  ──┘                  ──▶ Ugentlig Plan (weekly AI plan)
```

The setup feeds the brand profile once. The brand profile then powers all three content paths continuously — ensuring every post, regardless of how it is created, stays true to the business's voice and identity.
