import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, X, User as UserIcon, BookOpen, Eye, Heart } from 'lucide-react';
import http from '../api/http';
import { STORY_GENRES } from '../constants/genres';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { ContinueReadingShelf } from '../components/explore/ContinueReadingShelf';
import { RecommendedShelf } from '../components/explore/RecommendedShelf';

export default function ExplorePage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isSearching = debouncedQuery.length > 0;

  // Search stories
  const { data: searchStories = [], isLoading: loadingSearchStories } = useQuery({
    queryKey: ['search', 'stories', debouncedQuery],
    queryFn: async () => {
      const res = await http.get(`/stories/search?query=${encodeURIComponent(debouncedQuery)}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isSearching,
  });

  // Search authors
  const { data: searchAuthors = [], isLoading: loadingSearchAuthors } = useQuery({
    queryKey: ['search', 'authors', debouncedQuery],
    queryFn: async () => {
      const res = await http.get(`/users/search?query=${encodeURIComponent(debouncedQuery)}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: isSearching,
  });

  // Regular explore stories (filtered by genre if not 'All')
  const { data: exploreStories = [], isLoading: loadingExplore } = useQuery({
    queryKey: ['stories', 'explore', selectedGenre],
    queryFn: async () => {
      if (selectedGenre === 'All') {
        const res = await http.get('/stories');
        return Array.isArray(res.data) ? res.data : res.data.data || [];
      }
      const res = await http.get(`/stories/search?genre=${encodeURIComponent(selectedGenre)}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !isSearching,
  });

  const allGenres = ['All', ...STORY_GENRES];

  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Explore Stories</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Discover trending novels, verified authors, and fresh releases</p>
        </div>

        {/* Search Bar with Debounce */}
        <div className="w-full sm:w-72 md:w-80 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search stories, authors..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary shadow-xs"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SEARCH RESULTS VIEW */}
      {isSearching ? (
        <div className="space-y-8">
          {loadingSearchStories || loadingSearchAuthors ? (
            <div className="text-center py-12 text-sm text-gray-500">Searching "{debouncedQuery}"...</div>
          ) : (
            <>
              {/* Authors Section */}
              {searchAuthors.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-primary" />
                    Authors ({searchAuthors.length})
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {searchAuthors.map((author: any) => (
                      <Link
                        key={author.id}
                        to={`/profile/${author.username}`}
                        className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700 shadow-xs hover:border-primary/50 transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm uppercase overflow-hidden shrink-0">
                          {author.profileImageUrl ? (
                            <img src={author.profileImageUrl} alt={author.username} className="w-full h-full object-cover" />
                          ) : (
                            author.username?.[0] || 'U'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
                              @{author.username}
                            </span>
                            {author.isVerified && <VerifiedBadge size={13} />}
                          </div>
                          <span className="text-[11px] text-gray-400 block truncate">
                            {author.followers || 0} followers
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Stories Section */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Stories ({searchStories.length})
                </h2>

                {searchStories.length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-500 text-sm">
                    No stories found matching "{debouncedQuery}".
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
                    {searchStories.map((story: any) => (
                      <StoryCard key={story.id} story={story} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* NORMAL FEED VIEW */
        <>
          {/* Continue Reading Shelf */}
          <ContinueReadingShelf />

          {/* Recommended Shelf */}
          <RecommendedShelf />

          {/* 22 Genre Filter Pills */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2.5">
              Browse by Genre
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {allGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:border-primary/50'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Stories Grid */}
          {loadingExplore ? (
            <div className="text-center py-16 text-sm text-gray-500">Loading stories...</div>
          ) : exploreStories.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-gray-500 text-sm">
              No stories found in {selectedGenre}.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
              {exploreStories.map((story: any) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StoryCard({ story }: { story: any }) {
  return (
    <Link to={`/story/${story.id}`} className="group flex flex-col">
      <div className="aspect-[2/3] bg-gray-200 dark:bg-slate-700 rounded-xl overflow-hidden mb-2 relative shadow-xs group-hover:scale-[1.02] transition-transform">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">
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
        {(story.isAuthorVerified || story.author_is_verified) && <VerifiedBadge size={12} />}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {story.readCount || 0}</span>
        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {story.likes || 0}</span>
      </div>
    </Link>
  );
}
