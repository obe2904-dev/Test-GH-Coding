# Contextual Calendar — Feature Overview

## What It Is

The contextual calendar is a built-in awareness layer that makes the weekly strategy automatically respond to Danish public holidays, school vacations, and commercially significant occasions.

Instead of generating a generic week-based plan every time, the system now knows *what is happening this week in Denmark* — and adjusts the strategy accordingly.

---

## What It Does for the User

### 1. Event-Aware Strategy Narrative
When a high-value event is coming up (e.g. Easter, Christmas, Mother's Day), the strategy headline, bullet points, and weekly focus text will explicitly name the event and frame the week around it.

**Without the feature:** "Fokus: Aftenbesøg med premiumvalg under lønningsuge"  
**With the feature:** "Fokus: Aftenbesøg som påskeplanlagt udflugt" — with narrative referencing Påskeferie, Skærtorsdag, family dining patterns, etc.

### 2. Smart Post Count Adjustment
- **High-value weeks** (Easter, Christmas, Mors Dag, Valentine's): post count is automatically raised to at least 4 to ensure there is always a dedicated lead-up post before the event.
- **Quiet weeks** (no notable events): post count is reduced by 1 to avoid filler content.

### 3. Event-Pinned Scheduling
Posts are automatically anchored to the commercially strongest days of the week based on the event. For Easter week, the Saturday product post lands on Påskelørdag (the peak shopping/dining day) — not a random weekday.

### 4. Calendar Labels on Each Day
Every day in the weekly plan that falls within a holiday or school vacation period will show the event name as a label (e.g. "Påskeferie", "Skærtorsdag", "Langfredag"), giving the user clear visual context when reviewing or editing the plan.

---

## Events Currently Tracked (Denmark)

| Type | Examples |
|------|----------|
| Public holidays | Skærtorsdag, Langfredag, Påskedag, Kristi Himmelfartsdag, Pinsedag, Grundlovsdag, Juledag |
| School vacations | Vinterferie, Påskeferie, Sommerferie, Efterårsferie, Juleferie |
| Commercial occasions | Valentinsdag, Fastelavn, Mors Dag, Fars Dag, Sankt Hans, Mortensaften, Black Friday |

Each event carries a **commercial weight** (1–5) that controls how aggressively the strategy responds:
- Weight 5 (critical): Entire week shaped around the event — e.g. Easter, Christmas
- Weight 4 (high): Plan should feature the event prominently — e.g. Mors Dag, Valentine's
- Weight 3 (moderate): At least one dedicated post — e.g. Grundlovsdag, Fastelavn
- Weight 1–2: Contextual awareness only, no structural change

---

## How It Responds to Location

The calendar is matched to the business's registered country. A business registered in Denmark (`DK`) gets Danish events; the system is built to support additional countries (Norway, Sweden, Finland) with their own event sets as those are added.

---

## What It Does Not Do

- It does not generate event-specific menu items or promotions automatically — the content AI uses the event as context but still draws from the business's actual menu and brand voice.
- It does not override a business owner's manual post adjustments.
- It does not guarantee event mentions in every individual post caption — the event shapes the *strategy*, not every word of every post.

---

## Setup

When a new business is created, the system runs a one-time AI-assisted onboarding to build a **brand profile**. The owner provides a website URL, menu, or a few photos — the AI extracts signals and generates a permanent voice profile that controls how all future content sounds.

The profile captures: tone of voice, personality archetype, content pillars, emoji frequency, humor level, banned words, and signature phrases. It can be updated later from the profile page.

**Without a brand profile,** captions fall back to a safe, neutral hospitality voice. **With one,** every AI-generated post reflects the actual personality of the business.

---

## Skriv Selv

The **Skriv Selv** path lets the owner write a post entirely from scratch — no AI involved unless wanted.

- The draft is auto-saved continuously and restored automatically the next time the page is opened.
- Photos can be attached directly in the editor.
- If the business is not connected to any social platform, a copy-paste modal appears with the formatted text per platform, plus a photo download button.

---

## Hurtigt Opslag

**Hurtigt Opslag** is an on-demand post generator outside the weekly plan — useful when something is happening right now and a quick post is needed.

- The system generates 3 short suggestions based on current weather conditions and the business's top menu items.
- Selecting one triggers a full caption in the brand voice, with a content-aware suggested posting time (brunch → 09:00, lunch → 11:00, dinner → 17:00).
- Free tier uses a universal safe hospitality voice; paid tiers use the full brand profile.
