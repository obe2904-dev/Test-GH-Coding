# Design Guide - Nordic AI SaaS

## Color System

Our color palette is inspired by Nordic design principles: clean, modern, and calm. The teal/mint combination represents AI intelligence and freshness, while lilac adds warmth and brand personality.

### Primary Colors (Functional)

**Deep Nordic Blue-Green** `#0F2E32`
- Use for: CTA backgrounds, primary action buttons, active nav text
- Represents: Trust, intelligence, AI technology
- Examples: "Få AI-hjælp", "Continue", "Generate Ideas"

**Soft Mint AI** `#88F2D7`
- Use for: CTA text, active tab indicators, focus rings
- Represents: AI assistance, innovation, freshness
- Pairs with: #0F2E32 background

**Hover State** `#12393D`
- Use for: Hover states on primary buttons
- Slightly darker than primary background

**Selected Hashtag Background** `#124044`
- Use for: Selected hashtag pills (differentiated from CTAs)
- Slightly lighter than primary for cognitive separation

**Focus State** `#9AF5DF`
- Use for: Focus rings, active states
- Lighter, more vibrant mint

### Secondary Colors (Brand Personality)

**Lilac Fog** `#C7BAF7`
- Use for: Decorative accents, brand personality elements, step numbers
- Examples: Active sidebar border, step circle numbers, decorative elements
- ❌ DO NOT use for: CTAs, buttons, inputs, alerts, functional UI

**Lilac Tint (Enhanced)** `#F3F0FF`
- Use for: Step circle backgrounds, light brand personality backgrounds
- Updated from #F4F1FE for better visibility
- Examples: Active/completed step circles
- ❌ DO NOT use for: Primary actions or functional elements

> **Important:** Lilac colors are for brand personality ONLY, not functionality. Keep them subtle and decorative.

### Neutrals (UI Foundation)

**Page Background** `#FAFAFA`
- Main page background color

**Card Background** `#FFFFFF`
- All cards, panels, and elevated surfaces

**Border Strong** `#D1D5DB`
- Card borders, primary borders (updated for better definition)
- Previously used #E5E7EB (too light)

**Border Medium (Step Circles)** `#CBD5E1`
- Step circle borders (slate-300 for better visibility)
- Cooler, slightly more saturated than #D1D5DB

**Border Light** `#E5E7EB`
- Very subtle dividers only
- Use sparingly

**Disabled Text** `#9CA3AF`
- Disabled buttons, inactive tools, muted labels

**Secondary Text** `#6B7280`
- Descriptions, helper text, inactive tabs

**Section Labels** `#374151`
- Form labels, section titles (updated for better clarity)
- Previously used #6B7280 (too faded)

**Main Text** `#1F2937`
- Primary content, headings, body text

### State Colors

**Success** `#10B981`
- Successful actions, confirmations
- Example: Spelling check complete

**Warning** `#FBBF24`
- Warnings, free tier highlights
- Example: Upgrade prompt button

**Error** `#EF4444`
- Errors, destructive actions, validation failures

## Usage Guidelines

### Primary Actions
All primary CTAs use the Nordic teal/mint combination:
```tsx
bg-[#0F2E32] text-[#88F2D7] hover:bg-[#12393D]
```

### Brand Personality Elements
Lilac is reserved for non-functional brand personality:
- Active navigation highlighting (subtle)
- Decorative accents
- Brand differentiation elements

### Text Hierarchy
1. Main text: `#1F2937`
2. Secondary text: `#6B7280`
3. Disabled/muted text: `#9CA3AF`

### Borders
1. Default borders: `#E5E7EB`
2. Focus/active borders: `#D1D5DB`
3. Never use colored borders for functional inputs

## Design Principles

1. **Clarity over decoration** - Teal/mint for actions, neutrals for structure
2. **Subtle personality** - Lilac sparingly for brand warmth
3. **High contrast** - Ensure accessibility with dark text on light backgrounds
4. **Consistent hierarchy** - Same color = same function across the app
5. **Nordic minimalism** - Clean, spacious, purposeful

## Component Examples

### Primary Button
- Background: `#0F2E32`
- Text: `#88F2D7`
- Hover: `#12393D`
- Focus ring: `#9AF5DF`

### Active Sidebar Item
- Background: `#F4F1FE` (lilac tint)
- Text: `#1F2937` (main text)
- Border-left: `3px solid #C7BAF7` (lilac accent)

### Input Field
- Background: `#FFFFFF`
- Border: `#E5E7EB`
- Focus border: `#D1D5DB`
- Text: `#1F2937`
- Placeholder: `text-gray-400`

### Cards
- Background: `#FFFFFF`
- Border: `#E5E7EB`
- Border radius: `rounded-xl`
- Shadow: `shadow-sm`
