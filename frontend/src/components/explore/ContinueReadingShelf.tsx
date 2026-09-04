import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Play } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';

export const ContinueReadingShelf = () => {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stories', 'continueReading'],
    queryFn: async () => {
      const res = await http.get('/stories/continue-reading');
      return res.data;
    },
    enabled: !!user,
  });

  if (!user || isLoading || items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Continue Reading
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
        {items.map((item: any) => {
          const story = item.story;
          const percentage = item.completed_percentage || 0;

          return (
            <div
              key={story.id}
              className="min-w-[260px] sm:min-w-[280px] max-w-[280px] bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="flex gap-3">
                <div className="w-16 h-22 rounded-lg bg-gray-200 dark:bg-slate-700 overflow-hidden shrink-0">
                  {story.coverImageUrl ? (
                    <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">No Cover</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                    {story.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">By {story.authorName}</p>
                  {item.last_part_title && (
                    <p className="text-[10px] text-primary truncate mt-1 font-medium">
                      {item.last_part_title}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bar & Resume Button */}
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                  <span>Progress</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2.5">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <Link
                  to={`/story/${story.id}/read/${item.last_part_id}`}
                  className="w-full py-1.5 px-3 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-white" />
                  Resume Chapter
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContinueReadingShelf;
