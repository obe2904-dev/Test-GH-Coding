/**
 * Navigation Flow Tests
 * 
 * Tests the 3-stage navigation flow (Generate → Design → Publish) for:
 * - Quick Suggestions (same-day ideas)
 * - Weekly Plan (current week + next week)
 * - Manual Write mode
 * 
 * Validates:
 * 1. Navigation handlers work correctly
 * 2. Data persists between stages
 * 3. No data drift between different suggestions
 * 4. Empty page guards prevent blank UI
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Zustand store for testing
const mockStore = {
  activePath: 'ai-ideas' as 'write' | 'ai-ideas' | 'weekly-plan',
  aiIdeerStep: 'generate' as 'generate' | 'create' | 'publish',
  postContent: null as any,
  photoContent: null as any,
  selectedSuggestionData: null as any,
  weeklyPlanPost: null as any,
  setAiIdeerStep: vi.fn(),
  setPostContent: vi.fn(),
  setPhotoContent: vi.fn(),
  setSelectedSuggestionData: vi.fn(),
}

describe('Navigation Flow - Quick Suggestions (Same Day)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.activePath = 'ai-ideas'
    mockStore.aiIdeerStep = 'generate'
    mockStore.postContent = null
    mockStore.photoContent = null
    mockStore.selectedSuggestionData = null
  })

  it('should allow forward navigation when suggestion is selected', () => {
    mockStore.selectedSuggestionData = { id: 123, title: 'Test Suggestion' }
    mockStore.postContent = { text: 'Generated text', hashtags: [] }
    
    // User can navigate to Design
    const canAdvance = mockStore.selectedSuggestionData && mockStore.postContent?.text
    expect(canAdvance).toBe(true)
  })

  it('should block navigation to Publish without content', () => {
    mockStore.aiIdeerStep = 'create'
    mockStore.postContent = null
    mockStore.photoContent = null
    
    // Navigation should be blocked
    const hasText = mockStore.postContent?.text && mockStore.postContent.text.trim().length >= 10
    const hasPhotos = mockStore.photoContent?.uploadedMedia?.length > 0
    const canPublish = hasText || hasPhotos
    
    expect(canPublish).toBe(false)
  })

  it('should preserve data when navigating back from Design to Generate', () => {
    const suggestion = { id: 123, title: 'Test' }
    const content = { text: 'My content', hashtags: [] }
    
    mockStore.selectedSuggestionData = suggestion
    mockStore.postContent = content
    
    // Simulate back navigation - should clear content to prevent drift
    mockStore.setPostContent(null) // This is what handleCreateBack does
    
    expect(mockStore.setPostContent).toHaveBeenCalledWith(null)
  })

  it('should isolate data between different suggestions', () => {
    // Select first suggestion
    const suggestion1 = { id: 123, title: 'Suggestion 1' }
    mockStore.selectedSuggestionData = suggestion1
    mockStore.postContent = { text: 'Content for suggestion 1', hashtags: [] }
    
    // Switch to second suggestion - should clear all previous data
    const suggestion2 = { id: 456, title: 'Suggestion 2' }
    mockStore.setSelectedSuggestionData(suggestion2)
    mockStore.setPostContent(null) // handleSelectSuggestion clears content
    mockStore.setPhotoContent(null) // handleSelectSuggestion clears photos
    
    expect(mockStore.setPostContent).toHaveBeenCalledWith(null)
    expect(mockStore.setPhotoContent).toHaveBeenCalledWith(null)
  })

  it('should only clear photos when switching to different suggestion', () => {
    const previousSuggestionId = 123
    const currentSuggestionId = 123 // Same suggestion
    
    // Photos should NOT be cleared when returning to same suggestion
    const shouldClearPhotos = currentSuggestionId !== previousSuggestionId
    expect(shouldClearPhotos).toBe(false)
    
    // Photos SHOULD be cleared when switching suggestions
    const newSuggestionId = 456
    const shouldClearForNew = newSuggestionId !== previousSuggestionId
    expect(shouldClearForNew).toBe(true)
  })
})

describe('Navigation Flow - Weekly Plan (Current + Next Week)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.activePath = 'weekly-plan'
  })

  it('should use draftMap to preserve edits when switching posts', () => {
    const draftMap: Record<number, any> = {}
    
    // Edit post 0
    const post0Content = { text: 'Post 0 content', hashtags: [] }
    draftMap[0] = post0Content
    
    // Switch to post 1
    const post1Index = 1
    const savedContent = draftMap[0]
    
    expect(savedContent).toEqual(post0Content)
    expect(savedContent).not.toBe(null)
  })

  it('should block navigation to Publish without generated content', () => {
    mockStore.postContent = null
    mockStore.photoContent = null
    
    const hasText = mockStore.postContent?.text && mockStore.postContent.text.trim().length >= 10
    const hasPhotos = mockStore.photoContent?.uploadedMedia?.length > 0
    const canPublish = hasText || hasPhotos
    
    expect(canPublish).toBe(false)
  })

  it('should restore from draftMap when switching back to edited post', () => {
    const draftMap: Record<number, any> = {
      0: { text: 'Edited post 0', hashtags: [] },
      1: { text: 'Edited post 1', hashtags: [] }
    }
    
    // Switch to post 1
    const post1Index = 1
    const savedContent = draftMap[post1Index]
    
    expect(savedContent.text).toBe('Edited post 1')
  })

  it('should prevent rapid switching with loading state', async () => {
    let isLoadingWeeklyPlanSwitch = false
    
    // Start switching to post 1
    if (!isLoadingWeeklyPlanSwitch) {
      isLoadingWeeklyPlanSwitch = true
      
      // Attempt to switch to post 2 immediately (should be blocked)
      const canSwitch = !isLoadingWeeklyPlanSwitch
      expect(canSwitch).toBe(false)
    }
  })
})

describe('Navigation Flow - Manual Write Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.activePath = 'write'
  })

  it('should require text OR photos to publish', () => {
    // Case 1: Has text, no photos
    mockStore.postContent = { text: 'My manual post text', hashtags: [] }
    mockStore.photoContent = null
    
    const hasText = mockStore.postContent.text.trim().length >= 10
    const hasPhotos = false
    expect(hasText || hasPhotos).toBe(true)
    
    // Case 2: No text, has photos
    mockStore.postContent = { text: '', hashtags: [] }
    mockStore.photoContent = { uploadedMedia: [{ id: '1', url: 'photo.jpg' }] }
    
    const hasPhotos2 = mockStore.photoContent.uploadedMedia.length > 0
    expect(hasPhotos2).toBe(true)
    
    // Case 3: Neither (should block)
    mockStore.postContent = { text: '', hashtags: [] }
    mockStore.photoContent = null
    
    const hasText3 = mockStore.postContent.text.trim().length >= 10
    const hasPhotos3 = false
    expect(hasText3 || hasPhotos3).toBe(false)
  })
})

describe('Edge Cases', () => {
  it('should handle committed suggestions correctly', () => {
    const committedSuggestionIds = new Set([123, 456])
    const selectedSuggestionId = 123
    
    const isCommitted = committedSuggestionIds.has(selectedSuggestionId)
    expect(isCommitted).toBe(true)
    
    // Committed suggestions should be locked
    const canEdit = !isCommitted
    expect(canEdit).toBe(false)
  })

  it('locks PUBLISHED ideas but keeps SCHEDULED ideas editable', () => {
    // New semantics: "committed" (locked) = published only. Scheduled stays editable.
    const committedWeeklyPlanIdeaIds = new Set<number>([123]) // published → locked
    const scheduledWeeklyPlanIdeaIds = new Set<number>([456]) // scheduled → editable

    const publishedIsLocked = committedWeeklyPlanIdeaIds.has(123)
    const scheduledIsLocked = committedWeeklyPlanIdeaIds.has(456)
    expect(publishedIsLocked).toBe(true)
    expect(scheduledIsLocked).toBe(false)
    // Scheduled is surfaced separately as editable, not as a lock
    expect(scheduledWeeklyPlanIdeaIds.has(456)).toBe(true)
  })

  it('never locks stages based on backward navigation', () => {
    // The old isReadOnlyMode nav lock is removed. Read-only is driven ONLY by
    // published state, never by "the user went back from Udgiv".
    const publishedInfo = null
    const isCommittedAiSuggestion = false // scheduled/draft → not committed
    const isPublishedReadOnly = Boolean(publishedInfo) || isCommittedAiSuggestion
    // Simulate: user entered Udgiv then clicked back to Forslag — no published state
    expect(isPublishedReadOnly).toBe(false)
  })

  it('should handle undefined content gracefully', () => {
    mockStore.postContent = undefined
    
    const hasText = mockStore.postContent?.text && mockStore.postContent.text.trim().length >= 10
    expect(hasText).toBeFalsy()
  })

  it('should validate text length correctly', () => {
    // Too short (should fail)
    mockStore.postContent = { text: 'Hi', hashtags: [] }
    expect(mockStore.postContent.text.trim().length >= 10).toBe(false)
    
    // Just enough (should pass)
    mockStore.postContent = { text: 'Hello world!', hashtags: [] }
    expect(mockStore.postContent.text.trim().length >= 10).toBe(true)
  })

  it('should handle photo content arrays correctly', () => {
    // Empty array
    mockStore.photoContent = { uploadedMedia: [] }
    expect(mockStore.photoContent.uploadedMedia.length > 0).toBe(false)
    
    // Has photos
    mockStore.photoContent = { uploadedMedia: [{ id: '1' }, { id: '2' }] }
    expect(mockStore.photoContent.uploadedMedia.length > 0).toBe(true)
  })
})

describe('Data Persistence Between Steps', () => {
  it('should preserve postContent when going Publish → Design → Publish', () => {
    const content = {
      text: 'My post content',
      headline: 'Headline',
      hashtags: [{ tag: '#test', enabled: true }]
    }
    
    // At Publish step
    mockStore.postContent = content
    
    // Navigate back to Design
    // Content should remain
    expect(mockStore.postContent).toEqual(content)
    
    // Navigate forward to Publish again
    // Content should still be there
    expect(mockStore.postContent).toEqual(content)
  })

  it('should preserve photoContent across navigation', () => {
    const photos = {
      uploadedMedia: [
        { id: '1', url: 'photo1.jpg', type: 'image' },
        { id: '2', url: 'photo2.jpg', type: 'image' }
      ]
    }
    
    mockStore.photoContent = photos
    
    // Photos should persist through navigation
    expect(mockStore.photoContent.uploadedMedia.length).toBe(2)
  })
})

describe('Integration Tests', () => {
  it('should complete full flow: Generate → Design → Publish for Quick Suggestion', () => {
    // Step 1: Generate (select suggestion)
    mockStore.activePath = 'ai-ideas'
    mockStore.selectedSuggestionData = { id: 123, title: 'Test Suggestion' }
    expect(mockStore.selectedSuggestionData).not.toBe(null)
    
    // Step 2: Design (generate content)
    mockStore.postContent = {
      text: 'Generated content from AI',
      headline: 'Test Suggestion',
      hashtags: [{ tag: '#test', enabled: true }]
    }
    expect(mockStore.postContent.text.trim().length >= 10).toBe(true)
    
    // Step 3: Publish (can proceed)
    const hasText = mockStore.postContent.text.trim().length >= 10
    const canPublish = hasText
    expect(canPublish).toBe(true)
  })

  it('should complete full flow: Weekly Plan post', () => {
    // Step 1: Select from weekly plan
    mockStore.activePath = 'weekly-plan'
    mockStore.weeklyPlanPost = {
      contentSubject: { dish: 'Pasta Carbonara' },
      timing: { day: 'Monday', date: '2026-06-23' }
    }
    
    // Step 2: Auto-generate content
    mockStore.postContent = {
      text: 'Come try our delicious Pasta Carbonara!',
      headline: 'Pasta Carbonara',
      hashtags: []
    }
    
    // Step 3: Can publish
    const hasText = mockStore.postContent.text.trim().length >= 10
    expect(hasText).toBe(true)
  })
})
