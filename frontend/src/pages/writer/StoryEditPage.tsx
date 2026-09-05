import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, BookOpen, LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function StoryEditPage() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isMature, setIsMature] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const handleUploadCover = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    setIsUploadingCover(true);
    try {
      const res = await http.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCoverImageUrl(res.data.url);
      feedback.success('Cover image uploaded.');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Cover upload failed.'));
    } finally {
      setIsUploadingCover(false);
    }
  };

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
      feedback.success('Story details saved.');
      navigate('/writer');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The story details could not be saved.')),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/stories/${storyId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      feedback.success('Story published.');
      navigate('/writer');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The story could not be published.')),
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/stories/${storyId}/unpublish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      feedback.success('Story moved back to drafts.');
      navigate('/writer');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The story could not be unpublished.')),
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Story Details</h1>
        <div className="flex w-full sm:w-auto justify-end gap-2">
          {!story?.isPublished ? (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || unpublishMutation.isPending || updateMutation.isPending}
              aria-busy={publishMutation.isPending}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white text-xs sm:text-sm rounded hover:bg-green-600 transition"
            >
              {publishMutation.isPending ? 'Publishing...' : 'Publish Story'}
            </button>
          ) : (
            <button
              onClick={() => unpublishMutation.mutate()}
              disabled={unpublishMutation.isPending || publishMutation.isPending || updateMutation.isPending}
              aria-busy={unpublishMutation.isPending}
              className="w-full sm:w-auto px-4 py-2 bg-gray-500 text-white text-xs sm:text-sm rounded hover:bg-gray-600 transition"
            >
              {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish Story'}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 sm:space-y-6 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Overview / Synopsis</label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={5}
            className="w-full p-2 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Story Cover Image (Recommended 2:3 ratio)
          </label>
          <div className="flex flex-col xs:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40">
            <div className="w-24 h-36 rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center text-xs text-gray-400 shadow-xs">
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[11px] text-gray-400 p-2 text-center">
                  <BookOpen className="w-6 h-6 opacity-40" />
                  <span>No Cover</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center xs:items-start gap-2.5 w-full min-w-0">
              <label className="inline-flex w-full xs:w-auto items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 rounded-xl cursor-pointer transition shadow-xs">
                {isUploadingCover ? <LoaderCircle className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
                <span>{isUploadingCover ? 'Uploading...' : coverImageUrl ? 'Change Cover' : 'Upload Cover'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingCover}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleUploadCover(e.target.files[0]);
                  }}
                />
              </label>
              {coverImageUrl && (
                <button
                  type="button"
                  onClick={() => setCoverImageUrl('')}
                  className="text-xs text-red-500 hover:underline cursor-pointer"
                >
                  Remove Cover
                </button>
              )}
              <p className="text-xs text-gray-400 text-center xs:text-left">
                PNG, JPG or WebP up to 2MB
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isMature}
              onChange={(e) => setIsMature(e.target.checked)}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Mature Content</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Mark as Completed</span>
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
            disabled={updateMutation.isPending || publishMutation.isPending || unpublishMutation.isPending}
            aria-busy={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600 transition"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
