import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, Play, RotateCcw, Sparkles } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';

interface ReadingItem {
  story: {
    id: string;
    title: string;
    authorName: string;
    coverImageUrl?: string | null;
    genres?: string;
  };
  last_part_id: string;
  last_part_title: string | null;
  first_part_id: string | null;
  completed_percentage: number;
  is_finished: boolean;
  read_count: number;
  total_parts: number;
  updated_at: string;
}

export const ProfileReadingShelf = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'finished'>('all');

  const { data: items = [], isLoading } = useQuery<ReadingItem[]>({
    queryKey: ['stories', 'readingHistory', user?.id],
    queryFn: async () => {
      const res = await http.get('/stories/continue-reading', { params: { limit: 100 } });
      return res.data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-sm text-gray-500">
        Loading your reading history...
      </div>
    );
  }

  const inProgressItems = items.filter((item) => !item.is_finished);
  const finishedItems = items.filter((item) => item.is_finished);

  const displayedItems =
    filter === 'in_progress'
      ? inProgressItems
      : filter === 'finished'
        ? finishedItems
        : items;

  return (
    <div className="space-y-6">
      {/* Sub-filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          All Stories ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            filter === 'in_progress'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          In Progress ({inProgressItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('finished')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            filter === 'finished'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          Finished ({finishedItems.length})
        </button>
      </div>

      {displayedItems.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xs p-6">
          <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3 opacity-60" />
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">
            {filter === 'finished'
              ? 'No finished stories yet'
              : filter === 'in_progress'
                ? 'No stories in progress'
                : 'No reading history yet'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {filter === 'finished'
              ? 'Complete chapters of stories to mark them as finished here.'
              : 'Explore our catalog and start reading stories to track your progress.'}
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-green-600 transition shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Stories</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {displayedItems.map((item) => {
            const { story, completed_percentage, is_finished } = item;
            return (
              <div
                key={story.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-3">
                    <Link
                      to={`/story/${story.id}`}
                      className="w-20 h-28 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden shrink-0 border border-gray-100 dark:border-slate-600 shadow-2xs"
                    >
                      {story.coverImageUrl ? (
                        <img
                          src={story.coverImageUrl}
                          alt={story.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-gray-400">
                          <BookOpen className="w-6 h-6 opacity-40 mb-1" />
                          <span className="text-[10px] line-clamp-2">{story.title}</span>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {is_finished ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Finished
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <Clock className="w-3 h-3" />
                            {completed_percentage}%
                          </span>
                        )}
                      </div>

                      <Link to={`/story/${story.id}`}>
                        <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 line-clamp-2 hover:text-primary transition-colors">
                          {story.title}
                        </h3>
                      </Link>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        By {story.authorName}
                      </p>

                      {item.last_part_title && (
                        <p className="text-[10px] text-primary truncate mt-1.5 font-medium">
                          {is_finished ? 'Completed' : `Chapter: ${item.last_part_title}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3.5">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                      <span>{item.read_count} of {item.total_parts} chapters</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {completed_percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          is_finished ? 'bg-emerald-500' : 'bg-primary'
                        }`}
                        style={{ width: `${completed_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3.5 pt-2.5 border-t border-gray-100 dark:border-slate-700/60">
                  {is_finished ? (
                    <Link
                      to={`/story/${story.id}/read/${item.first_part_id || item.last_part_id}`}
                      className="w-full py-2 px-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
                      <span>Read Again</span>
                    </Link>
                  ) : (
                    <Link
                      to={`/story/${story.id}/read/${item.last_part_id}`}
                      className="w-full py-2 px-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-green-600 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Resume Chapter</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProfileReadingShelf;
