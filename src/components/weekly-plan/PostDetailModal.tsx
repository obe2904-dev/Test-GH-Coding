import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { PostSpecification } from '../../types/weekly-plan'

interface PostDetailModalProps {
  post: PostSpecification
  onClose: () => void
  onUpdate: (updatedPost: PostSpecification) => void
  planId?: string
}

export function PostDetailModal({ post, onClose, onUpdate, planId }: PostDetailModalProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const [isEditing, setIsEditing] = useState(false)
  const [editedCaption, setEditedCaption] = useState(post.caption.text)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Check if post is in the past
  const postDateTime = new Date(`${post.timing.date}T${post.timing.time}`)
  const now = new Date()
  const isPast = postDateTime < now
  
  const handleRescheduleToNextWeek = () => {
    const currentDate = new Date(post.timing.date)
    const nextWeekDate = new Date(currentDate)
    nextWeekDate.setDate(currentDate.getDate() + 7)
    
    const updatedPost: PostSpecification = {
      ...post,
      timing: {
        ...post.timing,
        date: nextWeekDate.toISOString().split('T')[0],
      },
    }
    
    onUpdate(updatedPost)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setUploadError(null)

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(fileName)

      // Update post with uploaded file
      const updatedPost: PostSpecification = {
        ...post,
        media: {
          ...post.media,
          status: 'uploaded',
          uploadedFiles: [
            ...post.media.uploadedFiles,
            {
              url: publicUrl,
              uploadedAt: new Date().toISOString(),
              uploadedBy: user.id,
            },
          ],
          selectedFile: publicUrl,
        },
      }

      onUpdate(updatedPost)
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(t('weeklyPlan.detail.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const handleSaveCaption = () => {
    const updatedPost: PostSpecification = {
      ...post,
      caption: {
        ...post.caption,
        text: editedCaption,
        characterCount: editedCaption.length,
      },
      approval: {
        ...post.approval,
        editHistory: [
          ...post.approval.editHistory,
          {
            field: 'caption',
            oldValue: post.caption.text,
            newValue: editedCaption,
            editedAt: new Date().toISOString(),
            editedBy: user?.id || 'unknown',
          },
        ],
      },
    }

    onUpdate(updatedPost)
    setIsEditing(false)
  }

  const handleApprove = () => {
    const updatedPost: PostSpecification = {
      ...post,
      approval: {
        ...post.approval,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.id,
      },
    }

    onUpdate(updatedPost)
  }

  const handleRegenerateCaption = async () => {
    if (!user) return

    setRegenerating(true)
    setRegenerateError(null)

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // TODO: Fetch business_id from planId or post metadata
      // For now, fetch from user's businesses
      const { data: business } = await supabase
        .from('businesses')
        .select('id, name, category, location')
        .eq('owner_id', user.id)
        .single()

      if (!business) {
        throw new Error('Business not found')
      }

      // Call regenerate-caption Edge Function
      // Brand profile is fetched server-side with full V2 fields
      const functionUrl = `${supabase.supabaseUrl}/functions/v1/regenerate-caption`
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post: {
            contentType: post.postType.type,
            subject: post.contentSubject.dish,
            category: post.postType.category,
            platform: post.platformFormat.platform,
            format: post.platformFormat.format,
            timing: {
              day: post.timing.day,
              time: post.timing.time,
            },
          },
          businessId: business.id,
          businessName: business.name,
          businessCategory: business.category,
          businessLocation: business.location,
          // Pass strategic context to preserve intent on regeneration
          strategicContext: post.caption?.ctaType ? {
            cta_intent: post.caption.ctaType,
            post_rationale: post.selectionRationale || post.contentSubject.whyThisDish?.[0] || '',
          } : undefined,
          temperature: 0.8, // Higher temperature for more variety
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Regeneration failed: ${errorText}`)
      }

      const data = await response.json()

      if (data?.success && data?.caption) {
        const updatedPost: PostSpecification = {
          ...post,
          caption: {
            ...post.caption,
            text: data.caption.caption,
            characterCount: data.caption.caption.length,
            hashtags: data.caption.hashtags,
            isAIGenerated: true,
            aiMetadata: {
              model: data.metadata?.model || 'gpt-4o',
              generationTime: data.metadata?.generationTime,
              tone: data.caption.tone,
              qualityScore: data.metadata?.qualityScore,
            },
          },
          approval: {
            ...post.approval,
            editHistory: [
              ...post.approval.editHistory,
              {
                field: 'caption',
                oldValue: post.caption.text,
                newValue: data.caption.caption,
                editedAt: new Date().toISOString(),
                editedBy: user.id,
                editType: 'ai_regeneration',
              },
            ],
          },
        }

        onUpdate(updatedPost)
        setEditedCaption(data.caption.caption)
      } else {
        throw new Error('Invalid response from regeneration')
      }
    } catch (err) {
      console.error('Regeneration error:', err)
      setRegenerateError(err instanceof Error ? err.message : t('weeklyPlan.detail.regenerateError'))
    } finally {
      setRegenerating(false)
    }
  }

  const exportPhotographerBrief = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('export-photographer-brief', {
        body: {
          postSpecification: post,
          planId,
        },
      })

      if (error) throw error

      if (data?.pdfUrl) {
        window.open(data.pdfUrl, '_blank')
      }
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('weeklyPlan.detail.title')}</h2>
            <p className="text-sm text-slate-600">
              {post.timing.day}, {post.timing.date} {t('weeklyPlan.detail.timeAt')} {post.timing.time}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Why this post */}
          {post.selectionRationale && (
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                {t('weeklyPlan.detail.whyPost')}
              </h3>
              <div className="bg-cta-surface border border-cta-surface rounded-lg p-4">
                <p className="text-sm text-brand">{post.selectionRationale}</p>
              </div>
            </section>
          )}

          {/* Photo suggestion */}
          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('weeklyPlan.detail.visualDirection')}
            </h3>
            <div className="bg-gray-50 rounded-md px-3 py-2 space-y-1.5">
              {(post.visualDirection.subject.includes(' | ')
                ? post.visualDirection.subject.split(' | ')
                : post.visualDirection.subject.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/)
              ).filter((s: string) => s.trim().length > 0)
                .map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-brand shrink-0 mt-0.5 w-4">{i + 1}.</span>
                    <p className="text-sm text-gray-700 leading-snug">{step.trim()}</p>
                  </div>
                ))
              }
            </div>
          </section>

          {/* Suggested timing */}
          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('weeklyPlan.detail.timingSection')}
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-medium text-slate-600">{t('weeklyPlan.detail.day')}</div>
                  <div className="text-sm font-semibold text-slate-900">{post.timing.day}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600">{t('weeklyPlan.detail.date')}</div>
                  <div className="text-sm font-semibold text-slate-900">{post.timing.date}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600">{t('weeklyPlan.detail.time')}</div>
                  <div className="text-sm font-semibold text-slate-900">{post.timing.time}</div>
                </div>
              </div>
              {post.timing.rationale && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-medium text-slate-600">{t('weeklyPlan.detail.rationale')}</div>
                  <div className="text-sm text-slate-700">{post.timing.rationale}</div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {t('weeklyPlan.detail.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
