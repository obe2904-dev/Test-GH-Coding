WITH target_business AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
),
latest_strategy AS (
  SELECT ws.*
  FROM weekly_strategies ws
  JOIN target_business tb ON tb.business_id = ws.business_id
  ORDER BY ws.generated_at DESC NULLS LAST
  LIMIT 1
),
latest_plan AS (
  SELECT wcp.*
  FROM weekly_content_plans wcp
  JOIN target_business tb ON tb.business_id = wcp.business_id
  ORDER BY wcp.generated_at DESC NULLS LAST, wcp.created_at DESC NULLS LAST
  LIMIT 1
),
plan_posts AS (
  SELECT
    lp.id AS plan_id,
    lp.business_id,
    lp.week_start,
    lp.week_end,
    p.ord AS post_index,
    p.post
  FROM latest_plan lp
  CROSS JOIN LATERAL jsonb_array_elements(lp.posts) WITH ORDINALITY AS p(post, ord)
),
weekly_plan_suggestions AS (
  SELECT ds.*
  FROM daily_suggestions ds
  JOIN target_business tb ON tb.business_id = ds.business_id
  WHERE ds.source = 'weekly_plan'
  ORDER BY ds.date, ds.position
)

SELECT
  1 AS section_order,
  'prompt_inputs' AS section,
  'weekly_strategies' AS storage_table,
  'generate-weekly-plan reads this context from weekly_strategies' AS record_key,
  f.field_name,
  f.field_value,
  f.notes
FROM latest_strategy s
CROSS JOIN LATERAL (
  VALUES
    ('id', s.id::text, 'strategy id passed into generate-weekly-plan'),
    ('business_id', s.business_id::text, 'ownership-scoped strategy row'),
    ('status', s.status::text, 'input status before the save/writeback step'),
    ('generated_at', COALESCE(s.generated_at::text, 'null'), 'strategy generation timestamp'),
    ('week_number', COALESCE(s.week_number::text, 'null'), 'strategy week number'),
    ('business_type', COALESCE(s.business_type::text, 'null'), 'strategy business type'),
    ('platforms', COALESCE(s.platforms::text, 'null'), 'target platforms used to build the plan'),
    ('subscription_tier', COALESCE(s.subscription_tier::text, 'null'), 'smart or pro tier'),
    ('target_post_count', COALESCE(s.target_post_count::text, 'null'), 'requested post count'),
    ('post_ideas_count', CASE
      WHEN s.post_ideas IS NOT NULL AND jsonb_typeof(s.post_ideas) = 'array'
      THEN jsonb_array_length(s.post_ideas)::text
      ELSE 'null'
    END, 'number of candidate ideas available to the planner'),
    ('week_context_event_count', CASE
      WHEN s.week_context_snapshot IS NOT NULL
       AND jsonb_typeof(s.week_context_snapshot) = 'object'
       AND s.week_context_snapshot ? 'events'
       AND jsonb_typeof(s.week_context_snapshot->'events') = 'array'
      THEN jsonb_array_length(s.week_context_snapshot->'events')::text
      ELSE 'null'
    END, 'event count pulled from week_context_snapshot'),
    ('strategic_brief', COALESCE(s.strategic_brief::text, 'null'), 'strategy brief used as prompt input'),
    ('strategic_priorities', COALESCE(s.strategic_priorities::text, 'null'), 'priority list used as prompt input'),
    ('narrative', COALESCE(s.narrative::text, 'null'), 'strategy narrative used as prompt input'),
    ('week_context_snapshot', COALESCE(s.week_context_snapshot::text, 'null'), 'stored week context used by the generator')
) AS f(field_name, field_value, notes)

UNION ALL

SELECT
  2 AS section_order,
  'weekly_content_plans' AS section,
  'weekly_content_plans' AS storage_table,
  lp.id::text AS record_key,
  f.field_name,
  f.field_value,
  f.notes
FROM latest_plan lp
CROSS JOIN LATERAL (
  VALUES
    ('id', lp.id::text, 'primary saved weekly plan row'),
    ('user_id', lp.user_id::text, 'owner of the plan'),
    ('business_id', lp.business_id::text, 'business scope'),
    ('strategy_id', COALESCE(lp.strategy_id::text, 'null'), 'link back to weekly_strategies'),
    ('week_number', lp.week_number::text, 'calendar week number'),
    ('week_start', lp.week_start::text, 'start of the planned week'),
    ('week_end', lp.week_end::text, 'end of the planned week'),
    ('generated_at', COALESCE(lp.generated_at::text, 'null'), 'generation timestamp'),
    ('created_at', COALESCE(lp.created_at::text, 'null'), 'row creation timestamp'),
    ('updated_at', COALESCE(lp.updated_at::text, 'null'), 'row update timestamp'),
    ('summary', COALESCE(lp.summary::text, 'null'), 'aggregate stats stored by saveWeeklyPlan'),
    ('learning_data', COALESCE(lp.learning_data::text, 'null'), 'learning counters stored by saveWeeklyPlan'),
    ('posts_json', COALESCE(lp.posts::text, 'null'), 'full post specification array stored in posts')
) AS f(field_name, field_value, notes)

UNION ALL

SELECT
  3 AS section_order,
  'weekly_content_plans.posts' AS section,
  'weekly_content_plans.posts' AS storage_table,
  CONCAT('post_', pp.post_index) AS record_key,
  f.field_name,
  f.field_value,
  f.notes
FROM plan_posts pp
CROSS JOIN LATERAL (
  VALUES
    ('selectionRationale', COALESCE(pp.post->>'selectionRationale', 'null'), 'why the post was chosen'),
    ('timing.day', COALESCE(pp.post #>> '{timing,day}', 'null'), 'scheduled weekday'),
    ('timing.date', COALESCE(pp.post #>> '{timing,date}', 'null'), 'scheduled date'),
    ('timing.time', COALESCE(pp.post #>> '{timing,time}', 'null'), 'scheduled time'),
    ('timing.rationale', COALESCE(pp.post #>> '{timing,rationale}', 'null'), 'timing rationale'),
    ('timing.timingRationale', COALESCE(pp.post #>> '{timing,timingRationale}', 'null'), 'AI timing reasoning'),
    ('platformFormat.platform', COALESCE(pp.post #>> '{platformFormat,platform}', 'null'), 'platform used for the post'),
    ('platformFormat.format', COALESCE(pp.post #>> '{platformFormat,format}', 'null'), 'content format used for the post'),
    ('platformFormat.platformRationale', COALESCE(pp.post #>> '{platformFormat,platformRationale}', 'null'), 'platform choice rationale'),
    ('platformFormat.formatRationale', COALESCE(pp.post #>> '{platformFormat,formatRationale}', 'null'), 'format choice rationale'),
    ('postType.type', COALESCE(pp.post #>> '{postType,type}', 'null'), 'post type'),
    ('postType.category', COALESCE(pp.post #>> '{postType,category}', 'null'), 'post category'),
    ('postType.goal_mode', COALESCE(pp.post #>> '{postType,goal_mode}', 'null'), 'goal mode if present'),
    ('postType.priority', COALESCE(pp.post #>> '{postType,priority}', 'null'), 'priority level'),
    ('contentSubject.dish', COALESCE(pp.post #>> '{contentSubject,dish}', 'null'), 'dish or content subject'),
    ('contentSubject.whyThisDish', COALESCE(pp.post #> '{contentSubject,whyThisDish}', 'null'::jsonb)::text, 'why the dish was selected'),
    ('contentSubject.menuItemName', COALESCE(pp.post #>> '{contentSubject,menuItemName}', 'null'), 'exact menu item name when applicable'),
    ('contentSubject.menuItemDescription', COALESCE(pp.post #>> '{contentSubject,menuItemDescription}', 'null'), 'menu item description when applicable'),
    ('opportunity.finalScore', COALESCE(pp.post #>> '{opportunity,finalScore}', 'null'), 'selection score'),
    ('opportunity.selectionReason', COALESCE(pp.post #>> '{opportunity,selectionReason}', 'null'), 'selection reason'),
    ('opportunity.timingReason', COALESCE(pp.post #>> '{opportunity,timingReason}', 'null'), 'timing reason'),
    ('caption.text', COALESCE(pp.post #>> '{caption,text}', 'null'), 'final caption text'),
    ('caption.characterCount', COALESCE(pp.post #>> '{caption,characterCount}', 'null'), 'caption length'),
    ('caption.tone', COALESCE(pp.post #>> '{caption,tone}', 'null'), 'caption tone'),
    ('caption.emojiCount', COALESCE(pp.post #>> '{caption,emojiCount}', 'null'), 'emoji count'),
    ('caption.ctaType', COALESCE(pp.post #>> '{caption,ctaType}', 'null'), 'CTA type'),
    ('caption.firstLine', COALESCE(pp.post #>> '{caption,firstLine}', 'null'), 'caption opening line'),
    ('caption.hashtags', COALESCE(pp.post #> '{caption,hashtags}', 'null'::jsonb)::text, 'caption hashtags'),
    ('visualDirection.subject', COALESCE(pp.post #>> '{visualDirection,subject}', 'null'), 'visual subject'),
    ('visualDirection.angle', COALESCE(pp.post #>> '{visualDirection,angle}', 'null'), 'visual angle'),
    ('visualDirection.setting', COALESCE(pp.post #>> '{visualDirection,setting}', 'null'), 'visual setting'),
    ('visualDirection.lighting', COALESCE(pp.post #>> '{visualDirection,lighting}', 'null'), 'lighting direction'),
    ('visualDirection.styling', COALESCE(pp.post #>> '{visualDirection,styling}', 'null'), 'styling direction'),
    ('visualDirection.context', COALESCE(pp.post #>> '{visualDirection,context}', 'null'), 'visual context'),
    ('visualDirection.technicalSpecs', COALESCE(pp.post #> '{visualDirection,technicalSpecs}', 'null'::jsonb)::text, 'technical specs for the visual'),
    ('visualDirection.altText', COALESCE(pp.post #>> '{visualDirection,altText}', 'null'), 'alt text'),
    ('productionNotes.estimatedTime', COALESCE(pp.post #>> '{productionNotes,estimatedTime}', 'null'), 'estimated production time'),
    ('productionNotes.logistics', COALESCE(pp.post #> '{productionNotes,logistics}', 'null'::jsonb)::text, 'production logistics'),
    ('productionNotes.timing', COALESCE(pp.post #>> '{productionNotes,timing}', 'null'), 'production timing note'),
    ('alternatives', COALESCE(pp.post #> '{alternatives}', 'null'::jsonb)::text, 'alternative post ideas'),
    ('strategicContext.cta_intent', COALESCE(pp.post #>> '{strategicContext,cta_intent}', 'null'), 'Layer 0 CTA intent'),
    ('strategicContext.suggested_media', COALESCE(pp.post #> '{strategicContext,suggested_media}', 'null'::jsonb)::text, 'suggested media'),
    ('strategicContext.strategic_fit', COALESCE(pp.post #>> '{strategicContext,strategic_fit}', 'null'), 'strategic fit score'),
    ('strategicContext.weather_dependent', COALESCE(pp.post #>> '{strategicContext,weather_dependent}', 'null'), 'weather dependency flag'),
    ('strategicContext.weather_flag', COALESCE(pp.post #>> '{strategicContext,weather_flag}', 'null'), 'weather note if present'),
    ('strategicContext.estimated_performance', COALESCE(pp.post #>> '{strategicContext,estimated_performance}', 'null'), 'estimated performance'),
    ('strategicContext.goal_mode', COALESCE(pp.post #>> '{strategicContext,goal_mode}', 'null'), 'goal mode'),
    ('strategicContext.content_category', COALESCE(pp.post #>> '{strategicContext,content_category}', 'null'), 'content category'),
    ('strategicContext.slot_id', COALESCE(pp.post #>> '{strategicContext,slot_id}', 'null'), 'slot id'),
    ('strategicContext.rationale', COALESCE(pp.post #>> '{strategicContext,rationale}', 'null'), 'raw strategic rationale'),
    ('strategicContext.owner_note_applied', COALESCE(pp.post #>> '{strategicContext,owner_note_applied}', 'null'), 'owner note flag'),
    ('strategicContext.drink_pairing', COALESCE(pp.post #>> '{strategicContext,drink_pairing}', 'null'), 'drink pairing note'),
    ('strategicContext.strategy_brief', COALESCE(pp.post #>> '{strategicContext,strategy_brief}', 'null'), 'compact strategy directive'),
    ('idea_id', COALESCE(pp.post #>> '{idea_id}', 'null'), 'original idea id copied into the plan'),
    ('title', COALESCE(pp.post #>> '{title}', 'null'), 'post title'),
    ('cta_text', COALESCE(pp.post #>> '{cta_text}', 'null'), 'CTA text'),
    ('visual_direction', COALESCE(pp.post #>> '{visual_direction}', 'null'), 'flattened visual direction string'),
    ('suggested_day', COALESCE(pp.post #>> '{suggested_day}', 'null'), 'flattened day field'),
    ('suggested_post_time', COALESCE(pp.post #>> '{suggested_post_time}', 'null'), 'flattened post time field'),
    ('holiday_context', COALESCE(pp.post #> '{holiday_context}', 'null'::jsonb)::text, 'holiday metadata when the post falls on a public holiday'),
    ('approval.status', COALESCE(pp.post #>> '{approval,status}', 'null'), 'approval workflow status'),
    ('approval.scheduledFor', COALESCE(pp.post #>> '{approval,scheduledFor}', 'null'), 'scheduled timestamp if present'),
    ('approval.postedAt', COALESCE(pp.post #>> '{approval,postedAt}', 'null'), 'published timestamp if present')
) AS f(field_name, field_value, notes)

UNION ALL

SELECT
  4 AS section_order,
  'daily_suggestions' AS section,
  'daily_suggestions' AS storage_table,
  ds.id::text AS record_key,
  f.field_name,
  f.field_value,
  f.notes
FROM weekly_plan_suggestions ds
CROSS JOIN LATERAL (
  VALUES
    ('id', ds.id::text, 'row id'),
    ('business_id', ds.business_id::text, 'business scope'),
    ('date', ds.date::text, 'planned date'),
    ('position', ds.position::text, 'daily slot position'),
    ('title', COALESCE(ds.title, 'null'), 'suggestion title'),
    ('rationale', COALESCE(ds.rationale, 'null'), 'suggestion rationale'),
    ('content_type', COALESCE(ds.content_type, 'null'), 'content type'),
    ('suggested_time', COALESCE(ds.suggested_time::text, 'null'), 'suggested posting time'),
    ('source', COALESCE(ds.source, 'null'), 'stored as weekly_plan'),
    ('is_active', ds.is_active::text, 'active flag'),
    ('selected', ds.selected::text, 'selection flag')
) AS f(field_name, field_value, notes)

UNION ALL

SELECT
  5 AS section_order,
  'weekly_strategies.writeback' AS section,
  'weekly_strategies' AS storage_table,
  s.id::text AS record_key,
  f.field_name,
  f.field_value,
  f.notes
FROM latest_strategy s
CROSS JOIN LATERAL (
  VALUES
    ('status', COALESCE(s.status, 'null'), 'updated to posts_created when saveWeeklyPlan succeeds'),
    ('selected_idea_ids', COALESCE(s.selected_idea_ids::text, 'null'), 'executed idea ids written back after generation')
) AS f(field_name, field_value, notes)

ORDER BY section_order, record_key, field_name;
