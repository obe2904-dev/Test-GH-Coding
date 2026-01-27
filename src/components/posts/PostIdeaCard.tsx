import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformBadge } from './PlatformBadge';
import { VisualSuggestionBadge } from './VisualSuggestionBadge';

interface PostIdeaCardProps {
  post: {
    id: string;
    caption: string;
    hashtags: string[];
    platform: 'instagram' | 'facebook' | 'both';
    suggested_post_time: string;
    content_type: string;
    visual_suggestions: any;
    goal_description: string | null;
    status: string;
  };
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PostIdeaCard({ post, onApprove, onReject, onDelete }: PostIdeaCardProps) {
  const { t } = useTranslation('posts');
  const [showVisualTips, setShowVisualTips] = useState(false);

  const handleApprove = async () => {
    await onApprove(post.id);
  };

  const handleReject = async () => {
    await onReject(post.id);
  };

  const handleDelete = async () => {
    if (confirm('Er du sikker på at du vil slette denne post-idé?')) {
      await onDelete(post.id);
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-300',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-300',
    posted: 'bg-purple-50 text-purple-700 border-purple-300',
    rejected: 'bg-red-50 text-red-700 border-red-300',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-200 transition-colors">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformBadge platform={post.platform as any} />
            <span 
              className={`px-2 py-1 rounded border text-xs font-medium ${
                statusColors[post.status as keyof typeof statusColors]
              }`}
            >
              {t(`posts.status.${post.status}`)}
            </span>
          </div>
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-600 text-sm transition-colors"
            title="Slet"
          >
            🗑️
          </button>
        </div>

        {/* Goal alignment */}
        {post.goal_description && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="text-xs font-medium text-blue-600 mb-1">
              {t('posts.goalAligned')}
            </div>
            <div className="text-sm text-blue-900">{post.goal_description}</div>
          </div>
        )}

        {/* Caption */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">
            {t('posts.caption')}
          </div>
          <p className="text-sm text-gray-900 leading-relaxed">{post.caption}</p>
        </div>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 mb-2">
              {t('posts.hashtags')}
            </div>
            <div className="flex flex-wrap gap-2">
              {post.hashtags.map((tag, i) => (
                <span 
                  key={i} 
                  className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested post time */}
        {post.suggested_post_time && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 mb-1">
              {t('posts.postTime')}
            </div>
            <div className="text-sm text-gray-600">
              {new Date(post.suggested_post_time).toLocaleString('da-DK', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        )}

        {/* Visual suggestions toggle */}
        {post.visual_suggestions && (
          <div className="mb-4">
            <button
              onClick={() => setShowVisualTips(!showVisualTips)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              {showVisualTips ? '▼' : '▶'} {t('posts.visualTips')}
            </button>
            {showVisualTips && (
              <div className="mt-3">
                <VisualSuggestionBadge suggestions={post.visual_suggestions} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {post.status === 'draft' && (
        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleApprove}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            ✓ {t('posts.actions.approve')}
          </button>
          <button
            onClick={handleReject}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            ✕ {t('posts.actions.reject')}
          </button>
        </div>
      )}

      {post.status === 'approved' && (
        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
            📅 {t('posts.actions.schedule')}
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors text-sm">
            🚀 {t('posts.actions.post')}
          </button>
        </div>
      )}
    </div>
  );
}
