# AI-Powered Timing Intelligence - Quality Test Plan

## Implementation Summary

Successfully deployed context-aware timing system that replaces rigid rules with AI reasoning.

### Key Changes
1. ✅ Created `timing-context-builder.ts` - Assembles all contextual data (calendar, weather, audience, business)
2. ✅ Created `timing-prompt-builder.ts` - Generates comprehensive AI prompts with context
3. ✅ Modified `phase2b-timing-engine.ts` - AI-first with rules-based fallback
4. ✅ Updated `weekly-plan-generator.ts` - Surfaces `timing_rationale` in UI
5. ✅ Deployed to production (155.1kB)

---

## Test Scenario 1: School Vacation Week (Primary Use Case)

### Setup
```sql
-- This would be in your calendar data for week containing May 13, 2026
-- events table should have:
{
  "type": "school_vacation",
  "name": "Winter Vacation",
  "name_local": "Vinterferie",
  "date": "2026-05-10",
  "date_end": "2026-05-16",
  "in_week": true,
  "commercial_weight": 3,
  "hospitality_traffic": "high"
}
```

### Expected Behavior
**Content**: "Børnevenlig brunch med pandekager"  
**Programme**: Børnemenu (target: families with children)  

**AI Should Reason**:
- ✅ Detect school vacation (May 10-16)
- ✅ Recognize børnemenu targets families with children
- ✅ Override standard "brunch = weekend only" rule
- ✅ Choose Tuesday or Wednesday as VALID (families available)
- ✅ Rationale mentions vacation context explicitly

**Sample Expected Output**:
```json
{
  "suggested_day": "2026-05-13",
  "suggested_time": "09:00",
  "timing_rationale": "Vinterferie (May 10-16) means schools closed — families with children available all week looking for activities. Børnebrunch targets this exact segment. Posted Tuesday at 09:00 to hit morning scroll when parents planning same-day outings. Drive-traffic CTA + 3 hours before typical brunch service (12:00) = optimal hunger window. Weather: 14°C partly cloudy, suitable for family outings. Tuesday chosen to capture early-week vacation momentum."
}
```

### How to Validate
1. Generate Weekly Plan for Cafe Faust
2. Check if børnebrunch idea exists
3. Inspect `timing_rationale` field in response
4. Verify it mentions "Vinterferie" or "vacation"
5. Confirm Tuesday/Wednesday is chosen (not rejected)

---

## Test Scenario 2: Normal Week (Control)

### Setup
No school vacation events in calendar for the week

### Expected Behavior
**Same Content**: "Børnevenlig brunch med pandekager"

**AI Should Reason**:
- ✅ No vacation detected
- ✅ Families busy weekdays (school + work)
- ✅ Choose Friday evening OR Saturday/Sunday morning
- ✅ Rationale explains standard availability patterns

**Sample Expected Output**:
```json
{
  "suggested_day": "2026-05-16",
  "suggested_time": "18:00",
  "timing_rationale": "Normal week — families with children typically available weekends due to school and work constraints. Børnebrunch targets families. Posted Friday evening (18:00) to hit planning scroll when parents decide weekend activities. Booking CTA benefits from 1-day advance decision window. Weather forecast shows Saturday suitable for brunch outing."
}
```

---

## Test Scenario 3: Surge Holiday (e.g., Kristi Himmelfartsdag)

### Setup
```sql
-- Thursday holiday with surge traffic
{
  "type": "holiday",
  "name": "Kristi Himmelfartsdag",
  "date": "2026-05-21",
  "in_week": true,
  "commercial_weight": 5,
  "hospitality_traffic": "surge",
  "retail_impact": "stores_closed"
}
```

### Expected Behavior
**Content**: Any drive-traffic post

**AI Should Reason**:
- ✅ Detect surge holiday Thursday
- ✅ Recognize extended weekend opportunity (Thu-Sun)
- ✅ Shift Monday posts to Wednesday (pre-holiday momentum)
- ✅ Prioritize Thursday for drive_footfall content

---

## Test Scenario 4: Weather-Dependent Content

### Setup
```sql
-- Weather forecast with one excellent day
{
  "days": [
    {"date": "2026-05-15", "condition": "rainy", "temp_max": 12, "precipitation_probability": 0.8},
    {"date": "2026-05-16", "condition": "sunny", "temp_max": 22, "precipitation_probability": 0.1},
    {"date": "2026-05-17", "condition": "cloudy", "temp_max": 15, "precipitation_probability": 0.3}
  ]
}
```

### Expected Behavior
**Content**: "Terrasse season opening" (weather_dependent: true)

**AI Should Reason**:
- ✅ Calculate weather quality scores
- ✅ Choose Friday (score 6/6: sunny, 22°C, 10% rain)
- ✅ Avoid Thursday (rainy, cold)
- ✅ Rationale references specific weather conditions

---

## Validation Checklist

### Data Flow
- [ ] `buildTimingContext()` correctly extracts school vacation events
- [ ] `inferAudienceAvailability()` sets `this_week_override` for vacation weeks
- [ ] AI prompt includes "THIS WEEK OVERRIDE" section
- [ ] OpenAI returns valid JSON with all required fields
- [ ] `timing_rationale` stored in idea object
- [ ] `timing_rationale` flows through to PostSpecification
- [ ] UI displays `opportunity.timingReason`

### AI Quality
- [ ] Rationale length 150-250 words (comprehensive but not verbose)
- [ ] References specific context factors (vacation name, dates)
- [ ] Explains WHY this timing vs. standard patterns
- [ ] Mentions weather if content is weather-dependent
- [ ] Includes goal/CTA reasoning (drive-traffic → hunger window)
- [ ] Justifies day choice within week context

### Fallback Safety
- [ ] If AI fails, rules-based timing still works
- [ ] Error logged but generation continues
- [ ] `timing_rationale` shows "Rules-based timing: ..." when fallback used

---

## Manual Test Commands

### 1. Generate Weekly Plan
```bash
# Via Supabase CLI or UI
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "2037d63c-a138-4247-89c5-5b6b8cef9f3f",
    "week_offset": 0
  }'
```

### 2. Inspect Response
```javascript
// Look for timing_rationale in response
response.post_ideas.forEach(idea => {
  console.log('Title:', idea.title);
  console.log('Day:', idea.suggested_day);
  console.log('Time:', idea.suggested_time);
  console.log('Rationale:', idea.timing_rationale);
  console.log('---');
});
```

### 3. Check Database
```sql
-- If plan is saved to DB
SELECT 
  title,
  suggested_day,
  suggested_time,
  data->'opportunity'->>'timingReason' as timing_reasoning
FROM posts
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Success Criteria

### ✅ System Working Correctly If:

1. **School Vacation Week**:
   - Børnebrunch can be scheduled Tuesday/Wednesday
   - Rationale mentions "Vinterferie" or "vacation"
   - Explanation includes "families available all week"

2. **Normal Week**:
   - Same content moves to Friday evening or weekend
   - Rationale explains "weekday constraints"

3. **Reasoning Quality**:
   - Every decision has detailed rationale (150-250 words)
   - Context-specific (not generic)
   - References actual data (vacation dates, weather, etc.)

4. **Fallback Safety**:
   - If OpenAI fails, system uses rules (doesn't crash)
   - Error logged but user experience intact

5. **UI Integration**:
   - `timing_rationale` visible in Weekly Plan UI
   - Displayed separately from content selection reasoning
   - Helps user understand WHEN decisions

---

## Common Issues & Debugging

### Issue: AI always falls back to rules
**Cause**: OpenAI API key missing or invalid  
**Fix**: Check `OPENAI_API_KEY` environment variable in Supabase secrets

### Issue: Rationale not showing in UI
**Cause**: Frontend not reading `opportunity.timingReason`  
**Fix**: Ensure UI component displays both `selectionReason` AND `timingReason`

### Issue: AI chooses invalid days
**Cause**: Prompt doesn't emphasize available_days constraint  
**Fix**: Validation rejects invalid days, falls back to rules

### Issue: Generic reasoning (not context-aware)
**Cause**: Context not properly built or passed to AI  
**Fix**: Check console logs for "Context includes: ..." to verify data flow

---

## Next Steps After Validation

1. **Monitor AI decisions** for first week
2. **Collect edge cases** where AI reasoning seems off
3. **Refine prompt** based on real-world patterns
4. **Add A/B testing** (AI vs. rules) to measure performance
5. **Cost monitoring** (OpenAI API usage per plan generation)
