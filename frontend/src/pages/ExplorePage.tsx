import { useQuery } from '@tanstack/react-query';
import http from '../api/http';
import { Link } from 'react-router-dom';

export default function ExplorePage() {
  const { data: stories, isLoading, error } = useQuery({
    queryKey: ['stories', 'explore'],
    queryFn: async () => {
      const response = await http.get('/stories');
      return response.data;
    }
  });

  if (isLoading) return <div className="text-center p-8">Loading stories...</div>;
  if (error) return <div className="text-center p-8 text-accent">Failed to load stories</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-primary">Explore</h1>
      
      <div className="mb-8 flex gap-4 overflow-x-auto pb-2">
        {['All', 'Romance', 'Fantasy', 'Sci-Fi', 'Thriller'].map(genre => (
          <button key={genre} className="px-4 py-2 rounded-full border border-primary text-primary hover:bg-primary hover:text-white transition whitespace-nowrap">
            {genre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {stories?.map((story: any) => (
          <Link to={`/story/${story.id}`} key={story.id} className="group">
            <div className="aspect-[2/3] bg-gray-200 dark:bg-slate-800 rounded-lg overflow-hidden mb-2 relative">
              {story.coverImageUrl ? (
                <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Cover</div>
              )}
              {story.isMature && (
                <span className="absolute top-2 right-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded">M</span>
              )}
            </div>
            <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition line-clamp-2">{story.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{story.authorName}</p>
            <div className="flex items-center text-xs text-gray-400 mt-1 gap-3">
              <span>👁 {story.readCount}</span>
              <span>⭐ {story.likes}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
