import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import http from '../api/http';

export default function StoryPage() {
  const { storyId } = useParams();

  const { data: story, isLoading: loadingStory } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const response = await http.get(`/stories/${storyId}`);
      return response.data;
    }
  });

  const { data: parts, isLoading: loadingParts } = useQuery({
    queryKey: ['story', storyId, 'parts'],
    queryFn: async () => {
      const response = await http.get(`/stories/${storyId}/parts?onlyPublished=true`);
      return response.data;
    }
  });

  if (loadingStory || loadingParts) return <div className="text-center p-8">Loading...</div>;
  if (!story) return <div className="text-center p-8 text-accent">Story not found</div>;

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded shadow overflow-hidden mt-4">
      <div className="md:flex">
        <div className="md:w-1/3 bg-gray-100 dark:bg-slate-700">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt={story.title} className="w-full h-auto object-cover aspect-[2/3]" />
          ) : (
            <div className="w-full aspect-[2/3] flex items-center justify-center text-gray-400">No Cover</div>
          )}
        </div>
        <div className="p-6 md:w-2/3">
          <div className="flex justify-between items-start">
            <h1 className="text-3xl font-bold text-primary mb-2">{story.title}</h1>
            {story.isMature && <span className="bg-accent text-white px-2 py-1 text-xs font-bold rounded">Mature</span>}
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">By {story.authorName}</p>
          
          <div className="flex gap-4 text-sm text-gray-500 mb-6">
            <span>👁 {story.readCount} Reads</span>
            <span>⭐ {story.likes} Likes</span>
            <span>{story.isCompleted ? 'Completed' : 'Ongoing'}</span>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Synopsis</h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{story.overview}</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {story.genres?.split(',').map((g: string) => (
              <span key={g} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                {g.trim()}
              </span>
            ))}
          </div>

          <h3 className="font-semibold mb-4 text-xl">Table of Contents</h3>
          {parts?.length > 0 ? (
            <ul className="space-y-2">
              {parts.map((part: any, index: number) => (
                <li key={part.id}>
                  <Link 
                    to={`/story/${story.id}/read/${part.id}`}
                    className="flex justify-between p-3 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
                  >
                    <span>Part {index + 1}: {part.title}</span>
                    <span className="text-gray-400 text-sm">👁 {part.readCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No chapters published yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
