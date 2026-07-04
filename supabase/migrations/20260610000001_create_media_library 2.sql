-- Media Library Migration
-- Creates persistent storage for user-uploaded photos and videos
-- Part of Phase 1: Backend Infrastructure for Media Gallery feature

-- ============================================================================
-- TABLE: media_library
-- ============================================================================
-- Stores all user-uploaded media with metadata for organization and reuse
CREATE TABLE IF NOT EXISTS media_library (
  -- Core identifiers
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id TEXT NOT NULL,
  
  -- File storage
  storage_path TEXT NOT NULL UNIQUE,
  storage_bucket TEXT DEFAULT 'user-media' NOT NULL,
  thumbnail_path TEXT, -- Smaller preview (150x150) for gallery display
  
  -- File metadata
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  
  -- Image properties (NULL for videos)
  width INTEGER,
  height INTEGER,
  aspect_ratio DECIMAL(5,3), -- e.g., 1.778 for 16:9, 1.000 for square
  
  -- Video properties (NULL for images)
  duration INTEGER, -- Video duration in seconds
  video_thumbnail_path TEXT, -- Cover frame extracted from video
  
  -- Categorization & tagging
  post_type TEXT, -- 'menu_item', 'atmosphere', 'behind_the_scenes', 'event', etc.
  dish_name TEXT, -- If media is of a specific dish/item
  tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Flexible tagging system
  alt_text TEXT, -- Accessibility description for screen readers
  
  -- Usage tracking
  upload_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_date TIMESTAMPTZ, -- Last time media was selected for a post
  usage_count INTEGER DEFAULT 0 NOT NULL, -- How many times media has been reused
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ -- Soft delete - NULL = active, set timestamp = deleted
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Indexes for efficient queries, all filtered to exclude soft-deleted items

-- Primary lookup by user
CREATE INDEX idx_media_library_user_id 
  ON media_library(user_id) 
  WHERE deleted_at IS NULL;

-- Lookup by business (for multi-business users)
CREATE INDEX idx_media_library_business_id 
  ON media_library(business_id) 
  WHERE deleted_at IS NULL;

-- Sort by upload date (default sorting in gallery)
CREATE INDEX idx_media_library_upload_date 
  ON media_library(upload_date DESC) 
  WHERE deleted_at IS NULL;

-- Filter by post type
CREATE INDEX idx_media_library_post_type 
  ON media_library(post_type) 
  WHERE deleted_at IS NULL;

-- Filter by media type (images vs videos)
CREATE INDEX idx_media_library_media_type 
  ON media_library(media_type) 
  WHERE deleted_at IS NULL;

-- Search by tags using GIN index for array containment
CREATE INDEX idx_media_library_tags 
  ON media_library USING GIN(tags) 
  WHERE deleted_at IS NULL;

-- Sort by usage (find frequently reused or unused media)
CREATE INDEX idx_media_library_usage_count 
  ON media_library(usage_count DESC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Users can view their own media (excludes soft-deleted items)
CREATE POLICY "Users can view own media"
  ON media_library FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can insert their own media
CREATE POLICY "Users can insert own media"
  ON media_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own media (metadata, tags, etc.)
CREATE POLICY "Users can update own media"
  ON media_library FOR UPDATE
  USING (auth.uid() = user_id);

-- Note: No DELETE policy - we only support soft deletes via UPDATE

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update the updated_at timestamp on any change
CREATE TRIGGER media_library_updated_at
  BEFORE UPDATE ON media_library
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to increment usage count when media is reused
-- Called from frontend when user selects media from gallery
CREATE OR REPLACE FUNCTION increment_media_usage(media_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE media_library
  SET 
    usage_count = usage_count + 1,
    last_used_date = NOW(),
    updated_at = NOW()
  WHERE id = media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_media_usage TO authenticated;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE media_library IS 'Persistent storage for user-uploaded photos and videos with metadata for organization and reuse across posts';
COMMENT ON COLUMN media_library.storage_path IS 'Path in Supabase Storage bucket (e.g., business123/originals/timestamp_random.jpg)';
COMMENT ON COLUMN media_library.thumbnail_path IS 'Path to 150x150 thumbnail for fast gallery display';
COMMENT ON COLUMN media_library.post_type IS 'Category: menu_item, atmosphere, behind_the_scenes, event, announcement, customer_moment, team, seasonal, branding, other';
COMMENT ON COLUMN media_library.usage_count IS 'Number of times this media has been selected for posts (incremented via increment_media_usage function)';
COMMENT ON COLUMN media_library.deleted_at IS 'Soft delete timestamp - NULL = active, timestamp = deleted (preserves media referenced in scheduled posts)';
