import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../../api/http';

export default function StoryEditPage() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isMature, setIsMature] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const { data: story, isLoading } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const res = await http.get(`/stories/${storyId}`);
      return res.data;
    },
    enabled: !!storyId
  });

  useEffect(() => {
    if (story) {
      setTitle(story.title || '');
      setOverview(story.overview || '');
      setCoverImageUrl(story.coverImageUrl || '');
      setIsMature(story.isMature || false);
      setIsCompleted(story.isCompleted || false);
    }
  }, [story]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      await http.put(`/stories/${storyId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      navigate('/writer');
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/stories/${storyId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      navigate('/writer');
    }
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/stories/${storyId}/unpublish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      navigate('/writer');
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      title,
      overview,
      coverImageUrl,
      isMature,
      isCompleted
    });
  };

  if (isLoading) return <div className="p-8 text-center">Loading story details...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Story Details</h1>
        <div className="flex gap-2">
          {!story?.isPublished ? (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600 transition"
            >
              {publishMutation.isPending ? 'Publishing...' : 'Publish Story'}
            </button>
          ) : (
            <button
              onClick={() => unpublishMutation.mutate()}
              disabled={unpublishMutation.isPending}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish Story'}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Overview / Synopsis</label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={5}
            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Image URL</label>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isMature}
              onChange={(e) => setIsMature(e.target.checked)}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mature Content</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Completed</span>
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/writer')}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600 transition"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
