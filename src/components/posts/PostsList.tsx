import { useTranslation } from 'react-i18next';
import { PostIdeaCard } from './PostIdeaCard';

interface PostsListProps {
  posts: any[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PostsList({ posts, onApprove, onReject, onDelete }: PostsListProps) {
  const { t } = useTranslation('posts');

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="text-6xl mb-4">📝</div>
        <p className="text-base text-gray-600">{t('posts.noPosts')}</p>
      </div>
    );
  }

  // Group by status
  const draftPosts = posts.filter(p => p.status === 'draft');
  const approvedPosts = posts.filter(p => p.status === 'approved');
  const otherPosts = posts.filter(p => !['draft', 'approved'].includes(p.status));

  return (
    <div className="space-y-6">
      {/* Draft posts */}
      {draftPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Kladder ({draftPosts.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {draftPosts.map(post => (
              <PostIdeaCard
                key={post.id}
                post={post}
                onApprove={onApprove}
                onReject={onReject}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Approved posts */}
      {approvedPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Godkendte ({approvedPosts.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {approvedPosts.map(post => (
              <PostIdeaCard
                key={post.id}
                post={post}
                onApprove={onApprove}
                onReject={onReject}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other posts */}
      {otherPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Andre ({otherPosts.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {otherPosts.map(post => (
              <PostIdeaCard
                key={post.id}
                post={post}
                onApprove={onApprove}
                onReject={onReject}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
