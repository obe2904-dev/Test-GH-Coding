import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { usePostGenerator } from '@/hooks/usePostGenerator';
import { usePostIdeas } from '@/hooks/usePostIdeas';
import { PostsList } from '@/components/posts/PostsList';
import { TierBadge } from '@/components/tier/TierBadge';
import { supabase } from '@/lib/supabase';

export function PostIdeasPage() {
  const { t } = useTranslation('posts');
  const { user } = useAuthStore();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { tier, isSmart, isPro } = useSubscriptionTier();
  const { generating, error: genError, generate } = usePostGenerator();
  const { posts, loading, refetch, updateStatus, deletePost } = usePostIdeas(businessId || undefined);

  // Fetch business ID from database
  useEffect(() => {
    const fetchBusinessId = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (error) throw error;
        setBusinessId(data?.id || null);
      } catch (err) {
        console.error('Failed to fetch business:', err);
      }
    };

    fetchBusinessId();
  }, [user?.id]);

  const handleGenerate = async () => {
    if (!businessId) return;

    // Smart: 3 posts, Pro: 5 posts
    const numberOfPosts = isSmart ? 3 : 5;

    const result = await generate(businessId, numberOfPosts);
    if (result) {
      await refetch();
    }
  };

  const handleApprove = async (postId: string) => {
    await updateStatus(postId, 'approved');
  };

  const handleReject = async (postId: string) => {
    await updateStatus(postId, 'rejected');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-slate-800">{t('posts.title')}</h1>
              <TierBadge tier={tier} />
            </div>
            <p className="text-sm text-gray-600 mb-2">{t('posts.subtitle')}</p>
            {isSmart && (
              <p className="text-xs text-blue-600">{t('posts.smartLimit')}</p>
            )}
            {isPro && (
              <p className="text-xs text-purple-600">{t('posts.proUnlimited')}</p>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md text-sm"
          >
            {generating ? t('posts.generating') : `✨ ${t('posts.generate')}`}
          </button>
        </div>

        {/* Error message */}
        {genError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 font-medium">{genError}</p>
            {genError.includes('No active goals') && (
              <p className="text-xs text-red-700 mt-2">{t('posts.noGoals')}</p>
            )}
          </div>
        )}

        {/* Posts list */}
        <PostsList
          posts={posts}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={deletePost}
        />
      </div>
    </div>
  );
}
