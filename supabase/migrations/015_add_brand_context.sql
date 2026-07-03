-- Add AI Brand Context columns to business_profile table
-- These store the AI-generated brand guidelines used for content creation

ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS ai_brand_context TEXT,
ADD COLUMN IF NOT EXISTS ai_brand_context_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_brand_context_approved BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.business_profile.ai_brand_context IS 
  'AI-generated brand context prompt used for content creation. Includes tone of voice, audience, menu highlights, and content guidelines.';

COMMENT ON COLUMN public.business_profile.ai_brand_context_generated_at IS 
  'Timestamp when the brand context was last generated';

COMMENT ON COLUMN public.business_profile.ai_brand_context_approved IS 
  'Whether the user has reviewed and approved the brand context';

-- Create index for efficient querying by generation timestamp
CREATE INDEX IF NOT EXISTS idx_business_profile_brand_context_generated 
  ON public.business_profile(ai_brand_context_generated_at) 
  WHERE ai_brand_context IS NOT NULL;
