-- Complete decision timing system check for Cafe Faust
-- Shows both operational backend (booking/walk-in) and brand profile (decision_timing)

-- 1. OPERATIONAL BACKEND: Booking policy from business_operations
SELECT 
  'OPERATIONAL BACKEND' as source,
  reservation_required as "Requires Booking",
  accepts_walkins as "Accepts Walk-ins",
  CASE 
    WHEN reservation_required = TRUE AND accepts_walkins = FALSE THEN 'ONLY booking (high-end)'
    WHEN reservation_required = FALSE AND accepts_walkins = TRUE THEN 'Walk-in friendly (may also book)'
    WHEN reservation_required = TRUE AND accepts_walkins = TRUE THEN 'Both booking + walk-in'
    ELSE 'Not configured'
  END as "Policy Type"
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. BRAND PROFILE BACKEND: Decision timing from business_programme_profiles
SELECT 
  'BRAND PROFILE (V5)' as source,
  programme_name,
  decision_timing as "Customer Decision Pattern",
  baseline_goal_split->>'drive_footfall' as "Footfall %",
  baseline_goal_split->>'strengthen_brand' as "Brand %",
  baseline_goal_split->>'retain_regulars' as "Retain %"
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- 3. SUMMARY: How they work together
SELECT 
  '
┌─────────────────────────────────────────────────────────────┐
│ DECISION TIMING SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. OPERATIONAL BACKEND (business_operations):               │
│    • reservation_required: Can customers book tables?       │
│    • accepts_walkins: Does venue accept walk-ins?           │
│    → Describes OPERATIONAL POLICY (what venue allows)       │
│                                                             │
│ 2. BRAND PROFILE BACKEND (business_programme_profiles):     │
│    • decision_timing: When do customers decide to visit?    │
│      - spontaneous_walk_in: Same-day decisions              │
│      - planned_reservation: Book in advance                 │
│      - mixed: BOTH patterns exist                           │
│    • baseline_goal_split: % footfall vs brand vs retain     │
│    → Describes CUSTOMER BEHAVIOR (how they decide)          │
│                                                             │
│ 3. HOW THEY WORK TOGETHER:                                  │
│    • Operational backend = CONSTRAINT (what CAN happen)     │
│    • Brand profile = INSIGHT (what DOES happen)             │
│    • Weekly strategy uses BOTH to plan posts:               │
│      - mixed timing → advance posts + same-day posts        │
│      - footfall % → more promotional content                │
│                                                             │
│ EXAMPLE (Cafe Faust):                                       │
│    • Operational: accepts_walkins=true (walk-in friendly)   │
│    • Brand Profile: decision_timing="mixed" (both patterns) │
│    • Result: Tuesday posts for Saturday brunch (planned)    │
│              + Saturday 10am posts for same-day (spontaneous)│
│                                                             │
└─────────────────────────────────────────────────────────────┘
' as "System Architecture";
