import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function WriterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [isCreating, setIsCreating] = useState(false);
  const feedback = useFeedback();

  const { data: stories, isLoading } = useQuery({
    queryKey: ['stories', 'author', user?.id, activeTab],
    queryFn: async () => {
      const response = await http.get(`/authors/${user?.id}/stories/${activeTab}`);
      return response.data;
    },
    enabled: !!user
  });

  const handleCreateNew = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const response = await http.post('/stories', {
        title: 'Untitled Story',
        overview: 'Write your synopsis here...',
        isMature: false
      });
      navigate(`/writer/story/${response.data.id}`);
      feedback.success('New story created.');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'The story could not be created.'));
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) return <div className="p-8 text-center">Please login</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Writer Dashboard</h1>
        <button 
          onClick={handleCreateNew}
          disabled={isCreating}
          aria-busy={isCreating}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-primary px-4 py-2 font-medium text-xs sm:text-sm text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isCreating ? 'Creating...' : '+ Create New Story'}
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 mb-6">
        <button 
          className={`pb-2 font-medium border-b-2 text-xs sm:text-sm transition ${activeTab === 'published' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('published')}
        >
          Published Works
        </button>
        <button 
          className={`pb-2 font-medium border-b-2 text-xs sm:text-sm transition ${activeTab === 'drafts' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('drafts')}
        >
          Drafts
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-sm">Loading...</div>
      ) : stories?.length === 0 ? (
        <div className="text-center p-8 sm:p-12 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
          <p className="text-gray-500 text-sm mb-4">You have no {activeTab} stories yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {stories?.map((story: any) => (
            <div key={story.id} className="flex flex-col xs:flex-row border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              <div className="xs:w-1/3 w-full h-36 xs:h-auto bg-gray-100 dark:bg-slate-700 shrink-0">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">No Cover</div>
                )}
              </div>
              <div className="xs:w-2/3 w-full p-3.5 sm:p-4 flex flex-col justify-between min-w-0">
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1 line-clamp-1">{story.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-2">{story.overview}</p>
                  <div className="text-[11px] sm:text-xs text-gray-400">
                    👁 {story.readCount} Reads • ⭐ {story.likes} Likes
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                  <Link to={`/writer/story/${story.id}`} className="text-primary font-medium hover:underline">
                    Edit Details
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link to={`/writer/story/${story.id}/parts`} className="text-primary font-medium hover:underline">
                    Manage Chapters
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
