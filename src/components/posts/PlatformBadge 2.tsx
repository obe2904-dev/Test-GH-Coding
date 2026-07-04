import { useTranslation } from 'react-i18next';

interface PlatformBadgeProps {
  platform: 'instagram' | 'facebook' | 'both';
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  const { t } = useTranslation('posts');

  const styles = {
    instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    facebook: 'bg-blue-600 text-white',
    both: 'bg-gradient-to-r from-blue-600 to-purple-500 text-white',
  };

  const icons = {
    instagram: '📷',
    facebook: '👥',
    both: '📱',
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${styles[platform]}`}
    >
      {icons[platform]} {t(`posts.platform.${platform}`)}
    </span>
  );
}
