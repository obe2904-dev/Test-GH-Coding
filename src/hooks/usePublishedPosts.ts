import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { uploadPostPhoto } from '../lib/postMedia'
import type { FuturePost, RecentPost } from '../components/post-creation/publish/ScheduleTimeline'

export interface SavePublishedPostData {
  businessId: string
  platform: string
  postText: string
  /** Which creation path produced the post snapshot */
  ideaSource?: 'manual' | 'quick_suggestions' | 'weekly_plan'
  /** Original quick-suggestion ID, when applicable */
  suggestionId?: number | null
  /** Raw File object from the photo upload — uploaded to Supabase Storage for a persistent URL */
  photoFile?: File | null
  /** Fallback: already-persistent URL (not blob:). Ignored if photoFile is provided. */
  photoUrl?: string | null
  contentType?: string | null
  menuItemId?: string | null
  menuItemName?: string | null
  weeklyPlanId?: string | null
  /** Stable per-idea identifier from the weekly plan payload */
  weeklyPlanIdeaId?: number | null
  weeklyPlanSlotDate?: string | null
  postedAt: Date
  /** 'published' for immediate posts, 'scheduled' for future posts */
  status?: 'published' | 'scheduled' | 'draft'
  /** Full datetime when a scheduled post should go out (includes hour + minute) */
  scheduledFor?: Date | null
  /** AI-recommended posting time from Quick Suggestions (e.g., '17:00') */
  suggestedPostTime?: string | null
  /** Structured caption snapshot carried forward from the draft/editor state */
  captionData?: unknown | null
  /** Optional richer media metadata snapshot */
  mediaMetadata?: Record<string, unknown> | null
}

/**
 * Saves a manually-confirmed post to published_posts.
 * Sets both posted_at (user-selected) and published_at (same value, for
 * backwards compatibility with the 14-day recency filter in opportunity-selector.ts).
 */
export async function savePublishedPost(
  data: SavePublishedPostData,
): Promise<{ id: string | null; error: string | null; photoUploadFailed: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()

  // Upload the raw file to get a persistent URL; fall back to a pre-existing URL if no file provided.
  let persistedPhotoUrl: string | null = null
  let photoUploadFailed = false
  if (data.photoFile) {
    persistedPhotoUrl = await uploadPostPhoto(data.businessId, data.photoFile)
    if (!persistedPhotoUrl) photoUploadFailed = true
  } else if (data.photoUrl && !data.photoUrl.startsWith('blob:')) {
    persistedPhotoUrl = data.photoUrl
  }

  // Normalize and validate content_type
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
    caption_data:          data.captionData ?? null,
  }

  const { data: inserted, error } = await supabase.from('posts').insert(row).select('id').single()
  if (error) {
    console.error('[savePublishedPost] Supabase insert failed:', error.message, error)
  }
  return { id: inserted?.id ?? null, error: error?.message ?? null, photoUploadFailed }
}

/**
 * Deletes a published_posts row by ID (e.g. cancelling a scheduled post).
 * RLS policies should handle authorization - we just need the ID.
 */
export async function deletePublishedPost(id: string, businessId?: string): Promise<{ error: string | null; deleted: boolean }> {
  console.log('[deletePublishedPost] Starting delete:', { id, businessId })
  
  // Simple delete by ID - let RLS handle authorization
  const result = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .select()
  
  console.log('[deletePublishedPost] Delete result:', { 
    error: result.error, 
    deletedCount: result.data?.length ?? 0,
    data: result.data 
  })
  
  if (result.error) {
    console.error('[deletePublishedPost] Supabase delete failed:', result.error.message, result.error)
    return { error: result.error.message, deleted: false }
  }
  
  // Check if any rows were actually deleted
  const deletedCount = result.data?.length ?? 0
  if (deletedCount === 0) {
    console.warn('[deletePublishedPost] ⚠️ Delete succeeded but no rows affected - checking if post exists...')
    
    // Verify the post actually exists
    const { data: checkData, error: checkError } = await supabase
      .from('posts')
      .select('id, business_id, status')
      .eq('id', id)
      .single()
    
    if (checkError || !checkData) {
      console.error('[deletePublishedPost] Post not found in database:', id)
      return { error: 'Post not found', deleted: false }
    }
    
    console.error('[deletePublishedPost] Post exists but could not be deleted. RLS policy issue?', {
      postId: id,
      postBusinessId: checkData.business_id,
      requestedBusinessId: businessId,
      status: checkData.status
    })
    
    return { error: 'Permission denied - RLS policy blocking delete', deleted: false }
  }
  
  console.log(`[deletePublishedPost] ✅ Successfully deleted ${deletedCount} post(s)`)
  return { error: null, deleted: true }
}

/**
 * Updates an existing published_posts row (e.g. re-scheduling with a new time).
 * Only updates time-sensitive fields — does not re-upload photos.
 */
export async function updatePublishedPost(
  id: string,
  fields: { postedAt: Date; status: 'published' | 'scheduled' | 'draft'; scheduledFor: Date | null },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('posts')
    .update({
      posted_at:     fields.postedAt.toISOString(),
      published_at:  fields.postedAt.toISOString(),
      status:        fields.status,
      scheduled_for: fields.scheduledFor ? fields.scheduledFor.toISOString() : null,
    })
    .eq('id', id)
  if (error) {
    console.error('[updatePublishedPost] Supabase update failed:', error.message, error)
  }
  return { error: error?.message ?? null }
}

export interface ScheduledPostDetails {
  id: string
  businessId: string
  platform: string
  postText: string
  photoUrl?: string
  contentType?: string
  menuItemName?: string
  scheduledFor: Date
  suggestedPostTime?: string
}

/**
 * Fetches full details of a scheduled post by ID (for preview/edit modal).
 */
export async function getScheduledPostById(id: string): Promise<{ data: ScheduledPostDetails | null; error: string | null }> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, business_id, platform, post_text, photo_url, content_type, menu_item_name, scheduled_for, suggested_time')
    .eq('id', id)
    .eq('status', 'scheduled')
    .single()

  if (error) {
    console.error('[getScheduledPostById] Supabase select failed:', error.message, error)
    return { data: null, error: error.message }
  }

  if (!data || !data.scheduled_for) {
    return { data: null, error: 'Post not found or not scheduled' }
  }

  return {
    data: {
      id: data.id,
      businessId: data.business_id,
      platform: data.platform,
      postText: data.post_text || '',
      photoUrl: data.photo_url || undefined,
      contentType: data.content_type || undefined,
      menuItemName: data.menu_item_name || undefined,
      scheduledFor: new Date(data.scheduled_for),
      suggestedPostTime: data.suggested_time || undefined,
    },
    error: null,
  }
}

/**
 * Fetches the most recent published posts for the given business and maps
 * them to the RecentPost shape used by ScheduleTimeline.
 */
export function usePublishedPostsTimeline(businessId: string | null) {
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [futurePosts, setFuturePosts] = useState<FuturePost[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    console.log('[usePublishedPostsTimeline] Loading timeline for business:', businessId)
    setIsLoading(true)

    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const { data, error } = await supabase
      .from('posts')
      .select('id, platform, post_text, menu_item_name, content_type, posted_at, photo_url, media_metadata, status, scheduled_for')
      .eq('business_id', businessId)
      .in('status', ['published', 'scheduled'])
      .or(`posted_at.gte.${cutoff.toISOString()},scheduled_for.gte.${now.toISOString()}`)
      .order('posted_at', { ascending: false })
      .limit(20)

    if (error || !data) {
      if (error) console.error('[usePublishedPostsTimeline] Supabase select failed:', error.message, error)
      setIsLoading(false)
      return
    }

    console.log('[usePublishedPostsTimeline] Loaded', data.length, 'posts from database')

    const recent: RecentPost[] = []
    const future: FuturePost[] = []

    for (const row of data) {
      const thumbnailUrl =
        (row.photo_url && !row.photo_url.startsWith('blob:')) ? row.photo_url :
        (row.media_metadata as any)?.thumbnail_url ||
        (row.media_metadata as any)?.photo_url ||
        (row.media_metadata as any)?.uploaded_photo_url ||
        undefined

      const title = row.menu_item_name
        ?? (row.content_type ? capitalizeFirst(row.content_type.replace(/_/g, ' ')) : null)
        ?? (row.post_text ? row.post_text.slice(0, 50) : null)
        ?? capitalizeFirst(row.platform)

      if (row.status === 'scheduled' && row.scheduled_for) {
        const date = new Date(row.scheduled_for)
        const diffMs = date.getTime() - now.getTime()
        const diffHours = Math.round(diffMs / (1000 * 60 * 60))
        const timeUntil = diffHours < 24
          ? `om ${diffHours} time${diffHours !== 1 ? 'r' : ''}`
          : `om ${Math.round(diffHours / 24)} dag${Math.round(diffHours / 24) !== 1 ? 'e' : ''}`

        future.push({
          id: row.id,
          date,
          title,
          platform: capitalizeFirst(row.platform),
          time: date.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
            + ' ' + date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
          snippet: row.post_text ? row.post_text.slice(0, 80) : undefined,
          timeUntil,
          thumbnail: thumbnailUrl,
        })
      } else {
        const date = new Date(row.posted_at)
        recent.push({
          id: row.id,
          date,
          title: title,
          platform: capitalizeFirst(row.platform),
          time: date.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
            + ' ' + date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
          snippet: row.post_text ? row.post_text.slice(0, 80) : undefined,
          engagement: { views: 0, likes: 0, comments: 0, shares: 0 },
          thumbnail: thumbnailUrl,
        })
      }
    }

    setRecentPosts(recent)
    setFuturePosts(future.sort((a, b) => a.date.getTime() - b.date.getTime()))
    setIsLoading(false)
    console.log('[usePublishedPostsTimeline] Timeline updated:', { 
      recentCount: recent.length, 
      futureCount: future.length,
      futurePostIds: future.map(p => p.id)
    })
  }, [businessId])

  useEffect(() => { load() }, [load])

  return { recentPosts, futurePosts, isLoading, refresh: load }
}

export interface PublishedPost {
  id: string
  platform: string
  postText: string | null
  photoUrl: string | null
  contentType: string | null
  menuItemName: string | null
  postedAt: Date
  source: string
  status?: 'published' | 'scheduled' | 'draft'
  scheduledFor?: Date | null
  ideaSource?: 'manual' | 'quick_suggestions' | 'weekly_plan'
  suggestionId?: number | null
  captionData?: unknown
}

/**
 * Fetches ALL published posts for the current business (up to 200),
 * used by the full CalendarPage overview.
 */
export function useAllPublishedPosts(businessId: string | null) {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)

    const { data, error } = await supabase
      .from('posts')
      .select('id, platform, post_text, photo_url, content_type, menu_item_name, posted_at, source, status, scheduled_for, idea_source, suggestion_id, caption_data')
      .eq('business_id', businessId)
      .in('status', ['published', 'scheduled'])
      .order('posted_at', { ascending: false })
      .limit(200)

    if (error || !data) {
      if (error) console.error('[useAllPublishedPosts] Supabase select failed:', error.message, error)
      setIsLoading(false)
      return
    }

    setPosts(data.map((row) => ({
      id: row.id,
      platform: capitalizeFirst(row.platform ?? ''),
      postText: row.post_text ?? null,
      photoUrl: (row.photo_url && !row.photo_url.startsWith('blob:')) ? row.photo_url : null,
      contentType: row.content_type ?? null,
      menuItemName: row.menu_item_name ?? null,
      postedAt: new Date(row.scheduled_for ?? row.posted_at ?? Date.now()),
      source: row.source ?? 'manual_copy_paste',
      status: row.status as 'published' | 'scheduled' | 'draft' | undefined,
      scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : null,
      ideaSource: row.idea_source as PublishedPost['ideaSource'] ?? undefined,
      suggestionId: row.suggestion_id as number | null | undefined,
      captionData: row.caption_data,
    })))
    setIsLoading(false)
  }, [businessId])

  useEffect(() => { load() }, [load])

  return { posts, isLoading, refresh: load }
}

/**
 * Hook to get count of scheduled posts that require manual posting
 * (i.e., scheduled posts for platforms that aren't connected)
 */
export function useManualPostingCount(
  posts: PublishedPost[],
  isConnected: (platform: string) => boolean
): number {
  return posts.filter(post => 
    post.status === 'scheduled' && 
    !isConnected(post.platform.toLowerCase())
  ).length
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
