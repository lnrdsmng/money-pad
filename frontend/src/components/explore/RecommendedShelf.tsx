import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Eye, Heart } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { VerifiedBadge } from '../common/VerifiedBadge';

export const RecommendedShelf = () => {
  const { user } = useAuth();

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['stories', 'recommended'],
    queryFn: async () => {
      const res = await http.get('/stories/recommended');
      return res.data;
    },
    enabled: !!user,
  });

  if (!user || isLoading || stories.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
          Recommended For You
        </h2>
        {user?.preferredGenres && (
          <span className="text-xs text-gray-400 hidden sm:inline">
            Based on your favorite genres
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
        {stories.map((story: any) => (
          <Link
            key={story.id}
            to={`/story/${story.id}`}
            className="group min-w-[150px] sm:min-w-[170px] max-w-[170px] flex flex-col shrink-0"
          >
            <div className="aspect-[2/3] bg-gray-200 dark:bg-slate-700 rounded-xl overflow-hidden mb-2 relative shadow-xs group-hover:scale-[1.02] transition-transform">
              {story.coverImageUrl ? (
                <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2 text-center">
                  {story.title}
                </div>
              )}
              {story.isMature && (
                <span className="absolute top-2 right-2 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  M
                </span>
              )}
            </div>

            <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary transition-colors">
              {story.title}
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 truncate">
              <span>{story.authorName}</span>
              {story.isAuthorVerified && <VerifiedBadge size={12} />}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {story.readCount || 0}</span>
              <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {story.likes || 0}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecommendedShelf;
