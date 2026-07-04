-- published_posts — full schema
-- Safe to run on a fresh DB or on an existing table that only has the
-- minimal columns (business_id, menu_item_id, menu_item_name, published_at).
-- All statements are idempotent.

CREATE TABLE IF NOT EXISTS published_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Which platform this confirmation is for
  platform              text NOT NULL CHECK (platform IN ('facebook', 'instagram')),

  -- The actual text that was posted (copy of what was shown in manual modal)
  post_text             text,

  -- Optional photo that was included
  photo_url             text,

  -- How the post was published
  source                text NOT NULL DEFAULT 'manual_copy_paste'
                          CHECK (source IN ('manual_copy_paste', 'auto')),

  -- Content classification (from PostSpecification) — used by recency variety filter
  content_type          text,

  -- Menu item linkage — used by 14-day recency filter in opportunity-selector.ts
  menu_item_id          uuid,
  menu_item_name        text,

  -- Weekly Plan linkage — set when the post came from an Ugentlig Plan slot
  weekly_plan_id        uuid REFERENCES weekly_content_plans(id) ON DELETE SET NULL,
  weekly_plan_slot_date date,

  -- The time the user confirmed they posted.
  -- This is what the user selects/adjusts in the modal; defaults to NOW() if they don't change it.
  posted_at             timestamptz NOT NULL DEFAULT now(),

  -- published_at kept as a synonym so the existing recency query still works
  -- (opportunity-selector.ts filters by .gte('published_at', cutoff))
  published_at          timestamptz NOT NULL DEFAULT now(),

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be absent from a pre-existing minimal table
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS platform             text;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS post_text            text;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS photo_url            text;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'manual_copy_paste';
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS content_type         text;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS weekly_plan_id       uuid;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS weekly_plan_slot_date date;
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS posted_at            timestamptz NOT NULL DEFAULT now();
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS published_at         timestamptz NOT NULL DEFAULT now();
ALTER TABLE published_posts ADD COLUMN IF NOT EXISTS created_at           timestamptz NOT NULL DEFAULT now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_published_posts_business_at
  ON published_posts(business_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_posts_weekly_plan
  ON published_posts(weekly_plan_id)
  WHERE weekly_plan_id IS NOT NULL;

-- Row Level Security
ALTER TABLE published_posts ENABLE ROW LEVEL SECURITY;

-- Policies: drop first so the script is safely re-runnable
DROP POLICY IF EXISTS "Users can read own business posts"   ON published_posts;
DROP POLICY IF EXISTS "Users can insert own business posts" ON published_posts;

CREATE POLICY "Users can read own business posts"
  ON published_posts FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business posts"
  ON published_posts FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business posts"
  ON published_posts FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE  published_posts IS 'Records every manually-confirmed or auto-published post. Feeds the 14-day recency filter in the AI weekly strategy and the posting timeline UI.';
COMMENT ON COLUMN published_posts.posted_at    IS 'User-selected time of posting (adjustable in manual modal, default = now).';
COMMENT ON COLUMN published_posts.published_at IS 'Alias of posted_at kept for backwards compatibility with opportunity-selector recency query.';
COMMENT ON COLUMN published_posts.source       IS 'manual_copy_paste = user confirmed via modal; auto = future direct API posting.';
