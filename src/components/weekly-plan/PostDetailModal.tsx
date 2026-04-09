import { useTranslation } from 'react-i18next'
import type { PostSpecification } from '../../types/weekly-plan'

interface PostDetailModalProps {
  post: PostSpecification
  onClose: () => void
  onUpdate: (updatedPost: PostSpecification) => void
  planId?: string
}

export function PostDetailModal({ post, onClose, onUpdate: _onUpdate, planId: _planId }: PostDetailModalProps) {
  const { t } = useTranslation()
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
