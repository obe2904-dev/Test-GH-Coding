import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { PostSpecification } from '../../types/weekly-plan'

// Icon components
const LightBulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

// Format ISO date "YYYY-MM-DD" as Danish "D. måned YYYY"
function formatDanishDate(dateStr: string): string {
  const months = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december']
  const m = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return dateStr
  const [, y, mo, d] = m
  return `${parseInt(d)}. ${months[parseInt(mo) - 1]} ${y}`
}

interface PostDetailModalProps {
  post: PostSpecification
  onClose: () => void
  onUpdate: (updatedPost: PostSpecification) => void
  planId?: string
}

export function PostDetailModal({ post, onClose, onUpdate: _onUpdate, planId: _planId }: PostDetailModalProps) {
  const { t } = useTranslation()
  const [correctedRationale, setCorrectedRationale] = useState<string | null>(null)

  useEffect(() => {
    const raw = post.selectionRationale
    if (!raw) return
    let cancelled = false
    fetch(import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ text: raw, language: 'da' }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.corrected) setCorrectedRationale(data.corrected)
      })
      .catch(() => { /* silent — fall back to raw text */ })
    return () => { cancelled = true }
  }, [post.selectionRationale])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('weeklyPlan.detail.title')}</h2>
            <p className="text-sm text-slate-600">
              {post.timing.day}, {formatDanishDate(post.timing.date)} {t('weeklyPlan.detail.timeAt')} {post.timing.time}
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
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-3">
                <LightBulbIcon className="w-5 h-5 text-[#0A7D5F]" />
                {t('weeklyPlan.detail.whyPost')}
              </h3>
              <div className="bg-cta-surface border border-cta-surface rounded-lg p-4">
                <p className="text-sm text-brand">{correctedRationale ?? post.selectionRationale}</p>
              </div>
            </section>
          )}

          {/* Strategic Slot */}
          {(post.strategicContext?.strategic_intent || post.strategicContext?.slot_id) && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-3">
                🎯 {t('weeklyPlan.detail.strategicSlot', 'Strategic Slot')}
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {post.strategicContext.slot_id && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      Slot {post.strategicContext.slot_id}
                    </span>
                  )}
                  {post.strategicContext.goal_mode && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                      {post.strategicContext.goal_mode === 'drive_footfall' ? '💰 Drive Footfall' :
                       post.strategicContext.goal_mode === 'build_brand' ? '🎨 Build Brand' :
                       '🤝 Retain Loyalty'}
                    </span>
                  )}
                </div>
                {post.strategicContext.strategic_intent && (
                  <p className="text-sm text-blue-900 leading-relaxed">
                    {post.strategicContext.strategic_intent}
                  </p>
                )}
                {post.strategicContext.slot_reasoning && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-xs font-semibold text-blue-700 mb-1">Hvorfor denne slot?</div>
                    <p className="text-sm text-blue-800 leading-relaxed italic">
                      {post.strategicContext.slot_reasoning}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Drink pairing */}
          {post.strategicContext?.drink_pairing && (
            <section>
              <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
                <span className="text-base">🍸</span>
                <div>
                  <div className="text-xs font-medium text-purple-600">{t('weeklyPlan.detail.drinkPairing', 'Drink-pairing')}</div>
                  <div className="text-sm font-semibold text-purple-900">{post.strategicContext.drink_pairing}</div>
                </div>
              </div>
            </section>
          )}

          {/* Photo suggestion */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-3">
              <CameraIcon className="w-5 h-5 text-[#0A7D5F]" />
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
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-3">
              <CalendarIcon className="w-5 h-5 text-[#0A7D5F]" />
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
                  <div className="text-sm font-semibold text-slate-900">{formatDanishDate(post.timing.date)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600">{t('weeklyPlan.detail.time')}</div>
                  <div className="text-sm font-semibold text-slate-900">{post.timing.time}</div>
                </div>
              </div>
              {post.timing.timingRationale && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">🧠</span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-purple-900 mb-1">AI Timing Intelligence</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{post.timing.timingRationale}</p>
                    </div>
                  </div>
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
