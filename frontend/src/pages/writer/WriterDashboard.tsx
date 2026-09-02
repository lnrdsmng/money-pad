import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useState } from 'react';

export default function WriterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');

  const { data: stories, isLoading } = useQuery({
    queryKey: ['stories', 'author', user?.id, activeTab],
    queryFn: async () => {
      const response = await http.get(`/authors/${user?.id}/stories/${activeTab}`);
      return response.data;
    },
    enabled: !!user
  });

  const handleCreateNew = async () => {
    try {
      const response = await http.post('/stories', {
        title: 'Untitled Story',
        overview: 'Write your synopsis here...',
        isMature: false
      });
      navigate(`/writer/story/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create story');
    }
  };

  if (!user) return <div className="p-8 text-center">Please login</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Writer Dashboard</h1>
        <button 
          onClick={handleCreateNew}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-green-600 transition font-medium"
        >
          + Create New Story
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 mb-6">
        <button 
          className={`pb-2 font-medium border-b-2 transition ${activeTab === 'published' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('published')}
        >
          Published Works
        </button>
        <button 
          className={`pb-2 font-medium border-b-2 transition ${activeTab === 'drafts' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('drafts')}
        >
          Drafts
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-8">Loading...</div>
      ) : stories?.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
          <p className="text-gray-500 mb-4">You have no {activeTab} stories yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {stories?.map((story: any) => (
            <div key={story.id} className="flex border border-gray-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-800">
              <div className="w-1/3 bg-gray-100 dark:bg-slate-700">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">No Cover</div>
                )}
              </div>
              <div className="w-2/3 p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1 line-clamp-1">{story.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-2">{story.overview}</p>
                  <div className="text-xs text-gray-400">
                    👁 {story.readCount} Reads • ⭐ {story.likes} Likes
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/writer/story/${story.id}`} className="text-sm text-primary font-medium hover:underline">
                    Edit Details
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link to={`/writer/story/${story.id}/parts`} className="text-sm text-primary font-medium hover:underline">
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
