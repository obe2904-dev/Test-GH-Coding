/**
 * usePosts — Unified post management for complete lifecycle
 *
 * Replaces usePostDrafts + usePublishedPosts with a single interface.
 * All post states (draft, scheduled, published, archived) live in one table.
 *
 * Post lifecycle:
 *   draft     → Work in progress (Idea → Design → Udgiv stages)
 *   scheduled → User scheduled for future posting
 *   published → Posted to social media
 *   archived  → Hidden/deleted by user
 *
 * Benefits vs. old two-table architecture:
 *   ✅ No data migration between tables
 *   ✅ Complete history in one row
 *   ✅ Simple status transitions (UPDATE vs. INSERT+DELETE)
 *   ✅ Unified timeline queries
 *   ✅ Atomic updates (no partial migration failures)
 */

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { uploadPostPhoto } from '../lib/postMedia'

// ── Types ──────────────────────────────────────────────────────────────────────

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type PostIdeaSource = 'write' | 'quick_suggestions' | 'weekly_plan' | 'manual'

/** Identifies which post to load/save/delete */
export interface PostKey {
  businessId: string
  ideaSource: PostIdeaSource
  /** Single platform (facebook, instagram) — NULL for unified drafts before Udgiv split */
  platform?: string | null
  /** daily_suggestions.id when ideaSource === 'quick_suggestions' */
  suggestionId?: number | null
  /** UUID of weekly content plan (legacy) */
  weeklyPlanId?: string | null
  /** Zero-based post index within weekly plan (legacy) */
  weeklyPlanSlotIndex?: number | null
  /** ISO date "YYYY-MM-DD" of weekly plan slot (preferred key) */
  weeklyPlanSlotDate?: string | null
}

/** Data payload for saving posts */
export interface PostData {
  // Platform selection
  platforms?: string[]  // Array during Design stage (before split)
  platform?: string | null  // Single platform during/after Udgiv split

  // Content
  postText?: string | null
  photoUrl?: string | null
  contentJson?: unknown  // Full PostContent snapshot
  photoIdea?: string | null

  // Metadata
  captionData?: unknown
  mediaMetadata?: Record<string, unknown> | null

  // Classification
  contentType?: string | null
  menuItemId?: string | null
  menuItemName?: string | null

  // Timing
  suggestedPostDatetime?: string | null
  suggestedPostTime?: string | null
  scheduledFor?: Date | null
  postedAt?: Date | null

  // Source tracking
  ideaSource?: PostIdeaSource
  suggestionId?: number | null
  weeklyPlanId?: string | null
  weeklyPlanIdeaId?: number | null
  weeklyPlanSlotDate?: string | null
  weeklyPlanSlotIndex?: number | null

  // Status
  status?: PostStatus

  // Other
  source?: string
  ideaData?: unknown
  mediaAnalysis?: unknown
  phase?: string
}

/** Loaded post from database */
export interface LoadedPost {
  id: string
  status: PostStatus
  businessId: string
  userId?: string | null

  // Platform
  platform?: string | null
  platforms?: string[]

  // Content
  postText?: string | null
  photoUrl?: string | null
  contentJson?: unknown
  photoIdea?: string | null
  captionData?: unknown
  mediaMetadata?: unknown

  // Source
  ideaSource?: PostIdeaSource
  suggestionId?: number | null
  weeklyPlanSlotDate?: string | null
  weeklyPlanId?: string | null
  weeklyPlanIdeaId?: number | null

  // Classification
  contentType?: string | null
  menuItemName?: string | null
  menuItemId?: string | null

  // Timing
  suggestedPostDatetime?: string | null
  scheduledFor?: string | null
  postedAt?: string | null

  // Metadata
  createdAt?: string
  updatedAt?: string
}

// ── Main Hook ──────────────────────────────────────────────────────────────────

export function usePosts() {
  /**
   * Load a post by key. Returns null if not found.
   * Used for restoring drafts on page reload.
   */
  const loadPost = useCallback(async (key: PostKey): Promise<LoadedPost | null> => {
    let q = supabase
      .from('posts')
      .select('*')
      .eq('business_id', key.businessId)
      .eq('idea_source', key.ideaSource)

    // Platform filter
    if (key.platform != null) {
      q = q.eq('platform', key.platform)
    } else {
      q = q.is('platform', null)
    }

    // Suggestion filter
    if (key.suggestionId != null) {
      q = q.eq('suggestion_id', key.suggestionId)
    } else {
      q = q.is('suggestion_id', null)
    }

    // Weekly plan filter (prefer slot_date over legacy plan_id + index)
    if (key.weeklyPlanSlotDate != null) {
      q = q.eq('weekly_plan_slot_date', key.weeklyPlanSlotDate)
    } else if (key.weeklyPlanId != null) {
      q = q.eq('weekly_plan_id', key.weeklyPlanId)
        .eq('weekly_plan_slot_index', key.weeklyPlanSlotIndex ?? 0)
    } else {
      q = q.is('weekly_plan_id', null)
    }

    const { data, error } = await q.maybeSingle()
    if (error) {
      console.warn('[usePosts] loadPost error:', error.message)
      return null
    }
    if (!data) return null

    return mapRowToPost(data)
  }, [])

  /**
   * Save (insert or update) a post.
   * Returns the post ID on success, null on error.
   */
  const savePost = useCallback(async (key: PostKey, data: PostData): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()

    // Check if post already exists
    const existing = await loadPost(key)

    const row = {
      business_id:              key.businessId,
      user_id:                  user?.id ?? null,
      idea_source:              key.ideaSource,
      platform:                 data.platform ?? key.platform ?? null,
      platforms:                data.platforms ?? (key.platform ? [key.platform] : []),
      suggestion_id:            data.suggestionId ?? key.suggestionId ?? null,
      weekly_plan_id:           data.weeklyPlanId ?? key.weeklyPlanId ?? null,
      weekly_plan_idea_id:      data.weeklyPlanIdeaId ?? null,
      weekly_plan_slot_date:    data.weeklyPlanSlotDate ?? key.weeklyPlanSlotDate ?? null,
      weekly_plan_slot_index:   data.weeklyPlanSlotIndex ?? key.weeklyPlanSlotIndex ?? null,
      
      // Content
      post_text:                data.postText ?? null,
      photo_url:                data.photoUrl ?? null,
      content_json:             (data.contentJson as any) ?? null,
      photo_idea:               data.photoIdea ?? null,
      caption_data:             (data.captionData as any) ?? null,
      media_metadata:           data.mediaMetadata ?? null,
      
      // Classification
      content_type:             data.contentType ?? null,
      menu_item_id:             data.menuItemId ?? null,
      menu_item_name:           data.menuItemName ?? null,
      
      // Timing
      suggested_post_datetime:  data.suggestedPostDatetime ?? null,
      suggested_time:           data.suggestedPostTime ?? null,
      scheduled_for:            data.scheduledFor ? data.scheduledFor.toISOString() : null,
      posted_at:                data.postedAt ? data.postedAt.toISOString() : null,
      published_at:             data.postedAt ? data.postedAt.toISOString() : null, // Alias for backwards compatibility
      
      // Status
      status:                   data.status ?? 'draft',
      source:                   data.source ?? 'manual_copy_paste',
      
      // Other
      idea_data:                data.ideaData ?? null,
      media_analysis:           data.mediaAnalysis ?? null,
      phase:                    data.phase ?? null,
      
      updated_at:               new Date().toISOString(),
    }

    if (existing?.id) {
      // Update existing post
      const { error } = await supabase
        .from('posts')
        .update(row as any)
        .eq('id', existing.id)
      
      if (error) {
        console.warn('[usePosts] savePost update error:', error.message)
        return null
      }
      return existing.id
    }

    // Insert new post
    const { data: inserted, error } = await supabase
      .from('posts')
      .insert(row as any)
      .select('id')
      .single()
    
    if (error) {
      console.error('[usePosts] savePost INSERT FAILED:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      console.error('[usePosts] Failed row data:', row)
      return null
    }
    return (inserted?.id as string) ?? null
  }, [loadPost])

  /**
   * Save a draft post (convenience wrapper for savePost with status='draft')
   */
  const saveDraft = useCallback(async (key: PostKey, data: PostData): Promise<string | null> => {
    return savePost(key, { ...data, status: 'draft' })
  }, [savePost])

  /**
   * Publish a post: update existing draft to published/scheduled status.
   * Changes status in the unified posts table (no table migration needed).
   */
  const publishPost = useCallback(async (
    postId: string,
    data: {
      platform: string
      postText: string
      photoFile?: File | null
      photoUrl?: string | null
      contentType?: string | null
      menuItemId?: string | null
      menuItemName?: string | null
      weeklyPlanId?: string | null
      weeklyPlanIdeaId?: number | null
      weeklyPlanSlotDate?: string | null
      scheduledFor?: Date | null
      postedAt?: Date
      captionData?: unknown
      mediaMetadata?: Record<string, unknown> | null
      suggestedPostTime?: string | null
    }
  ): Promise<{ error: string | null; photoUploadFailed: boolean }> => {
    const { data: { user } } = await supabase.auth.getUser()

    // Upload photo if provided
    let persistedPhotoUrl: string | null = data.photoUrl ?? null
    let photoUploadFailed = false
    
    if (data.photoFile) {
      // Get business_id from the post
      const { data: post } = await supabase
        .from('posts')
        .select('business_id')
        .eq('id', postId)
        .single()
      
      if (post?.business_id) {
        persistedPhotoUrl = await uploadPostPhoto(post.business_id, data.photoFile)
        if (!persistedPhotoUrl) photoUploadFailed = true
      }
    } else if (data.photoUrl && !data.photoUrl.startsWith('blob:')) {
      persistedPhotoUrl = data.photoUrl
    }

    // Normalize content_type
    const validContentTypes = ['product', 'experience', 'occasion', 'atmosphere', 'retention', 'team']
    let normalizedContentType: string | null = null
    if (data.contentType) {
      const lower = data.contentType.toLowerCase().trim()
      normalizedContentType = validContentTypes.includes(lower) ? lower : null
    }

    // Determine status
    const status: PostStatus = data.scheduledFor ? 'scheduled' : 'published'
    const postedAt = data.postedAt ?? new Date()

    // Update the post
    const { error } = await supabase
      .from('posts')
      .update({
        status,
        platform:              data.platform.toLowerCase(),
        post_text:             data.postText,
        photo_url:             persistedPhotoUrl,
        content_type:          normalizedContentType,
        menu_item_id:          data.menuItemId ?? null,
        menu_item_name:        data.menuItemName ?? null,
        weekly_plan_id:        data.weeklyPlanId ?? null,
        weekly_plan_idea_id:   data.weeklyPlanIdeaId ?? null,
        weekly_plan_slot_date: data.weeklyPlanSlotDate ?? null,
        scheduled_for:         data.scheduledFor ? data.scheduledFor.toISOString() : null,
        posted_at:             postedAt.toISOString(),
        published_at:          postedAt.toISOString(),
        caption_data:          (data.captionData ?? null) as any,
        media_metadata:        (data.mediaMetadata ?? null) as any,
        suggested_time:        data.suggestedPostTime ?? null,
        source:                'manual_copy_paste',
        updated_at:            new Date().toISOString(),
      })
      .eq('id', postId)

    if (error) {
      console.error('[usePosts] publishPost error:', error.message)
      return { error: error.message, photoUploadFailed }
    }

    return { error: null, photoUploadFailed }
  }, [])

  /**
   * Delete a post by ID.
   * Can be used for both drafts and published posts.
   */
  const deletePost = useCallback(async (id: string): Promise<{ error: string | null; deleted: boolean }> => {
    console.log('[usePosts] Deleting post:', id)
    
    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('[usePosts] deletePost error:', error.message)
      return { error: error.message, deleted: false }
    }

    const deletedCount = data?.length ?? 0
    if (deletedCount === 0) {
      console.warn('[usePosts] No rows deleted - post may not exist or RLS blocking')
      return { error: 'Post not found or permission denied', deleted: false }
    }

    console.log(`[usePosts] Successfully deleted ${deletedCount} post(s)`)
    return { error: null, deleted: true }
  }, [])

  /**
   * Delete post by key (alternative when ID not cached)
   */
  const deleteByKey = useCallback(async (key: PostKey): Promise<void> => {
    let q = supabase
      .from('posts')
      .delete()
      .eq('business_id', key.businessId)
      .eq('idea_source', key.ideaSource)

    if (key.platform != null) q = q.eq('platform', key.platform)
    else q = q.is('platform', null)

    if (key.suggestionId != null) q = q.eq('suggestion_id', key.suggestionId)
    else q = q.is('suggestion_id', null)

    if (key.weeklyPlanSlotDate != null) {
      q = q.eq('weekly_plan_slot_date', key.weeklyPlanSlotDate)
    } else if (key.weeklyPlanId != null) {
      q = q.eq('weekly_plan_id', key.weeklyPlanId)
        .eq('weekly_plan_slot_index', key.weeklyPlanSlotIndex ?? 0)
    } else {
      q = q.is('weekly_plan_id', null)
    }

    const { error } = await q
    if (error) console.warn('[usePosts] deleteByKey error:', error.message)
  }, [])

  /**
   * Archive a post (soft delete - sets status to 'archived')
   */
  const archivePost = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('posts')
      .update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('[usePosts] archivePost error:', error.message)
      return { error: error.message }
    }
    return { error: null }
  }, [])

  /**
   * Update post scheduling (reschedule or change to publish now)
   */
  const updateSchedule = useCallback(async (
    id: string,
    fields: {
      scheduledFor: Date | null
      postedAt: Date
      status: PostStatus
    }
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('posts')
      .update({
        scheduled_for: fields.scheduledFor ? fields.scheduledFor.toISOString() : null,
        posted_at:     fields.postedAt.toISOString(),
        published_at:  fields.postedAt.toISOString(),
        status:        fields.status,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('[usePosts] updateSchedule error:', error.message)
      return { error: error.message }
    }
    return { error: null }
  }, [])

  /**
   * Load all drafts for a business (for timeline display)
   */
  const loadDrafts = useCallback(async (businessId: string): Promise<LoadedPost[]> => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('[usePosts] loadDrafts error:', error.message)
      return []
    }
    return (data ?? []).map(mapRowToPost)
  }, [])

  /**
   * Load scheduled posts for a business
   */
  const loadScheduledPosts = useCallback(async (businessId: string): Promise<LoadedPost[]> => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })

    if (error) {
      console.warn('[usePosts] loadScheduledPosts error:', error.message)
      return []
    }
    return (data ?? []).map(mapRowToPost)
  }, [])

  /**
   * Load published posts for a business
   */
  const loadPublishedPosts = useCallback(async (
    businessId: string,
    limit = 50
  ): Promise<LoadedPost[]> => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'published')
      .order('posted_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[usePosts] loadPublishedPosts error:', error.message)
      return []
    }
    return (data ?? []).map(mapRowToPost)
  }, [])

  /**
   * Load all posts for timeline (drafts + scheduled + published)
   */
  const loadAllPosts = useCallback(async (
    businessId: string,
    statuses: PostStatus[] = ['draft', 'scheduled', 'published']
  ): Promise<LoadedPost[]> => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .in('status', statuses)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[usePosts] loadAllPosts error:', error.message)
      return []
    }
    return (data ?? []).map(mapRowToPost)
  }, [])

  /**
   * Get a single post by ID
   */
  const getPostById = useCallback(async (id: string): Promise<LoadedPost | null> => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.warn('[usePosts] getPostById error:', error.message)
      return null
    }
    return data ? mapRowToPost(data) : null
  }, [])

  /**
   * Delete all drafts for a specific idea source (e.g. when suggestions reset)
   */
  const deleteBySource = useCallback(async (
    businessId: string,
    ideaSource: PostIdeaSource
  ): Promise<void> => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('business_id', businessId)
      .eq('idea_source', ideaSource)
      .eq('status', 'draft')

    if (error) console.warn('[usePosts] deleteBySource error:', error.message)
  }, [])

  /**
   * Cleanup stale drafts (past weekly plan slots, old quick-suggestions)
   */
  const cleanupStaleDrafts = useCallback(async (businessId: string): Promise<void> => {
    const todayStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Delete past weekly plan slot drafts
    const { error: e1 } = await supabase
      .from('posts')
      .delete()
      .eq('business_id', businessId)
      .eq('idea_source', 'weekly_plan')
      .eq('status', 'draft')
      .not('weekly_plan_slot_date', 'is', null)
      .lt('weekly_plan_slot_date', todayStr)

    if (e1) console.warn('[usePosts] cleanupStaleDrafts (weekly) error:', e1.message)

    // Delete old quick-suggestion drafts (from previous days)
    const { error: e2 } = await supabase
      .from('posts')
      .delete()
      .eq('business_id', businessId)
      .eq('idea_source', 'quick_suggestions')
      .eq('status', 'draft')
      .lt('updated_at', todayStr)

    if (e2) console.warn('[usePosts] cleanupStaleDrafts (quick) error:', e2.message)
  }, [])

  /**
   * Upload photo for a post (returns persistent URL)
   */
  const uploadPhoto = useCallback(
    (businessId: string, file: File) => uploadPostPhoto(businessId, file),
    []
  )

  return {
    // Load
    loadPost,
    loadDrafts,
    loadScheduledPosts,
    loadPublishedPosts,
    loadAllPosts,
    getPostById,

    // Save
    savePost,
    saveDraft,
    publishPost,

    // Update
    updateSchedule,
    archivePost,

    // Delete
    deletePost,
    deleteByKey,
    deleteBySource,
    cleanupStaleDrafts,

    // Media
    uploadPhoto,
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Map database row to LoadedPost type
 */
function mapRowToPost(row: any): LoadedPost {
  return {
    id:                    row.id,
    status:                row.status ?? 'draft',
    businessId:            row.business_id,
    userId:                row.user_id,
    platform:              row.platform,
    platforms:             row.platforms ?? [],
    postText:              row.post_text,
    photoUrl:              row.photo_url,
    contentJson:           row.content_json,
    photoIdea:             row.photo_idea,
    captionData:           row.caption_data,
    mediaMetadata:         row.media_metadata,
    ideaSource:            row.idea_source,
    suggestionId:          row.suggestion_id,
    weeklyPlanSlotDate:    row.weekly_plan_slot_date,
    weeklyPlanId:          row.weekly_plan_id,
    weeklyPlanIdeaId:      row.weekly_plan_idea_id,
    contentType:           row.content_type,
    menuItemName:          row.menu_item_name,
    menuItemId:            row.menu_item_id,
    suggestedPostDatetime: row.suggested_post_datetime,
    scheduledFor:          row.scheduled_for,
    postedAt:              row.posted_at,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
  }
}

// ── Standalone Helper Functions (for backwards compatibility) ─────────────────

/**
 * Save a published post (compatibility wrapper for old savePublishedPost function)
 * @deprecated Use usePosts().publishPost() instead
 */
export async function savePublishedPost(data: {
  businessId: string
  platform: string
  postText: string
  ideaSource?: 'manual' | 'quick_suggestions' | 'weekly_plan'
  suggestionId?: number | null
  photoFile?: File | null
  photoUrl?: string | null
  contentType?: string | null
  menuItemId?: string | null
  menuItemName?: string | null
  weeklyPlanId?: string | null
  weeklyPlanIdeaId?: number | null
  weeklyPlanSlotDate?: string | null
  postedAt: Date
  status?: 'published' | 'scheduled' | 'draft'
  scheduledFor?: Date | null
  suggestedPostTime?: string | null
  captionData?: unknown | null
  mediaMetadata?: Record<string, unknown> | null
}): Promise<{ id: string | null; error: string | null; photoUploadFailed: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()

  // Upload photo if provided
  let persistedPhotoUrl: string | null = null
  let photoUploadFailed = false
  if (data.photoFile) {
    persistedPhotoUrl = await uploadPostPhoto(data.businessId, data.photoFile)
    if (!persistedPhotoUrl) photoUploadFailed = true
  } else if (data.photoUrl && !data.photoUrl.startsWith('blob:')) {
    persistedPhotoUrl = data.photoUrl
  }

  // Normalize content_type
  const validContentTypes = ['product', 'experience', 'occasion', 'atmosphere', 'retention', 'team']
  let normalizedContentType: string | null = null
  if (data.contentType) {
    const lower = data.contentType.toLowerCase().trim()
    normalizedContentType = validContentTypes.includes(lower) ? lower : null
  }

  const row = {
    business_id:           data.businessId,
    user_id:               user?.id ?? null,
    platform:              data.platform.toLowerCase(),
    post_text:             data.postText || null,
    photo_url:             persistedPhotoUrl,
    media_metadata:        data.mediaMetadata ?? (persistedPhotoUrl ? { thumbnail_url: persistedPhotoUrl } : null),
    source:                'manual_copy_paste' as const,
    content_type:          normalizedContentType,
    menu_item_id:          data.menuItemId ?? null,
    menu_item_name:        data.menuItemName ?? null,
    weekly_plan_id:        data.weeklyPlanId ?? null,
    weekly_plan_idea_id:   data.weeklyPlanIdeaId ?? null,
    weekly_plan_slot_date: data.weeklyPlanSlotDate ?? null,
    posted_at:             data.postedAt.toISOString(),
    published_at:          data.postedAt.toISOString(),
    status:                data.status ?? 'published',
    scheduled_for:         data.scheduledFor ? data.scheduledFor.toISOString() : null,
    suggested_time:        data.suggestedPostTime ?? null,
    idea_source:           data.ideaSource ?? 'manual',
    suggestion_id:         data.suggestionId ?? null,
    caption_data:          (data.captionData ?? null) as any,
  }

  const { data: inserted, error } = await supabase.from('posts').insert(row as any).select('id').single()
  if (error) {
    console.error('[savePublishedPost] Insert failed:', error.message, error)
  }
  return { id: inserted?.id ?? null, error: error?.message ?? null, photoUploadFailed }
}

/**
 * Delete a published post (compatibility wrapper)
 * @deprecated Use usePosts().deletePost() instead
 */
export async function deletePublishedPost(id: string): Promise<{ error: string | null; deleted: boolean }> {
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .select()

  if (error) {
    console.error('[deletePublishedPost] Delete failed:', error.message)
    return { error: error.message, deleted: false }
  }

  const deletedCount = data?.length ?? 0
  return { error: null, deleted: deletedCount > 0 }
}

/**
 * Update a published post (compatibility wrapper)
 * @deprecated Use usePosts().updateSchedule() instead
 */
export async function updatePublishedPost(
  id: string,
  fields: { postedAt: Date; status: 'published' | 'scheduled' | 'draft'; scheduledFor: Date | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('posts')
    .update({
      posted_at:     fields.postedAt.toISOString(),
      published_at:  fields.postedAt.toISOString(),
      status:        fields.status,
      scheduled_for: fields.scheduledFor ? fields.scheduledFor.toISOString() : null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[updatePublishedPost] Update failed:', error.message)
  }
  return { error: error?.message ?? null }
}
