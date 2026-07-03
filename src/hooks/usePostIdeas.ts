import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PostIdea {
  id: string;
  caption: string;
  hashtags: string[];
  platform: string;
  suggested_time: string;
  content_type: string;
  visual_suggestions: any;
  aligned_goal_id: string | null;
  goal_description: string | null;
  status: string;
  created_at: string;
}

interface UsePostIdeasResult {
  posts: PostIdea[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateStatus: (postId: string, status: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

export function usePostIdeas(businessId: string | undefined): UsePostIdeasResult {
  const [posts, setPosts] = useState<PostIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase as any)
        .from('post_ideas')
        .select('*')
        .eq('business_id', businessId)
        .order('suggested_time', { ascending: true });

      if (fetchError) throw fetchError;

      setPosts(data as any as PostIdea[]);
    } catch (err) {
      console.error('Error fetching post ideas:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const updateStatus = async (postId: string, status: string) => {
    try {
      const { error: updateError } = await (supabase as any)
        .from('post_ideas')
        .update({ status })
        .eq('id', postId);

      if (updateError) throw updateError;

      await fetchPosts();
    } catch (err) {
      console.error('Error updating post status:', err);
      setError(err as Error);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error: deleteError } = await (supabase as any)
        .from('post_ideas')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;

      await fetchPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
      setError(err as Error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
    updateStatus,
    deletePost,
  };
}
